import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import prisma from '../config/database.js';
import {
  ExternalFetchError,
  checkExternalUrl,
  fetchExternalImage,
  importExternalLogo,
  isBlockedAddress,
} from '../services/storage/importExternal.js';

const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-import-'));
process.env.STORAGE_DRIVER = 'local';
process.env.STORAGE_LOCAL_DIR = storageDir;
process.env.STORAGE_PUBLIC_URL = '/api/uploads';

afterAll(async () => {
  await prisma.$disconnect();
  fs.rmSync(storageDir, { recursive: true, force: true });
});

describe('which addresses a logo may be fetched from', () => {
  it('blocks the server itself, private networks and cloud metadata', () => {
    for (const address of [
      '127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0',
      '::1', '::', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:7f00:1', 'not-an-ip',
    ]) {
      expect(isBlockedAddress(address)).toBe(true);
    }
  });

  it('allows public addresses', () => {
    for (const address of ['1.1.1.1', '93.184.216.34', '2606:4700:4700::1111', '::ffff:1.1.1.1']) {
      expect(isBlockedAddress(address)).toBe(false);
    }
  });

  it('takes only https links on the default port, without credentials', () => {
    for (const link of [
      'http://example.com/logo.png', 'ftp://example.com/logo.png', 'file:///etc/passwd',
      'https://example.com:8443/logo.png', 'https://user:pw@example.com/logo.png',
      'https://127.0.0.1/logo.png', 'https://[::1]/logo.png', 'https://169.254.169.254/latest/meta-data',
      'not a link',
    ]) {
      expect(() => checkExternalUrl(link)).toThrow(ExternalFetchError);
    }
    expect(checkExternalUrl('https://example.com/logo.png').hostname).toBe('example.com');
  });

  it('refuses a hostname that resolves to a private address', async () => {
    await expect(fetchExternalImage('https://localhost/logo.png')).rejects.toThrow(/public address/);
  });
});

describe('importing an external logo', () => {
  it('stores the downloaded image and remembers where it came from', async () => {
    const png = await sharp({ create: { width: 900, height: 300, channels: 4, background: '#f59e0b' } }).png().toBuffer();
    const result = await importExternalLogo('https://example.com/club.png', null, async () => png);
    expect('url' in result).toBe(true);
    const url = (result as { url: string }).url;
    const row = await prisma.storedFile.findUnique({ where: { url } });
    expect(row).toMatchObject({ sourceUrl: 'https://example.com/club.png', width: 512, height: 171, ownerType: null });
    await prisma.storedFile.delete({ where: { url } });
  });

  it('tells a failure that may pass from one that will not', async () => {
    const timeout = await importExternalLogo('https://example.com/a.png', null, async () => {
      throw new ExternalFetchError('Timed out', true);
    });
    expect(timeout).toEqual({ failed: 'transient' });

    const notImage = await importExternalLogo('https://example.com/b.png', null, async () => Buffer.from('<html>'));
    expect(notImage).toEqual({ failed: 'permanent' });
  });
});
