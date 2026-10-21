import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import type { StorageDriver, Visibility } from './driver.js';

/**
 * Files on the local disk, for development and tests. Public files are served
 * by the app itself under STORAGE_PUBLIC_URL (see routes/files.ts); private
 * ones only through a link signed with the app's secret.
 */
export class LocalDriver implements StorageDriver {
  constructor(
    private readonly root: string,
    private readonly publicBase: string
  ) {}

  /** Absolute path of a key, or null when the key would escape its folder. */
  pathOf(key: string, visibility: Visibility): string | null {
    const dir = path.resolve(this.root, visibility === 'PUBLIC' ? 'public' : 'private');
    const file = path.resolve(dir, key);
    return file.startsWith(dir + path.sep) ? file : null;
  }

  async put(key: string, body: Buffer, _contentType: string, visibility: Visibility): Promise<void> {
    const file = this.pathOf(key, visibility);
    if (!file) throw new Error(`Invalid storage key: ${key}`);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, body);
  }

  async remove(key: string, visibility: Visibility): Promise<void> {
    const file = this.pathOf(key, visibility);
    if (!file) return;
    await fs.rm(file, { force: true });
  }

  publicUrl(key: string): string {
    return `${this.publicBase}/${key}`;
  }

  async signedUrl(key: string, ttlSeconds: number): Promise<string> {
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    return `/api/files/signed/${key}?exp=${exp}&sig=${signLocal(key, exp)}`;
  }
}

const signingKey = (): string =>
  crypto.createHash('sha256').update(`local-storage:${process.env.JWT_SECRET ?? ''}`).digest('hex');

export const signLocal = (key: string, exp: number): string =>
  crypto.createHmac('sha256', signingKey()).update(`${key}\n${exp}`).digest('hex');

export const verifyLocalSignature = (key: string, exp: number, sig: string): boolean => {
  if (!Number.isFinite(exp) || exp < Date.now() / 1000) return false;
  const expected = Buffer.from(signLocal(key, exp));
  const given = Buffer.from(sig);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
};
