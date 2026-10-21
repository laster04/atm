import prisma from '../config/database.js';
import { deleteUnreferencedLogos } from '../services/storage/files.js';
import { UNATTACHED_GRACE_MS } from '../services/storage/limits.js';

const SWEEP_EVERY_MS = 6 * 60 * 60 * 1000;
// Any constant; it only has to be the same in every instance of the app.
const SWEEP_LOCK_ID = 7_310_021;

/**
 * Deletes stored logos nothing references: uploads never saved on a record,
 * and files whose record went away without its cleanup running. Only files
 * older than the grace period, so an upload whose form is still open survives.
 */
export const sweepFiles = async (): Promise<number> =>
  deleteUnreferencedLogos({ createdBefore: new Date(Date.now() - UNATTACHED_GRACE_MS) });

/**
 * One sweep, in at most one instance of the app at a time. The transaction
 * only holds the advisory lock; the sweep itself runs on other connections.
 */
const sweepOnce = async (): Promise<void> => {
  try {
    await prisma.$transaction(async (tx) => {
      const [{ locked }] = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(${SWEEP_LOCK_ID}) AS locked`;
      if (!locked) return;
      const deleted = await sweepFiles();
      if (deleted > 0) console.log(`File sweep deleted ${deleted} unreferenced file(s)`);
    }, { timeout: 30 * 60 * 1000, maxWait: 10_000 });
  } catch (err) {
    console.error('File sweep failed:', err);
  }
};

/** Started by index.ts only, so tests never run it. */
export const startFileSweep = (): void => {
  setTimeout(sweepOnce, 60_000).unref();
  setInterval(sweepOnce, SWEEP_EVERY_MS).unref();
};
