import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import prisma from '../config/database.js';
import { AuthRequest } from '../types/index.js';
import { isOwnUrl, storage } from '../services/storage/index.js';
import { attachLogo, DocumentRejectedError, releaseFiles, removeStoredFile, storeDocument } from '../services/storage/files.js';
import { PlanFeatureError, planFeatureBody, plusAllowance, publicExtras } from '../services/tournaments/plus.js';

/** Above any plan's document size; the plan's own limit is checked after. */
const DOCUMENT_HARD_MAX_BYTES = 25 * 1024 * 1024;
const NAME_MAX = 100;
const TITLE_MAX = 120;
const URL_MAX = 300;

const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: DOCUMENT_HARD_MAX_BYTES, files: 1, fields: 2 },
}).single('file');

export const parseDocumentUpload = (req: Request, res: Response, next: NextFunction): void => {
  documentUpload(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: 'The document is too large', code: 'FILE_TOO_LARGE' });
      return;
    }
    res.status(400).json({ error: 'Send one file in the "file" field', code: 'FILE_MISSING' });
  });
};

const text = (value: unknown, max: number): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= max ? trimmed : null;
};

/** A sponsor's website: http(s) only, or nothing. Undefined when the value is not acceptable. */
const website = (value: unknown): string | null | undefined => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > URL_MAX) return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
};

const fail = (res: Response, error: unknown, what: string): void => {
  if (error instanceof PlanFeatureError) {
    res.status(error.feature === 'DOCUMENT_SIZE' ? 413 : 409).json(planFeatureBody(error));
    return;
  }
  console.error(`${what} error:`, error);
  res.status(500).json({ error: `Failed to ${what.toLowerCase()}` });
};

/** For the manager: what the plan allows, what is used, and the partners and documents themselves. */
export const getPlus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const allowance = await plusAllowance(req.params.id);
    if (!allowance) {
      res.status(404).json({ error: 'Tournament not found' });
      return;
    }
    const extras = await publicExtras(req.params.id, allowance.plan);
    res.json({ ...allowance, sponsors: { ...allowance.sponsors, items: extras.sponsors }, documents: { ...allowance.documents, items: extras.documents } });
  } catch (error) {
    fail(res, error, 'Load tournament extras');
  }
};

// ---------------------------------------------------------------- sponsors

export const createSponsor = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tournamentId = req.params.id;
    const name = text(req.body.name, NAME_MAX);
    const url = website(req.body.url);
    const logo = typeof req.body.logo === 'string' ? req.body.logo : '';
    if (!name || url === undefined || !isOwnUrl(logo)) {
      res.status(400).json({ error: 'A sponsor needs a name, an uploaded logo and, optionally, a web address', code: 'INVALID_SPONSOR' });
      return;
    }
    const allowance = await plusAllowance(tournamentId);
    if (!allowance) {
      res.status(404).json({ error: 'Tournament not found' });
      return;
    }
    if (allowance.sponsors.used >= allowance.sponsors.limit) {
      throw new PlanFeatureError('SPONSOR_LOGOS', allowance.plan, allowance.sponsors.limit);
    }
    const sponsor = await prisma.tournamentSponsor.create({
      data: { tournamentId, name, url, logo, position: allowance.sponsors.used },
      select: { id: true, name: true, url: true, logo: true },
    });
    await attachLogo(logo, { type: 'TOURNAMENT', id: tournamentId });
    res.status(201).json(sponsor);
  } catch (error) {
    fail(res, error, 'Add sponsor');
  }
};

/** Name, link or logo. Editing an existing partner is allowed on any plan; adding is what the plan limits. */
export const updateSponsor = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id: tournamentId, sponsorId } = req.params;
    const existing = await prisma.tournamentSponsor.findFirst({ where: { id: sponsorId, tournamentId } });
    if (!existing) {
      res.status(404).json({ error: 'Sponsor not found' });
      return;
    }
    const data: { name?: string; url?: string | null; logo?: string } = {};
    if (req.body.name !== undefined) {
      const name = text(req.body.name, NAME_MAX);
      if (!name) { res.status(400).json({ error: 'Invalid name', code: 'INVALID_SPONSOR' }); return; }
      data.name = name;
    }
    if (req.body.url !== undefined) {
      const url = website(req.body.url);
      if (url === undefined) { res.status(400).json({ error: 'Invalid web address', code: 'INVALID_SPONSOR' }); return; }
      data.url = url;
    }
    if (req.body.logo !== undefined) {
      if (typeof req.body.logo !== 'string' || !isOwnUrl(req.body.logo)) {
        res.status(400).json({ error: 'Upload the logo first', code: 'INVALID_SPONSOR' });
        return;
      }
      data.logo = req.body.logo;
    }
    const sponsor = await prisma.tournamentSponsor.update({
      where: { id: sponsorId },
      data,
      select: { id: true, name: true, url: true, logo: true },
    });
    if (data.logo && data.logo !== existing.logo) {
      await attachLogo(data.logo, { type: 'TOURNAMENT', id: tournamentId });
      await releaseFiles([{ type: 'TOURNAMENT', id: tournamentId }]);
    }
    res.json(sponsor);
  } catch (error) {
    fail(res, error, 'Update sponsor');
  }
};

export const deleteSponsor = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id: tournamentId, sponsorId } = req.params;
    const removed = await prisma.tournamentSponsor.deleteMany({ where: { id: sponsorId, tournamentId } });
    if (removed.count === 0) {
      res.status(404).json({ error: 'Sponsor not found' });
      return;
    }
    // The logo goes too, unless something else still shows it.
    await releaseFiles([{ type: 'TOURNAMENT', id: tournamentId }]);
    res.json({ message: 'Sponsor removed' });
  } catch (error) {
    fail(res, error, 'Remove sponsor');
  }
};

/** The order partners are shown in: the ids, first to last. */
export const orderSponsors = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tournamentId = req.params.id;
    const ids = req.body.ids;
    const current = await prisma.tournamentSponsor.findMany({ where: { tournamentId }, select: { id: true } });
    if (!Array.isArray(ids) || ids.length !== current.length || !current.every((row) => ids.includes(row.id))) {
      res.status(400).json({ error: 'Send every sponsor id of the tournament once', code: 'INVALID_ORDER' });
      return;
    }
    await prisma.$transaction(ids.map((id: string, position: number) =>
      prisma.tournamentSponsor.update({ where: { id }, data: { position } })));
    res.json({ message: 'Order saved' });
  } catch (error) {
    fail(res, error, 'Order sponsors');
  }
};

// ---------------------------------------------------------------- documents

const titleFrom = (body: unknown, filename: string): string | null =>
  text((body as { title?: unknown })?.title, TITLE_MAX)
  ?? text(filename.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' '), TITLE_MAX);

export const uploadDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tournamentId = req.params.id;
    if (!req.file) {
      res.status(400).json({ error: 'Send one file in the "file" field', code: 'FILE_MISSING' });
      return;
    }
    const allowance = await plusAllowance(tournamentId);
    if (!allowance) {
      res.status(404).json({ error: 'Tournament not found' });
      return;
    }
    const { documents } = allowance;
    if (documents.used >= documents.limit) throw new PlanFeatureError('DOCUMENTS', allowance.plan, documents.limit);
    if (req.file.size > documents.maxMb * 1024 * 1024) throw new PlanFeatureError('DOCUMENT_SIZE', allowance.plan, documents.maxMb);
    const title = titleFrom(req.body, req.file.originalname) ?? 'Dokument';

    const file = await storeDocument(req.file.buffer, { tournamentId, uploadedById: req.user!.id });
    const document = await prisma.tournamentDocument.create({
      data: { tournamentId, fileId: file.id, title, position: documents.used },
      select: { id: true, title: true },
    });
    res.status(201).json({ ...document, size: file.size });
  } catch (error) {
    if (error instanceof DocumentRejectedError) {
      res.status(400).json({ error: error.message, code: error.code });
      return;
    }
    fail(res, error, 'Upload document');
  }
};

export const renameDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id: tournamentId, documentId } = req.params;
    const title = text(req.body.title, TITLE_MAX);
    if (!title) {
      res.status(400).json({ error: 'Invalid title', code: 'INVALID_TITLE' });
      return;
    }
    const updated = await prisma.tournamentDocument.updateMany({ where: { id: documentId, tournamentId }, data: { title } });
    if (updated.count === 0) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    res.json({ id: documentId, title });
  } catch (error) {
    fail(res, error, 'Rename document');
  }
};

export const deleteDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id: tournamentId, documentId } = req.params;
    const document = await prisma.tournamentDocument.findFirst({
      where: { id: documentId, tournamentId },
      include: { file: { select: { id: true, key: true, visibility: true } } },
    });
    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    await prisma.tournamentDocument.delete({ where: { id: document.id } });
    await removeStoredFile(document.file).catch((err) => console.error('Failed to delete document file:', err));
    res.json({ message: 'Document removed' });
  } catch (error) {
    fail(res, error, 'Remove document');
  }
};

/**
 * Anyone who may see the tournament (the route checks it) gets a link that
 * works for a few minutes; the file itself is never public.
 */
export const downloadDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: tournamentId, documentId } = req.params;
    const document = await prisma.tournamentDocument.findFirst({
      where: { id: documentId, tournamentId },
      include: { file: { select: { key: true } } },
    });
    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    res.set('Cache-Control', 'no-store').redirect(302, await storage().signedUrl(document.file.key, 5 * 60));
  } catch (error) {
    fail(res, error, 'Download document');
  }
};
