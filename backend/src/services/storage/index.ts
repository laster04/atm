import path from 'path';
import type { StorageDriver } from './driver.js';
import { LocalDriver } from './localDriver.js';
import { S3Driver } from './s3Driver.js';

export type { StorageDriver, Visibility } from './driver.js';

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set when STORAGE_DRIVER=s3`);
  return value;
};

/** Without a trailing slash, so `${base}/${key}` is always one slash. */
export const publicBase = (): string =>
  (process.env.STORAGE_PUBLIC_URL || '/api/uploads').replace(/\/+$/, '');

export const usesLocalStorage = (): boolean => (process.env.STORAGE_DRIVER || 'local') === 'local';

export const localStorageDir = (): string =>
  path.resolve(process.env.STORAGE_LOCAL_DIR || './uploads');

let cached: { signature: string; driver: StorageDriver } | null = null;

/**
 * The configured driver. Read from the environment on first use rather than at
 * import, because dotenv runs after the app is imported, and rebuilt when the
 * configuration changes (tests point the local driver at a temp folder).
 */
export const storage = (): StorageDriver => {
  const signature = [
    process.env.STORAGE_DRIVER, process.env.STORAGE_LOCAL_DIR, process.env.STORAGE_PUBLIC_URL,
    process.env.S3_ENDPOINT, process.env.S3_PUBLIC_BUCKET, process.env.S3_PRIVATE_BUCKET,
  ].join('|');
  if (cached?.signature === signature) return cached.driver;

  const driver: StorageDriver = usesLocalStorage()
    ? new LocalDriver(localStorageDir(), publicBase())
    : new S3Driver({
        endpoint: required('S3_ENDPOINT'),
        accessKeyId: required('S3_ACCESS_KEY_ID'),
        secretAccessKey: required('S3_SECRET_ACCESS_KEY'),
        publicBucket: required('S3_PUBLIC_BUCKET'),
        privateBucket: required('S3_PRIVATE_BUCKET'),
        publicBase: required('STORAGE_PUBLIC_URL').replace(/\/+$/, ''),
      });
  cached = { signature, driver };
  return driver;
};

/** Whether a URL points into our own public storage. */
export const isOwnUrl = (url: string): boolean => url.startsWith(`${publicBase()}/`);
