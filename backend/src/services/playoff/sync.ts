import { Prisma } from '@prisma/client';
import prisma from '../../config/database.js';
import { computeTable } from '../standings/compute.js';
import { COUNTS_TOWARD_TABLE } from '../standings/filters.js';
import { resolveSeasonPolicy } from '../scoring/resolve.js';
import {
  ROUND_SEQUENCE,
  type BracketPhase,
  advanceTarget,
  seedsFromTables,
  seriesWinner,
  winsNeeded,
} from './bracket.js';

type SeriesRow = Prisma.PlayoffSeriesGetPayload<{ include: { games: true } }>;

const key = (round: BracketPhase, slot: number) => `${round}:${slot}`;

/** Played and confirmed: the only results a series counts, as with the table. */
const isDecided = (game: SeriesRow['games'][number]) =>
  game.status === 'COMPLETED' && game.confirmedAt !== null && game.homeScore !== null && game.awayScore !== null;

/**
 * Brings a season's play-off in line with its confirmed results.
 *
 * Idempotent: it recomputes everything from the games, so it is safe to call
 * after any confirmation, reopening or correction. In order, it
 * 1. puts the teams on the seeds once every regular-season game is settled,
 * 2. decides every series that has enough wins and moves winners on (and
 *    semi-final losers into the bronze series),
 * 3. keeps just enough games in an undecided series to finish it, and drops
 *    the unplayed ones left over when it is decided.
 */
export async function syncPlayoff(seasonId: string): Promise<void> {
  const series = await prisma.playoffSeries.findMany({ where: { seasonId }, include: { games: true } });
  if (series.length === 0) return;

  const bySlot = new Map(series.map(s => [key(s.round, s.slot), s]));
  await resolveSeeds(seasonId, series);

  // Earlier rounds first, so a winner moved on in this pass is played out in
  // the next round within the same pass.
  for (const round of [...ROUND_SEQUENCE, 'BRONZE'] as BracketPhase[]) {
    for (const s of series.filter(row => row.round === round).sort((a, b) => a.slot - b.slot)) {
      await settleSeries(seasonId, s, bySlot);
    }
  }
}

/** True once nothing in the regular season can still move the table. */
async function regularSeasonSettled(seasonId: string): Promise<boolean> {
  const open = await prisma.game.count({
    where: {
      seasonId,
      playoffSeriesId: null,
      OR: [
        { status: { notIn: ['COMPLETED', 'CANCELLED'] } },
        { status: 'COMPLETED', confirmedAt: null },
      ],
    },
  });
  return open === 0;
}

async function resolveSeeds(seasonId: string, series: SeriesRow[]): Promise<void> {
  const unresolved = series.filter(s =>
    (s.homeSeed !== null && s.homeTeamId === null) || (s.awaySeed !== null && s.awayTeamId === null));
  if (unresolved.length === 0 || !(await regularSeasonSettled(seasonId))) return;

  const [seasonTeams, games, policy] = await Promise.all([
    prisma.seasonTeam.findMany({ where: { seasonId }, include: { team: { select: { id: true, name: true } } } }),
    prisma.game.findMany({ where: { seasonId, ...COUNTS_TOWARD_TABLE } }),
    resolveSeasonPolicy(seasonId),
  ]);
  const table = computeTable(seasonTeams.map(st => st.team), games, policy)
    .map(row => ({ teamId: row.teamId, points: row.points, goalDiff: row.goalDifference, goalsFor: row.goalsFor }));

  // The lowest seed always plays in the first round, so the highest seed on
  // the bracket is the number of qualifiers.
  const qualifiers = Math.max(...series.flatMap(s => [s.homeSeed ?? 0, s.awaySeed ?? 0]));
  const seeds = seedsFromTables([table], qualifiers);
  if (seeds.length < qualifiers) return; // teams left the season since the bracket was made

  for (const s of unresolved) {
    const data = {
      ...(s.homeSeed !== null && s.homeTeamId === null && { homeTeamId: seeds[s.homeSeed - 1] }),
      ...(s.awaySeed !== null && s.awayTeamId === null && { awayTeamId: seeds[s.awaySeed - 1] }),
    };
    await prisma.playoffSeries.update({ where: { id: s.id }, data });
    Object.assign(s, data);
  }
}

async function settleSeries(seasonId: string, s: SeriesRow, bySlot: Map<string, SeriesRow>): Promise<void> {
  if (!s.homeTeamId || !s.awayTeamId) return;
  const teams = { homeTeamId: s.homeTeamId, awayTeamId: s.awayTeamId };

  const decided = s.games.filter(isDecided).map(g => ({
    homeTeamId: g.homeTeamId,
    awayTeamId: g.awayTeamId,
    homeScore: g.homeScore!,
    awayScore: g.awayScore!,
  }));
  const { homeWins, awayWins, winnerId } = seriesWinner(decided, teams, s.bestOf);

  if (winnerId !== s.winnerTeamId) {
    await prisma.playoffSeries.update({ where: { id: s.id }, data: { winnerTeamId: winnerId } });
    s.winnerTeamId = winnerId;

    const loserId = winnerId === null ? null : winnerId === s.homeTeamId ? s.awayTeamId : s.homeTeamId;
    const { winner, loser } = advanceTarget(s.round, s.slot);
    for (const [target, teamId] of [[winner, winnerId], [loser, loserId]] as const) {
      const next = target && bySlot.get(key(target.round, target.slot));
      if (!next) continue;
      const field = target.side === 'home' ? 'homeTeamId' : 'awayTeamId';
      if (next[field] === teamId) continue;
      // The team facing the next opponent changed (a result was corrected).
      // Its unplayed games were drawn up for the old pairing, so they go; the
      // guards stop this once that series has a confirmed result.
      await removeOpenGames(next);
      await prisma.playoffSeries.update({ where: { id: next.id }, data: { [field]: teamId } });
      next[field] = teamId;
    }
  }

  if (winnerId) {
    await removeOpenGames(s);
    return;
  }

  // Just enough games to finish: in a best-of-3 at 1-1 that is one more.
  const stillNeeded = winsNeeded(s.bestOf) - Math.max(homeWins, awayWins);
  const pending = s.games.filter(g => g.status !== 'CANCELLED' && !isDecided(g));
  const missing = stillNeeded - pending.length;
  if (missing <= 0) return;

  let number = s.games.filter(g => g.status !== 'CANCELLED').length;
  for (let i = 0; i < missing; i++) {
    number++;
    // The series' home side (the better seed, unless there was an upset) hosts
    // games 1, 3, 5 and 7.
    const homeFirst = number % 2 === 1;
    const game = await prisma.game.create({
      data: {
        seasonId,
        playoffSeriesId: s.id,
        homeTeamId: homeFirst ? s.homeTeamId : s.awayTeamId,
        awayTeamId: homeFirst ? s.awayTeamId : s.homeTeamId,
        status: 'SCHEDULED',
      },
    });
    s.games.push(game);
  }
}

/**
 * Drops a series' games that have not been played: no score, no events, not
 * confirmed. Anything with a result stays, so a correction never erases one.
 */
async function removeOpenGames(s: SeriesRow): Promise<void> {
  const open = s.games.filter(g =>
    g.status === 'SCHEDULED' && g.homeScore === null && g.awayScore === null && g.confirmedAt === null);
  if (open.length === 0) return;
  const withEvents = await prisma.matchEvent.findMany({
    where: { gameId: { in: open.map(g => g.id) } },
    select: { gameId: true },
    distinct: ['gameId'],
  });
  const ids = open.map(g => g.id).filter(id => !withEvents.some(e => e.gameId === id));
  if (ids.length === 0) return;
  await prisma.teamEvent.deleteMany({ where: { gameId: { in: ids } } });
  await prisma.game.deleteMany({ where: { id: { in: ids } } });
  s.games = s.games.filter(g => !ids.includes(g.id));
}

/**
 * Why a play-off game's confirmed result may not be undone, or null if it may.
 * Once the next round has a confirmed result, changing who won this one would
 * pull a team out of a series it has already played in.
 */
export async function playoffResultLock(gameId: string): Promise<string | null> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { playoffSeries: { select: { seasonId: true, round: true, slot: true } } },
  });
  const s = game?.playoffSeries;
  if (!s) return null;

  const { winner, loser } = advanceTarget(s.round, s.slot);
  const targets = [winner, loser].filter(t => t !== null);
  if (targets.length === 0) return null;

  const played = await prisma.game.count({
    where: {
      confirmedAt: { not: null },
      playoffSeries: { seasonId: s.seasonId, OR: targets.map(t => ({ round: t.round, slot: t.slot })) },
    },
  });
  return played > 0 ? 'The next play-off round already has a confirmed result' : null;
}
