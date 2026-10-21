export type Visibility = 'PUBLIC' | 'PRIVATE';

/**
 * Where file bytes live. The app talks to storage only through this, so moving
 * from R2 to another S3-compatible provider (or anything else) means writing
 * one more driver, not touching the callers.
 */
export interface StorageDriver {
  put(key: string, body: Buffer, contentType: string, visibility: Visibility): Promise<void>;
  remove(key: string, visibility: Visibility): Promise<void>;
  /** Where anyone can fetch a public file. */
  publicUrl(key: string): string;
  /** A link to a private file that stops working after ttlSeconds. */
  signedUrl(key: string, ttlSeconds: number): Promise<string>;
}
