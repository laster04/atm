import crypto from 'crypto';
import type { FileOwnerType, Prisma } from '@prisma/client';
import prisma, { type DbClient } from '../../config/database.js';
import { isOwnUrl, storage } from './index.js';
import { processLogo } from './images.js';

export interface FileOwner {
  type: FileOwnerType;
  id: string;
}

/** Converts and stores a logo. It belongs to nothing until a save attaches it. */
export const storeLogo = async (
  input: Buffer,
  options: { uploadedById?: string | null; sourceUrl?: string | null } = {}
) => {
  const logo = await processLogo(input);
  const key = `logos/${crypto.randomUUID()}.webp`;
  const driver = storage();
  await driver.put(key, logo.buffer, logo.mimeType, 'PUBLIC');
  try {
    return await prisma.storedFile.create({
      data: {
        key,
        url: driver.publicUrl(key),
        kind: 'LOGO',
        visibility: 'PUBLIC',
        mimeType: logo.mimeType,
        size: logo.buffer.length,
        width: logo.width,
        height: logo.height,
        sourceUrl: options.sourceUrl ?? null,
        uploadedById: options.uploadedById ?? null,
      },
    });
  } catch (err) {
    await driver.remove(key, 'PUBLIC').catch(() => undefined);
    throw err;
  }
};

/**
 * Records which record a just-saved logo belongs to. Only a file nobody owns
 * yet is claimed: saving another team's logo URL on a second team references
 * the file but leaves it with its first owner.
 */
export const attachLogo = async (
  url: string | null | undefined,
  owner: FileOwner,
  tx: DbClient = prisma
): Promise<void> => {
  if (!url || !isOwnUrl(url)) return;
  await tx.storedFile.updateMany({
    where: { url, ownerType: null },
    data: { ownerType: owner.type, ownerId: owner.id },
  });
};

/** The URLs, out of `urls`, that some logo column still holds. */
const referencedUrls = async (urls: string[]): Promise<Set<string>> => {
  const byLogo = { logo: { in: urls } };
  const rows = await Promise.all([
    prisma.team.findMany({ where: byLogo, select: { logo: true } }),
    prisma.league.findMany({ where: byLogo, select: { logo: true } }),
    prisma.tournamentSeries.findMany({ where: byLogo, select: { logo: true } }),
    prisma.tournamentTeam.findMany({ where: byLogo, select: { logo: true } }),
    // An archived season keeps showing the logo the team had when it ended.
    prisma.seasonArchiveStanding.findMany({ where: { teamLogo: { in: urls } }, select: { teamLogo: true } })
      .then((list) => list.map((row) => ({ logo: row.teamLogo }))),
  ]);
  return new Set(rows.flat().map((row) => row.logo).filter((logo): logo is string => !!logo));
};

const BATCH = 500;

/**
 * Deletes logos no record references any more: those of the given owners
 * (after a record is deleted or its logo replaced), or every logo older than
 * `createdBefore` (the periodic sweep, which also catches uploads never saved).
 * Reference-based rather than cascading, because an archived season can keep a
 * deleted team's logo. Returns how many were deleted.
 */
export const deleteUnreferencedLogos = async (
  filter: { owners: FileOwner[] } | { createdBefore: Date }
): Promise<number> => {
  const where: Prisma.StoredFileWhereInput = 'owners' in filter
    ? { kind: 'LOGO', OR: filter.owners.map((o) => ({ ownerType: o.type, ownerId: o.id })) }
    : { kind: 'LOGO', createdAt: { lt: filter.createdBefore } };
  if ('owners' in filter && filter.owners.length === 0) return 0;

  let deleted = 0;
  let cursor: string | undefined;
  for (;;) {
    const batch = await prisma.storedFile.findMany({
      where,
      select: { id: true, key: true, url: true, visibility: true },
      orderBy: { id: 'asc' },
      take: BATCH,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });
    if (batch.length === 0) break;
    cursor = batch[batch.length - 1].id;

    const inUse = await referencedUrls(batch.map((f) => f.url).filter((u): u is string => !!u));
    for (const file of batch) {
      if (file.url && inUse.has(file.url)) continue;
      try {
        // Object first: a row without its object is harmless, an object
        // without a row would never be found again.
        await storage().remove(file.key, file.visibility);
        await prisma.storedFile.delete({ where: { id: file.id } });
        deleted++;
      } catch (err) {
        console.error(`Failed to delete stored file ${file.key}:`, err);
      }
    }
    if (batch.length < BATCH) break;
  }
  return deleted;
};

/**
 * Cleanup after a record is deleted or its logo changed. Never fails the
 * request that caused it: a leftover file is swept later, a refused delete
 * would be worse.
 */
export const releaseFiles = async (owners: FileOwner[]): Promise<void> => {
  try {
    await deleteUnreferencedLogos({ owners });
  } catch (err) {
    console.error('Failed to release stored files:', err);
  }
};

/** A tournament and its teams, read before the delete that cascades to them. */
export const tournamentFileOwners = async (tournamentId: string): Promise<FileOwner[]> => {
  const teams = await prisma.tournamentTeam.findMany({ where: { tournamentId }, select: { id: true } });
  return [
    { type: 'TOURNAMENT', id: tournamentId },
    ...teams.map((t) => ({ type: 'TOURNAMENT_TEAM' as const, id: t.id })),
  ];
};

/** A series with every edition and team under it. */
export const seriesFileOwners = async (seriesId: string): Promise<FileOwner[]> => {
  const tournaments = await prisma.tournament.findMany({
    where: { seriesId },
    select: { id: true, teams: { select: { id: true } } },
  });
  return [
    { type: 'TOURNAMENT_SERIES', id: seriesId },
    ...tournaments.flatMap((t) => [
      { type: 'TOURNAMENT' as const, id: t.id },
      ...t.teams.map((team) => ({ type: 'TOURNAMENT_TEAM' as const, id: team.id })),
    ]),
  ];
};
