import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import prisma from '../config/database.js';
import { AuthRequest } from '../types/index.js';
import { recordAudit } from '../services/audit/record.js';
import { readSpreadsheet, SpreadsheetError } from '../services/imports/spreadsheet.js';
import { applyImport, parseFixtures, planImport, ScheduleImportError } from '../services/imports/scheduleImport.js';

/**
 * A season's fixture list from an XLSX or CSV file (the ČVS "Program" export
 * or the same columns). Preview first, then import the same file; nothing is
 * kept between the two calls. Season access is checked by the routes.
 */

const MAX_BYTES = 1024 * 1024;

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1, fields: 0 } }).single('file');

export const parseScheduleUpload = (req: Request, res: Response, next: NextFunction): void => {
  upload(req, res, (err: unknown) => {
    if (!err && (req as Request & { file?: Express.Multer.File }).file) { next(); return; }
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: 'The file is larger than 1 MB', code: 'FILE_TOO_LARGE' });
      return;
    }
    res.status(400).json({ error: 'Send one file in the "file" field', code: 'FILE_MISSING' });
  });
};

const answerError = (res: Response, error: unknown, log: string): void => {
  if (error instanceof SpreadsheetError) { res.status(400).json({ error: error.message, code: error.code }); return; }
  if (error instanceof ScheduleImportError) { res.status(400).json({ error: error.message, code: error.code, missing: error.missing }); return; }
  console.error(log, error);
  res.status(500).json({ error: 'Failed to read the file' });
};

async function planFor(req: AuthRequest, res: Response) {
  const season = await prisma.season.findUnique({ where: { id: req.params.id }, select: { id: true, name: true, archivedAt: true } });
  if (!season) { res.status(404).json({ error: 'Season not found' }); return null; }
  if (season.archivedAt) { res.status(400).json({ error: 'Cannot modify an archived season', code: 'ARCHIVED' }); return null; }
  const rows = readSpreadsheet(req.file!.buffer);
  const parsed = parseFixtures(rows);
  return { season, plan: await planImport(season.id, parsed) };
}

/** POST /api/seasons/:id/schedule-import/preview (multipart "file") */
export const previewScheduleImport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await planFor(req, res);
    if (result) res.json(result.plan);
  } catch (error) {
    answerError(res, error, 'Preview schedule import error:');
  }
};

/** POST /api/seasons/:id/schedule-import (multipart "file"): imports what the preview showed. */
export const runScheduleImport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await planFor(req, res);
    if (!result) return;
    const { season, plan } = result;
    await prisma.$transaction(async (tx) => {
      await applyImport(tx, season.id, plan, req.user!.id);
      await recordAudit({
        entityType: 'Season',
        entityId: season.id,
        action: 'UPDATE',
        after: { name: season.name, scheduleImport: { file: req.file!.originalname.slice(0, 120), ...plan.counts } },
        actorId: req.user!.id,
      }, tx);
    }, { timeout: 30_000 });
    res.json(plan.counts);
  } catch (error) {
    answerError(res, error, 'Run schedule import error:');
  }
};
