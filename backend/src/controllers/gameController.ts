import { Request, Response } from 'express';
import prisma from '../config/database.js';
import {
  AuthRequest,
  CreateGameRequest,
  UpdateGameRequest,
  GenerateScheduleRequest,
} from '../types/index.js';
import { Prisma, GameStatus } from '@prisma/client';

export const getGamesBySeasonId = async (req: Request, res: Response): Promise<void> => {
  try {
    const { seasonId } = req.params;
    const games = await prisma.game.findMany({
      where: { seasonId: parseInt(seasonId) },
      include: {
        homeTeam: { select: { id: true, name: true, logo: true, primaryColor: true } },
        awayTeam: { select: { id: true, name: true, logo: true, primaryColor: true } }
      },
      // id breaks ties so undated generated games keep the order they were scheduled in
      orderBy: [{ round: 'asc' }, { date: 'asc' }, { id: 'asc' }]
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
      where: { id: parseInt(id) },
      include: {
        season: true,
        homeTeam: { select: { id: true, name: true, logo: true } },
        awayTeam: { select: { id: true, name: true, logo: true } }
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
    const { homeTeamId, awayTeamId, date, location, round } = req.body as CreateGameRequest;

    if (!homeTeamId || !awayTeamId) {
      res.status(400).json({ error: 'Home team and away team are required' });
      return;
    }

    if (homeTeamId === awayTeamId) {
      res.status(400).json({ error: 'Home and away teams must be different' });
      return;
    }

    const season = await prisma.season.findUnique({
      where: { id: parseInt(seasonId) },
      include: { league: { select: { managerId: true } } }
    });
    if (!season) {
      res.status(404).json({ error: 'Season not found' });
      return;
    }

    // Season managers can only create games in their own leagues' seasons
    if (req.user!.role === 'SEASON_MANAGER' && season.league.managerId !== req.user!.id) {
      res.status(403).json({ error: 'Not authorized to create games in this season' });
      return;
    }
    if (season.archivedAt) {
      res.status(400).json({ error: 'Cannot modify an archived season' });
      return;
    }

    const homeTeamIdNum = typeof homeTeamId === 'string' ? parseInt(homeTeamId) : homeTeamId;
    const awayTeamIdNum = typeof awayTeamId === 'string' ? parseInt(awayTeamId) : awayTeamId;
    const roundNum = round ? (typeof round === 'string' ? parseInt(round) : round) : null;

    // Validate both teams are in this season
    const teamsInSeason = await prisma.seasonTeam.findMany({
      where: {
        seasonId: parseInt(seasonId),
        teamId: { in: [homeTeamIdNum, awayTeamIdNum] }
      }
    });
    if (teamsInSeason.length < 2) {
      res.status(400).json({ error: 'Both teams must be part of this season' });
      return;
    }

    const game = await prisma.game.create({
      data: {
        seasonId: parseInt(seasonId),
        homeTeamId: homeTeamIdNum,
        awayTeamId: awayTeamIdNum,
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
      where: { id: parseInt(id) },
      include: { season: { include: { league: { select: { managerId: true } } } } }
    });

    if (!existingGame) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    // Season managers can only update games in their own leagues' seasons
    if (req.user!.role === 'SEASON_MANAGER' && existingGame.season.league.managerId !== req.user!.id) {
      res.status(403).json({ error: 'Not authorized to update this game' });
      return;
    }
    if (existingGame.season.archivedAt) {
      res.status(400).json({ error: 'Cannot modify an archived season' });
      return;
    }

    const homeTeamIdNum = homeTeamId ? (typeof homeTeamId === 'string' ? parseInt(homeTeamId) : homeTeamId) : undefined;
    const awayTeamIdNum = awayTeamId ? (typeof awayTeamId === 'string' ? parseInt(awayTeamId) : awayTeamId) : undefined;
    const roundNum = round !== undefined ? (round ? (typeof round === 'string' ? parseInt(round) : round) : null) : undefined;

    const game = await prisma.game.update({
      where: { id: parseInt(id) },
      data: {
        ...(homeTeamIdNum && { homeTeamId: homeTeamIdNum }),
        ...(awayTeamIdNum && { awayTeamId: awayTeamIdNum }),
        ...(date && { date: new Date(date) }),
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
        homeTeam: { select: { id: true, name: true, logo: true } },
        awayTeam: { select: { id: true, name: true, logo: true } }
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
      where: { id: parseInt(id) },
      include: { season: { include: { league: { select: { managerId: true } } } } }
    });

    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    // Season managers can only delete games in their own leagues' seasons
    if (req.user!.role === 'SEASON_MANAGER' && game.season.league.managerId !== req.user!.id) {
      res.status(403).json({ error: 'Not authorized to delete this game' });
      return;
    }
    if (game.season.archivedAt) {
      res.status(400).json({ error: 'Cannot modify an archived season' });
      return;
    }

    await prisma.game.delete({ where: { id: parseInt(id) } });
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
      where: { id: parseInt(seasonId) },
      include: {
        seasonTeams: { include: { team: true } },
        league: { select: { managerId: true } }
      }
    });

    if (!season) {
      res.status(404).json({ error: 'Season not found' });
      return;
    }

    // Season managers can only generate schedule for their own leagues' seasons
    if (req.user!.role === 'SEASON_MANAGER' && season.league.managerId !== req.user!.id) {
      res.status(403).json({ error: 'Not authorized to generate schedule for this season' });
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
            seasonId: parseInt(seasonId),
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
      prisma.game.deleteMany({ where: { seasonId: parseInt(seasonId) } }),
      prisma.game.createMany({ data: scheduledGames })
    ]);


    const createdGames = await prisma.game.findMany({
      where: { seasonId: parseInt(seasonId) },
      include: {
        homeTeam: { select: { id: true, name: true, logo: true } },
        awayTeam: { select: { id: true, name: true, logo: true } }
      },
      orderBy: [{ round: 'asc' }, { id: 'asc' }]
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

  const gamesLeftByTeam = new Map<number, number>();
  const addGamesLeft = (teamId: number, delta: number): void => {
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
