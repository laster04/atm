import prisma from '../../config/database.js';
import { attachLogo, releaseFiles, type FileOwner } from './files.js';
import { isOwnUrl } from './index.js';
import { importExternalLogo } from './importExternal.js';

/**
 * Turns the `logo` a client sent into what gets saved, before the write.
 * `undefined` leaves the column as it is.
 *
 * - Our own uploaded URL is kept (an unknown one is dropped).
 * - An external link is copied into storage; one that cannot be fetched
 *   becomes null, so the crest falls back to the team's initials.
 * - A record still carrying an external link from before uploads existed
 *   converts it on any save, even one that does not touch the logo. A failure
 *   that may pass (timeout, server error) then leaves the link for next time.
 */
export const prepareLogo = async (
  incoming: unknown,
  existing: string | null | undefined,
  uploadedById: string | null
): Promise<string | null | undefined> => {
  if (incoming === undefined || incoming === existing) {
    if (!existing || isOwnUrl(existing)) return undefined;
    const result = await importExternalLogo(existing, uploadedById);
    if ('url' in result) return result.url;
    return result.failed === 'transient' ? undefined : null;
  }
  if (typeof incoming !== 'string') return null;
  const value = incoming.trim();
  if (!value) return null;

  if (isOwnUrl(value)) {
    const known = await prisma.storedFile.findUnique({ where: { url: value }, select: { id: true } });
    return known ? value : null;
  }
  const result = await importExternalLogo(value, uploadedById);
  return 'url' in result ? result.url : null;
};

/**
 * After the write: claims the new logo for its record and deletes the one it
 * replaced. Best-effort, like every cleanup here.
 */
export const settleLogo = async (owner: FileOwner, logo: string | null | undefined): Promise<void> => {
  if (logo === undefined) return;
  try {
    await attachLogo(logo, owner);
  } catch (err) {
    console.error('Failed to attach logo:', err);
  }
  await releaseFiles([owner]);
};
