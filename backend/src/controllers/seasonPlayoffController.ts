import { Request, Response } from 'express';
import prisma from '../config/database.js';
import { AuthRequest } from '../types/index.js';
import {
  MAX_QUALIFIERS,
  MIN_QUALIFIERS,
  type BracketPhase,
  bracketSize,
  buildBracket,
  roundsFor,
  seriesWinner,
} from '../services/playoff/bracket.js';
import { syncPlayoff } from '../services/playoff/sync.js';

const BEST_OF = [1, 3, 5, 7];
const ROUND_ORDER: BracketPhase[] = ['ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'FINAL', 'BRONZE'];

const teamRef = { select: { id: true, name: true, logo: true, primaryColor: true } } as const;

/**
 * A season's bracket as the pages draw it: each series with its teams (or the
 * seeds standing in for them), the series score and its games. Null when the
 * season has no play-off.
 */
async function loadPlayoff(seasonId: string) {
  const series = await prisma.playoffSeries.findMany({
    where: { seasonId },
    include: {
      homeTeam: teamRef,
      awayTeam: teamRef,
      winnerTeam: teamRef,
      games: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true, date: true, location: true, status: true, confirmedAt: true,
          homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true,
        },
      },
    },
  });
  if (series.length === 0) return null;

  series.sort((a, b) => ROUND_ORDER.indexOf(a.round) - ROUND_ORDER.indexOf(b.round) || a.slot - b.slot);
  const qualifiers = Math.max(...series.flatMap(s => [s.homeSeed ?? 0, s.awaySeed ?? 0]));

  return {
    qualifiers,
    bracketSize: bracketSize(qualifiers),
    rounds: roundsFor(qualifiers),
    seedsResolved: series.every(s =>
      (s.homeSeed === null || s.homeTeamId !== null) && (s.awaySeed === null || s.awayTeamId !== null)),
    series: series.map(s => {
      const decided = s.games
        .filter(g => g.status === 'COMPLETED' && g.confirmedAt && g.homeScore !== null && g.awayScore !== null)
        .map(g => ({ homeTeamId: g.homeTeamId, awayTeamId: g.awayTeamId, homeScore: g.homeScore!, awayScore: g.awayScore! }));
      const score = s.homeTeamId && s.awayTeamId
        ? seriesWinner(decided, { homeTeamId: s.homeTeamId, awayTeamId: s.awayTeamId }, s.bestOf)
        : { homeWins: 0, awayWins: 0 };
      return { ...s, homeWins: score.homeWins, awayWins: score.awayWins };
    }),
  };
}

export const getSeasonPlayoff = async (req: Request, res: Response): Promise<void> => {
  try {
    res.json(await loadPlayoff(req.params.id));
  } catch (error) {
    console.error('Get season playoff error:', error);
    res.status(500).json({ error: 'Failed to fetch the play-off' });
  }
};

/**
 * Draws the bracket for the top `qualifiers` teams of the table. It can be made
 * before the regular season ends: seeds stand in for the teams until every
 * regular-season game is settled, then the teams fill in (services/playoff/sync).
 */
export const createSeasonPlayoff = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const seasonId = req.params.id;
    const { qualifiers, bestOf = {}, bronze = true } = req.body as {
      qualifiers?: number;
      bestOf?: Partial<Record<BracketPhase, number>>;
      bronze?: boolean;
    };

    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      select: { archivedAt: true, _count: { select: { seasonTeams: true, playoffSeries: true } } },
    });
    if (!season) {
      res.status(404).json({ error: 'Season not found' });
      return;
    }
    if (season.archivedAt) {
      res.status(400).json({ error: 'Cannot modify an archived season' });
      return;
    }
    if (season._count.playoffSeries > 0) {
      res.status(409).json({ error: 'This season already has a play-off' });
      return;
    }
    if (typeof qualifiers !== 'number' || !Number.isInteger(qualifiers)
        || qualifiers < MIN_QUALIFIERS || qualifiers > MAX_QUALIFIERS) {
      res.status(400).json({ error: `Qualifiers must be a whole number from ${MIN_QUALIFIERS} to ${MAX_QUALIFIERS}` });
      return;
    }
    if (qualifiers > season._count.seasonTeams) {
      res.status(400).json({ error: 'More qualifiers than teams in the season' });
      return;
    }
    if (typeof bronze !== 'boolean') {
      res.status(400).json({ error: 'bronze must be true or false' });
      return;
    }
    for (const [round, value] of Object.entries(bestOf)) {
      if (!ROUND_ORDER.includes(round as BracketPhase) || !BEST_OF.includes(value as number)) {
        res.status(400).json({ error: 'A round is played as best of 1, 3, 5 or 7' });
        return;
      }
    }

    const slots = buildBracket(qualifiers, { bronze });
    await prisma.playoffSeries.createMany({
      data: slots.map(slot => ({
        seasonId,
        round: slot.round,
        slot: slot.slot,
        bestOf: bestOf[slot.round] ?? 1,
        homeSeed: slot.homeSeed,
        awaySeed: slot.awaySeed,
      })),
    });
    // Fills in the teams and the first games at once when the regular season is already over.
    await syncPlayoff(seasonId);

    res.status(201).json(await loadPlayoff(seasonId));
  } catch (error) {
    console.error('Create season playoff error:', error);
    res.status(500).json({ error: 'Failed to create the play-off' });
  }
};

/** Removes the bracket, but only before any play-off game has a result. */
export const deleteSeasonPlayoff = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const seasonId = req.params.id;

    const played = await prisma.game.count({
      where: {
        seasonId,
        playoffSeriesId: { not: null },
        OR: [{ homeScore: { not: null } }, { confirmedAt: { not: null } }, { status: { in: ['COMPLETED', 'IN_PROGRESS'] } }],
      },
    });
    if (played > 0) {
      res.status(409).json({ error: 'The play-off already has results and cannot be deleted' });
      return;
    }

    const games = await prisma.game.findMany({
      where: { seasonId, playoffSeriesId: { not: null } },
      select: { id: true },
    });
    await prisma.$transaction([
      prisma.teamEvent.deleteMany({ where: { gameId: { in: games.map(g => g.id) } } }),
      prisma.playoffSeries.deleteMany({ where: { seasonId } }),
    ]);

    res.json({ message: 'Play-off deleted' });
  } catch (error) {
    console.error('Delete season playoff error:', error);
    res.status(500).json({ error: 'Failed to delete the play-off' });
  }
};
