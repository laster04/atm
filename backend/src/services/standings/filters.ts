import { Prisma } from '@prisma/client';

/**
 * Which games a league table is allowed to count.
 *
 * Only a confirmed result counts. A score that can still be edited must not move
 * a published table, which is the whole point of confirming a match report: the
 * standings stop shifting under everyone once the round is closed.
 *
 * Kept here rather than written out at each call site because the table, the
 * archive and the round summary all have to agree on it, and they drifted apart
 * the last time one of them was changed.
 */
export const COUNTS_TOWARD_TABLE: Prisma.GameWhereInput = {
  status: 'COMPLETED',
  confirmedAt: { not: null },
};

/**
 * Played, but not yet closed. These do not count, and they are exactly what the
 * live projection shows as pending: the move the table will make once the
 * result is confirmed.
 */
export const AWAITING_CONFIRMATION: Prisma.GameWhereInput = {
  status: 'COMPLETED',
  confirmedAt: null,
};

/** Being played right now. Also projected, never counted. */
export const BEING_PLAYED: Prisma.GameWhereInput = {
  status: 'IN_PROGRESS',
};

/**
 * Everything a table would count if every result on the table's desk were
 * settled: the games still running and the ones waiting to be confirmed.
 */
export const PENDING_RESULTS: Prisma.GameWhereInput = {
  OR: [AWAITING_CONFIRMATION, BEING_PLAYED],
};

/** True for a game whose result counts, when the row is already in hand. */
export const countsTowardTable = (game: {
  status: string;
  confirmedAt: Date | null;
}): boolean => game.status === 'COMPLETED' && game.confirmedAt !== null;
