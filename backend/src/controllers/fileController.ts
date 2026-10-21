import fs from 'fs';
import express, { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { AuthRequest } from '../types/index.js';
import { localStorageDir, storage, usesLocalStorage } from '../services/storage/index.js';
import { LocalDriver, verifyLocalSignature } from '../services/storage/localDriver.js';
import { FileRejectedError } from '../services/storage/images.js';
import { storeLogo } from '../services/storage/files.js';
import { LOGO_MAX_BYTES } from '../services/storage/limits.js';

const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LOGO_MAX_BYTES, files: 1, fields: 0 },
}).single('file');

/** multer's single-file parser, answering its limits with the codes the client knows. */
export const parseLogoUpload = (req: Request, res: Response, next: NextFunction): void => {
  logoUpload(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: 'Logo is larger than 1 MB', code: 'FILE_TOO_LARGE' });
      return;
    }
    res.status(400).json({ error: 'Send one file in the "file" field', code: 'FILE_MISSING' });
  });
};

/**
 * Stores a logo and returns its URL. Nothing references it yet: the form that
 * uploaded it saves the URL on its record, and an upload never saved is swept.
 */
export const uploadLogo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Send one file in the "file" field', code: 'FILE_MISSING' });
      return;
    }
    const file = await storeLogo(req.file.buffer, { uploadedById: req.user!.id });
    res.status(201).json({ id: file.id, url: file.url, width: file.width, height: file.height });
  } catch (error) {
    if (error instanceof FileRejectedError) {
      res.status(error.code === 'FILE_TOO_LARGE' ? 413 : 400).json({ error: error.message, code: error.code });
      return;
    }
    console.error('Upload logo error:', error);
    res.status(500).json({ error: 'Failed to store the file' });
  }
};

let localStatic: express.Handler | null = null;
let localStaticDir = '';

/**
 * Public files of the local driver. In production R2 serves them from its own
 * domain and this answers 404. Built on first request because the environment
 * is read after the app is imported.
 */
export const serveLocalUploads = (req: Request, res: Response): void => {
  if (!usesLocalStorage()) {
    res.status(404).end();
    return;
  }
  const dir = `${localStorageDir()}/public`;
  if (!localStatic || localStaticDir !== dir) {
    localStaticDir = dir;
    localStatic = express.static(dir, {
      index: false,
      dotfiles: 'deny',
      immutable: true,
      maxAge: '365d',
      setHeaders: (response) => response.setHeader('X-Content-Type-Options', 'nosniff'),
    });
  }
  localStatic(req, res, () => {
    res.status(404).end();
  });
};

/** A private file of the local driver, behind a link signed by LocalDriver.signedUrl. */
export const getSignedLocalFile = (req: Request, res: Response): void => {
  const driver = storage();
  const key = (req.params as Record<string, string>)[0] ?? '';
  const exp = Number(req.query.exp);
  const sig = typeof req.query.sig === 'string' ? req.query.sig : '';
  if (!(driver instanceof LocalDriver) || !verifyLocalSignature(key, exp, sig)) {
    res.status(404).end();
    return;
  }
  const file = driver.pathOf(key, 'PRIVATE');
  if (!file || !fs.existsSync(file)) {
    res.status(404).end();
    return;
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  res.sendFile(file);
};
