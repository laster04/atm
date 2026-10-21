/**
 * Copies every logo that is still an external link into our own storage, once,
 * after file storage is deployed. Saving a record does the same for that one
 * record; this converts the rest.
 *
 * A link that cannot be fetched (gone, not an image, private address) is
 * cleared, so the crest shows the team's initials. One that failed in a way
 * that may pass (timeout, server error) is left for the next run. The same
 * link is fetched once per run: an archived season's copy of a team's logo
 * ends up pointing at the same file as the team.
 *
 *   npm run files:import-logos -- --dry-run   # list what would be fetched
 *   npm run files:import-logos
 */
import 'dotenv/config';
import type { FileOwnerType } from '@prisma/client';
import prisma from '../src/config/database.js';
import { attachLogo } from '../src/services/storage/files.js';
import { isOwnUrl } from '../src/services/storage/index.js';
import { importExternalLogo, type ImportResult } from '../src/services/storage/importExternal.js';

const dryRun = process.argv.includes('--dry-run');

interface Row { id: string; logo: string | null }
interface Source {
  label: string;
  owner: FileOwnerType | null;
  rows: () => Promise<Row[]>;
  save: (id: string, logo: string | null) => Promise<unknown>;
}

// Own URLs are filtered out below; the prefix depends on the environment.
const external = { not: null };

const sources: Source[] = [
  {
    label: 'teams', owner: 'TEAM',
    rows: () => prisma.team.findMany({ where: { logo: external }, select: { id: true, logo: true } }),
    save: (id, logo) => prisma.team.update({ where: { id }, data: { logo } }),
  },
  {
    label: 'leagues', owner: 'LEAGUE',
    rows: () => prisma.league.findMany({ where: { logo: external }, select: { id: true, logo: true } }),
    save: (id, logo) => prisma.league.update({ where: { id }, data: { logo } }),
  },
  {
    label: 'tournament series', owner: 'TOURNAMENT_SERIES',
    rows: () => prisma.tournamentSeries.findMany({ where: { logo: external }, select: { id: true, logo: true } }),
    save: (id, logo) => prisma.tournamentSeries.update({ where: { id }, data: { logo } }),
  },
  {
    label: 'tournament teams', owner: 'TOURNAMENT_TEAM',
    rows: () => prisma.tournamentTeam.findMany({ where: { logo: external }, select: { id: true, logo: true } }),
    save: (id, logo) => prisma.tournamentTeam.update({ where: { id }, data: { logo } }),
  },
  {
    // Snapshots: they keep the file alive but never own it.
    label: 'archived standings', owner: null,
    rows: async () => (await prisma.seasonArchiveStanding.findMany({
      where: { teamLogo: external }, select: { id: true, teamLogo: true },
    })).map((r) => ({ id: r.id, logo: r.teamLogo })),
    save: (id, logo) => prisma.seasonArchiveStanding.update({ where: { id }, data: { teamLogo: logo } }),
  },
];

const fetched = new Map<string, ImportResult>();
const totals = { converted: 0, cleared: 0, retryLater: 0 };

for (const source of sources) {
  const rows = (await source.rows()).filter((r) => r.logo && !isOwnUrl(r.logo));
  console.log(`${source.label}: ${rows.length} external logo(s)`);

  for (const row of rows) {
    const link = row.logo as string;
    if (dryRun) {
      console.log(`  ${row.id}  ${link}`);
      continue;
    }
    let result = fetched.get(link);
    if (!result) {
      result = await importExternalLogo(link, null);
      fetched.set(link, result);
    }
    if ('url' in result) {
      await source.save(row.id, result.url);
      if (source.owner) await attachLogo(result.url, { type: source.owner, id: row.id });
      totals.converted++;
    } else if (result.failed === 'permanent') {
      await source.save(row.id, null);
      totals.cleared++;
    } else {
      totals.retryLater++;
    }
  }
}

if (!dryRun) {
  console.log(`Converted ${totals.converted}, cleared ${totals.cleared}, left for a later run ${totals.retryLater}.`);
}
await prisma.$disconnect();
