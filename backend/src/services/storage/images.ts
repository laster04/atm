import sharp from 'sharp';
import { LOGO_MAX_BYTES, LOGO_MAX_DIMENSION, LOGO_WEBP_QUALITY, MAX_INPUT_PIXELS } from './limits.js';

export type FileRejection = 'FILE_TOO_LARGE' | 'FILE_TYPE_NOT_ALLOWED';

/** A file the app refuses to store; `code` is what the client translates. */
export class FileRejectedError extends Error {
  constructor(public readonly code: FileRejection, message: string) {
    super(message);
    this.name = 'FileRejectedError';
  }
}

// What sharp detects from the bytes themselves, so a renamed file is caught.
// SVG is refused on purpose: it can carry script.
const LOGO_FORMATS = new Set(['png', 'jpeg', 'webp']);

export interface ProcessedImage {
  buffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
}

/**
 * Turns an uploaded or downloaded logo into what is stored: WebP, at most
 * LOGO_MAX_DIMENSION on its longer side, turned upright and stripped of EXIF
 * and other metadata (sharp writes none unless asked to).
 */
export const processLogo = async (input: Buffer): Promise<ProcessedImage> => {
  if (input.length > LOGO_MAX_BYTES) {
    throw new FileRejectedError('FILE_TOO_LARGE', 'Logo is larger than 1 MB');
  }

  let format: string | undefined;
  try {
    format = (await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata()).format;
  } catch {
    format = undefined;
  }
  if (!format || !LOGO_FORMATS.has(format)) {
    throw new FileRejectedError('FILE_TYPE_NOT_ALLOWED', 'Logo must be a PNG, JPG or WebP image');
  }

  try {
    const { data, info } = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize({ width: LOGO_MAX_DIMENSION, height: LOGO_MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: LOGO_WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true });
    return { buffer: data, mimeType: 'image/webp', width: info.width, height: info.height };
  } catch {
    // Headers that parse over a body that does not.
    throw new FileRejectedError('FILE_TYPE_NOT_ALLOWED', 'Logo could not be read as an image');
  }
};
