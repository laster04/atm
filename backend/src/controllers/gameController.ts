import { Request, Response } from 'express';
import prisma from '../config/database.js';
import { auditSnapshot, recordAudit } from '../services/audit/record.js';
import {
  AuthRequest,
  CreateGameRequest,
  UpdateGameRequest,
  GenerateScheduleRequest,
} from '../types/index.js';
import { Prisma, GameStatus } from '@prisma/client';
import { toId } from '../utils/ids.js';

export const getGamesBySeasonId = async (req: Request, res: Response): Promise<void> => {
  try {
    const { seasonId } = req.params;
    const games = await prisma.game.findMany({
      where: { seasonId: seasonId },
      include: {
        homeTeam: { select: { id: true, name: true, logo: true, primaryColor: true } },
        awayTeam: { select: { id: true, name: true, logo: true, primaryColor: true } }
      },
      // id breaks ties so undated generated games keep the order they were scheduled in
      orderBy: [{ round: 'asc' }, { date: 'asc' }, { createdAt: 'asc' }]
    });
    res.json(games);
  } catch (error) {
    console.error('Get games error:', error);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
};

export const getGameById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const game = await prisma.game.findUnique({
      where: { id: id },
      include: {
        season: true,
        // The statistics screen colours itself by team and decides who may edit
        // which line-up, so a single game carries the colour and the manager.
        homeTeam: { select: { id: true, name: true, logo: true, primaryColor: true, managerId: true } },
        awayTeam: { select: { id: true, name: true, logo: true, primaryColor: true, managerId: true } }
      }
    });

    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    res.json(game);
  } catch (error) {
    console.error('Get game error:', error);
    res.status(500).json({ error: 'Failed to fetch game' });
  }
};

export const createGame = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { seasonId } = req.params;
    const { date, location, round } = req.body as CreateGameRequest;
    const homeTeamId = toId(req.body.homeTeamId);
    const awayTeamId = toId(req.body.awayTeamId);

    if (!homeTeamId || !awayTeamId) {
      res.status(400).json({ error: 'Home team and away team are required' });
      return;
    }

    if (homeTeamId === awayTeamId) {
      res.status(400).json({ error: 'Home and away teams must be different' });
      return;
    }

    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      include: { league: { select: { managerId: true } } }
    });
    if (!season) {
      res.status(404).json({ error: 'Season not found' });
      return;
    }

    if (season.archivedAt) {
      res.status(400).json({ error: 'Cannot modify an archived season' });
      return;
    }

    const roundNum = round ? (typeof round === 'string' ? parseInt(round) : round) : null;

    // Validate both teams are in this season
    const teamsInSeason = await prisma.seasonTeam.findMany({
      where: {
        seasonId: seasonId,
        teamId: { in: [homeTeamId, awayTeamId] }
      }
    });
    if (teamsInSeason.length < 2) {
      res.status(400).json({ error: 'Both teams must be part of this season' });
      return;
    }

    const game = await prisma.game.create({
      data: {
        seasonId: seasonId,
        homeTeamId: homeTeamId,
        awayTeamId: awayTeamId,
        date: date ? new Date(date) : null,
        location,
        round: roundNum
      },
      include: {
        homeTeam: { select: { id: true, name: true, logo: true } },
        awayTeam: { select: { id: true, name: true, logo: true } }
      }
    });

    res.status(201).json(game);
  } catch (error) {
    console.error('Create game error:', error);
    res.status(500).json({ error: 'Failed to create game' });
  }
};

export const updateGame = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      homeTeamId, awayTeamId, date, location,
      homeScore, awayScore,
      period1HomeScore, period1AwayScore,
      period2HomeScore, period2AwayScore,
      period3HomeScore, period3AwayScore,
      status, round
    } = req.body as UpdateGameRequest;

    const existingGame = await prisma.game.findUnique({
      where: { id: id },
      include: { season: { include: { league: { select: { managerId: true } } } } }
    });

    if (!existingGame) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    if (existingGame.season.archivedAt) {
      res.status(400).json({ error: 'Cannot modify an archived season' });
      return;
    }

    // A confirmed game is a closed record. Reopening it is a deliberate act with
    // a reason attached, not a side effect of saving an edit.
    if (existingGame.confirmedAt) {
      res.status(409).json({
        error: 'This game is confirmed. Reopen it before making changes.',
      });
      return;
    }

    // Scores of a game with an event log are derived from that log. Accepting a
    // hand-edited score here would last only until the next event was recorded.
    const editsScore = [
      homeScore, awayScore,
      period1HomeScore, period1AwayScore,
      period2HomeScore, period2AwayScore,
      period3HomeScore, period3AwayScore,
    ].some(value => value !== undefined);
    if (existingGame.eventsAuthoritative && editsScore) {
      res.status(409).json({
        error: 'This game\'s score comes from its event log. Edit the events instead.',
      });
      return;
    }

    const roundNum = round !== undefined ? (round ? (typeof round === 'string' ? parseInt(round) : round) : null) : undefined;

    const game = await prisma.game.update({
      where: { id: id },
      data: {
        ...(homeTeamId && { homeTeamId: homeTeamId }),
        ...(awayTeamId && { awayTeamId: awayTeamId }),
        // date can be explicitly cleared (null/'') when a game is postponed to an unknown date
        ...(date !== undefined && { date: date ? new Date(date) : null }),
        ...(location !== undefined && { location }),
        ...(homeScore !== undefined && { homeScore: homeScore !== null ? homeScore : null }),
        ...(awayScore !== undefined && { awayScore: awayScore !== null ? awayScore : null }),
        ...(period1HomeScore !== undefined && { period1HomeScore: period1HomeScore !== null ? period1HomeScore : null }),
        ...(period1AwayScore !== undefined && { period1AwayScore: period1AwayScore !== null ? period1AwayScore : null }),
        ...(period2HomeScore !== undefined && { period2HomeScore: period2HomeScore !== null ? period2HomeScore : null }),
        ...(period2AwayScore !== undefined && { period2AwayScore: period2AwayScore !== null ? period2AwayScore : null }),
        ...(period3HomeScore !== undefined && { period3HomeScore: period3HomeScore !== null ? period3HomeScore : null }),
        ...(period3AwayScore !== undefined && { period3AwayScore: period3AwayScore !== null ? period3AwayScore : null }),
        ...(status && { status }),
        ...(roundNum !== undefined && { round: roundNum })
      },
      include: {
        homeTeam: { select: { id: true, name: true, logo: true, primaryColor: true, managerId: true } },
        awayTeam: { select: { id: true, name: true, logo: true, primaryColor: true, managerId: true } }
      }
    });

    res.json(game);
  } catch (error) {
    console.error('Update game error:', error);
    res.status(500).json({ error: 'Failed to update game' });
  }
};

export const deleteGame = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const game = await prisma.game.findUnique({
      where: { id: id },
      include: { season: { include: { league: { select: { managerId: true } } } } }
    });

    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    if (game.season.archivedAt) {
      res.status(400).json({ error: 'Cannot modify an archived season' });
      return;
    }

    await prisma.game.delete({ where: { id: id } });
    res.json({ message: 'Game deleted successfully' });
  } catch (error) {
    console.error('Delete game error:', error);
    res.status(500).json({ error: 'Failed to delete game' });
  }
};

export const generateSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { seasonId } = req.params;
    const { rounds: requestedRounds } = req.body as GenerateScheduleRequest;

    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      include: {
        seasonTeams: { include: { team: true } },
        league: { select: { managerId: true } }
      }
    });

    if (!season) {
      res.status(404).json({ error: 'Season not found' });
      return;
    }


    const teams = season.seasonTeams.map(st => st.team);
    if (teams.length < 2) {
      res.status(400).json({ error: 'Need at least 2 teams to generate schedule' });
      return;
    }

    if (season.status != 'DRAFT') {
      res.status(400).json({ error: 'You can\'t reschedule ACTIVE or COMPLETED season'});
      return;
    }

    const totalRounds = requestedRounds ?? 1;
    if (!Number.isInteger(totalRounds) || totalRounds < 1) {
      res.status(400).json({ error: 'Rounds must be a positive whole number' });
      return;
    }

    const teamIds = teams.map(t => t.id);
    const scheduledGames: Prisma.GameCreateManyInput[] = [];
    let previousGame: Prisma.GameCreateManyInput | undefined;

    // Generate all pairings for each round (every team plays every other team)
    for (let round = 1; round <= totalRounds; round++) {

      const games: Prisma.GameCreateManyInput[] = [];
      const isReversed = round % 2 === 0; // Alternate home/away each round

      for (let i = 0; i < teamIds.length; i++) {
        for (let j = i + 1; j < teamIds.length; j++) {
          let homeTeamId = teamIds[i];
          let awayTeamId = teamIds[j];

          // Swap home/away for even rounds
          if (isReversed) {
            [homeTeamId, awayTeamId] = [awayTeamId, homeTeamId];
          }

          games.push({
            seasonId: seasonId,
            homeTeamId,
            awayTeamId,
            date: null,
            round,
            status: 'SCHEDULED' as GameStatus
          });
        }
      }

      // Order within the round, carrying the previous round's last game over so
      // no team plays back to back across the round boundary either.
      const orderedRound = orderGamesWithRest(games, previousGame);
      previousGame = orderedRound[orderedRound.length - 1];
      scheduledGames.push(...orderedRound);
    }

    // Games are read back in insertion order, so the delete and the insert have
    // to succeed or fail together to avoid leaving a half-generated schedule.
    await prisma.$transaction([
      prisma.game.deleteMany({ where: { seasonId: seasonId } }),
      prisma.game.createMany({ data: scheduledGames })
    ]);


    const createdGames = await prisma.game.findMany({
      where: { seasonId: seasonId },
      include: {
        homeTeam: { select: { id: true, name: true, logo: true } },
        awayTeam: { select: { id: true, name: true, logo: true } }
      },
      orderBy: [{ round: 'asc' }, { createdAt: 'asc' }]
    });

    res.status(201).json({
      message: `Generated ${createdGames.length} games across ${totalRounds} round(s)`,
      games: createdGames
    });
  } catch (error) {
    console.error('Generate schedule error:', error);
    res.status(500).json({ error: 'Failed to generate schedule' });
  }
};

type ScheduledGame = Prisma.GameCreateManyInput;

const sharesTeam = (a: ScheduledGame, b: ScheduledGame): boolean =>
  a.homeTeamId === b.homeTeamId ||
  a.homeTeamId === b.awayTeamId ||
  a.awayTeamId === b.homeTeamId ||
  a.awayTeamId === b.awayTeamId;

function fisherYatesShuffle<T>(array: T[]): T[] {
  const shuffled = [...array];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

/**
 * Orders games so that, where possible, no team plays two games in a row.
 *
 * Greedy pass: repeatedly take the game that doesn't reuse a team from the
 * previous game, preferring the one whose teams still have the most games left
 * (the most constrained ones, which get harder to place the longer they wait).
 * A team with too many games left can make some clashes unavoidable, so a
 * repair pass then swaps the leftovers out where a swap actually helps.
 *
 * `previousGame` is the game that comes immediately before this batch (the
 * previous round's last game), so the round boundary is checked as well.
 */
function orderGamesWithRest(games: ScheduledGame[], previousGame?: ScheduledGame): ScheduledGame[] {
  const remaining = fisherYatesShuffle(games);

  const gamesLeftByTeam = new Map<string, number>();
  const addGamesLeft = (teamId: string, delta: number): void => {
    gamesLeftByTeam.set(teamId, (gamesLeftByTeam.get(teamId) ?? 0) + delta);
  };
  for (const game of remaining) {
    addGamesLeft(game.homeTeamId, 1);
    addGamesLeft(game.awayTeamId, 1);
  }

  const ordered: ScheduledGame[] = [];
  let previous = previousGame;

  while (remaining.length > 0) {
    let bestIndex = -1;
    let bestScore = -1;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      if (previous && sharesTeam(previous, candidate)) continue;

      const score =
        (gamesLeftByTeam.get(candidate.homeTeamId) ?? 0) +
        (gamesLeftByTeam.get(candidate.awayTeamId) ?? 0);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    // Every remaining game reuses a team from the previous one: clash is unavoidable here.
    if (bestIndex === -1) bestIndex = 0;

    const [next] = remaining.splice(bestIndex, 1);
    addGamesLeft(next.homeTeamId, -1);
    addGamesLeft(next.awayTeamId, -1);
    ordered.push(next);
    previous = next;
  }

  return repairClashes(ordered, previousGame);
}

/**
 * Swaps games that still share a team with their neighbour, keeping only the
 * swaps that lower the number of clashes around the two positions touched.
 */
function repairClashes(games: ScheduledGame[], previousGame?: ScheduledGame): ScheduledGame[] {
  const repaired = [...games];

  // Clash on the boundary between position index - 1 and index.
  const boundaryClash = (index: number): number => {
    const before = index === 0 ? previousGame : repaired[index - 1];
    const after = repaired[index];
    if (!before || !after) return 0;
    return sharesTeam(before, after) ? 1 : 0;
  };

  const clashesAround = (i: number, j: number): number => {
    const boundaries = new Set([i, i + 1, j, j + 1].filter(b => b < repaired.length));
    let total = 0;
    for (const boundary of boundaries) total += boundaryClash(boundary);
    return total;
  };

  for (let i = 0; i < repaired.length; i++) {
    if (boundaryClash(i) === 0) continue;

    for (let j = 0; j < repaired.length; j++) {
      if (j === i) continue;

      const before = clashesAround(i, j);
      [repaired[i], repaired[j]] = [repaired[j], repaired[i]];

      if (clashesAround(i, j) < before) break;
      [repaired[i], repaired[j]] = [repaired[j], repaired[i]];
    }
  }

  return repaired;
}

/** The fields of a game the trail keeps on each administrative change. */
const GAME_AUDIT_FIELDS = [
  'homeScore', 'awayScore', 'status', 'date', 'location', 'confirmedAt', 'eventsAuthoritative',
] as const;

/**
 * Closes a match report. After this the score, the statistics and the event log
 * are all read-only, so the table behind them cannot quietly change once results
 * have been published.
 */
export const confirmGame = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const game = await prisma.game.findUnique({
      where: { id },
      include: { season: { select: { archivedAt: true } } },
    });
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }
    if (game.season.archivedAt) {
      res.status(400).json({ error: 'Cannot modify an archived season' });
      return;
    }
    if (game.confirmedAt) {
      res.status(409).json({ error: 'This game is already confirmed' });
      return;
    }
    // Confirming a fixture nobody has played would lock in an empty result.
    if (game.status !== 'COMPLETED') {
      res.status(400).json({ error: 'Only a completed game can be confirmed' });
      return;
    }

    const confirmed = await prisma.$transaction(async tx => {
      const updated = await tx.game.update({
        where: { id },
        data: { confirmedAt: new Date(), confirmedById: req.user?.id ?? null },
      });
      await recordAudit(
        {
          entityType: 'Game',
          entityId: id,
          action: 'CONFIRM',
          before: auditSnapshot(game, [...GAME_AUDIT_FIELDS]),
          after: auditSnapshot(updated, [...GAME_AUDIT_FIELDS]),
          actorId: req.user?.id ?? null,
        },
        tx
      );
      return updated;
    });

    res.json(confirmed);
  } catch (error) {
    console.error('Confirm game error:', error);
    res.status(500).json({ error: 'Failed to confirm the game' });
  }
};

/**
 * Reopens a confirmed report so it can be corrected. The reason is required:
 * a published result changing after the fact is exactly the case the trail
 * exists to explain.
 */
export const reopenGame = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body as { reason?: string };

    if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
      res.status(400).json({ error: 'A reason is required to reopen a confirmed game' });
      return;
    }

    const game = await prisma.game.findUnique({
      where: { id },
      include: { season: { select: { archivedAt: true } } },
    });
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }
    if (game.season.archivedAt) {
      res.status(400).json({ error: 'Cannot modify an archived season' });
      return;
    }
    if (!game.confirmedAt) {
      res.status(409).json({ error: 'This game is not confirmed' });
      return;
    }

    const reopened = await prisma.$transaction(async tx => {
      const updated = await tx.game.update({
        where: { id },
        data: { confirmedAt: null, confirmedById: null },
      });
      await recordAudit(
        {
          entityType: 'Game',
          entityId: id,
          action: 'REOPEN',
          before: auditSnapshot(game, [...GAME_AUDIT_FIELDS]),
          after: auditSnapshot(updated, [...GAME_AUDIT_FIELDS]),
          reason: reason.trim(),
          actorId: req.user?.id ?? null,
        },
        tx
      );
      return updated;
    });

    res.json(reopened);
  } catch (error) {
    console.error('Reopen game error:', error);
    res.status(500).json({ error: 'Failed to reopen the game' });
  }
};

/**
 * The administrative trail for one game: confirmations, reopenings and every
 * correction made to its report.
 */
export const getGameAudit = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Changes to the report are recorded against the game, not against each
    // event: the auditable thing is the result, and an event that was deleted
    // has no id left to look it up by.
    const entries = await prisma.auditLog.findMany({
      where: { entityType: 'Game', entityId: id },
      include: { actor: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json(entries);
  } catch (error) {
    console.error('Get game audit error:', error);
    res.status(500).json({ error: 'Failed to fetch the audit trail' });
  }
};
