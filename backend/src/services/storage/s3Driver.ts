import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { StorageDriver, Visibility } from './driver.js';

export interface S3Config {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBucket: string;
  privateBucket: string;
  publicBase: string;
}

/**
 * Cloudflare R2 (or any S3-compatible store). Two buckets: the public one sits
 * behind a public domain (STORAGE_PUBLIC_URL), the private one is reachable
 * only through presigned links.
 */
export class S3Driver implements StorageDriver {
  private readonly client: S3Client;

  constructor(private readonly config: S3Config) {
    this.client = new S3Client({
      region: 'auto',
      endpoint: config.endpoint,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
  }

  private bucket(visibility: Visibility): string {
    return visibility === 'PUBLIC' ? this.config.publicBucket : this.config.privateBucket;
  }

  async put(key: string, body: Buffer, contentType: string, visibility: Visibility): Promise<void> {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket(visibility),
      Key: key,
      Body: body,
      ContentType: contentType,
      // Keys are never reused, so a public file can be cached for good.
      CacheControl: visibility === 'PUBLIC' ? 'public, max-age=31536000, immutable' : 'private, no-store',
    }));
  }

  async remove(key: string, visibility: Visibility): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket(visibility), Key: key }));
  }

  publicUrl(key: string): string {
    return `${this.config.publicBase}/${key}`;
  }

  async signedUrl(key: string, ttlSeconds: number): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.config.privateBucket, Key: key }),
      { expiresIn: ttlSeconds }
    );
  }
}
