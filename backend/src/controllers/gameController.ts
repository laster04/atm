import { Request, Response } from 'express';
import prisma from '../config/database.js';
import { AuthRequest } from '../types/index.js';
import { Prisma, GameStatus } from '@prisma/client';

export const getGamesBySeasonId = async (req: Request, res: Response): Promise<void> => {
  try {
    const { seasonId } = req.params;
    const games = await prisma.game.findMany({
      where: { seasonId: parseInt(seasonId) },
      include: {
        homeTeam: { select: { id: true, name: true, logo: true } },
        awayTeam: { select: { id: true, name: true, logo: true } }
      },
      orderBy: [{ round: 'asc' }, { date: 'asc' }]
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
    const { homeTeamId, awayTeamId, date, location, round } = req.body;

    if (!homeTeamId || !awayTeamId) {
      res.status(400).json({ error: 'Home team and away team are required' });
      return;
    }

    if (homeTeamId === awayTeamId) {
      res.status(400).json({ error: 'Home and away teams must be different' });
      return;
    }

    const season = await prisma.season.findUnique({ where: { id: parseInt(seasonId) } });
    if (!season) {
      res.status(404).json({ error: 'Season not found' });
      return;
    }

    // Season managers can only create games in their own seasons
    if (req.user!.role === 'SEASON_MANAGER' && season.managerId !== req.user!.id) {
      res.status(403).json({ error: 'Not authorized to create games in this season' });
      return;
    }

    const game = await prisma.game.create({
      data: {
        seasonId: parseInt(seasonId),
        homeTeamId: parseInt(homeTeamId),
        awayTeamId: parseInt(awayTeamId),
        date: date ? new Date(date) : null,
        location,
        round: round ? parseInt(round) : null
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
    const { homeTeamId, awayTeamId, date, location, homeScore, awayScore, status, round } = req.body;

    const existingGame = await prisma.game.findUnique({
      where: { id: parseInt(id) },
      include: { season: true }
    });

    if (!existingGame) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    // Season managers can only update games in their own seasons
    if (req.user!.role === 'SEASON_MANAGER' && existingGame.season.managerId !== req.user!.id) {
      res.status(403).json({ error: 'Not authorized to update this game' });
      return;
    }

    const game = await prisma.game.update({
      where: { id: parseInt(id) },
      data: {
        ...(homeTeamId && { homeTeamId: parseInt(homeTeamId) }),
        ...(awayTeamId && { awayTeamId: parseInt(awayTeamId) }),
        ...(date && { date: new Date(date) }),
        ...(location !== undefined && { location }),
        ...(homeScore !== undefined && { homeScore: homeScore !== null ? parseInt(homeScore) : null }),
        ...(awayScore !== undefined && { awayScore: awayScore !== null ? parseInt(awayScore) : null }),
        ...(status && { status }),
        ...(round !== undefined && { round: round ? parseInt(round) : null })
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
      include: { season: true }
    });

    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    // Season managers can only delete games in their own seasons
    if (req.user!.role === 'SEASON_MANAGER' && game.season.managerId !== req.user!.id) {
      res.status(403).json({ error: 'Not authorized to delete this game' });
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
    const { rounds: requestedRounds } = req.body;

    const season = await prisma.season.findUnique({
      where: { id: parseInt(seasonId) },
      include: { teams: true }
    });

    if (!season) {
      res.status(404).json({ error: 'Season not found' });
      return;
    }

    // Season managers can only generate schedule for their own seasons
    if (req.user!.role === 'SEASON_MANAGER' && season.managerId !== req.user!.id) {
      res.status(403).json({ error: 'Not authorized to generate schedule for this season' });
      return;
    }

    const teams = season.teams;
    if (teams.length < 2) {
      res.status(400).json({ error: 'Need at least 2 teams to generate schedule' });
      return;
    }

    if (season.status != 'DRAFT') {
      res.status(400).json({ error: 'You can\'t reschedule ACTIVE or COMPLETED season'});
      return;
    }

    await prisma.game.deleteMany({ where: { seasonId: parseInt(seasonId) } });

    const teamIds = teams.map(t => t.id);
    const totalRounds = requestedRounds || 1;

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
      await prisma.game.createMany({ data: shuffleGames(games) });
    }


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

function shuffleGames(games: Prisma.GameCreateManyInput[]): Prisma.GameCreateManyInput[] {
  let shuffled = [...games];
  let attempts = 0;
  const maxAttempts = 1000;

  const fisherYatesShuffle = (array: Prisma.GameCreateManyInput[]): Prisma.GameCreateManyInput[] => {
    const shuffled = [...array];

    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
  }

  const isValidSchedule = (games: Prisma.GameCreateManyInput[]): boolean => {
    for (let i = 0; i < games.length - 1; i++) {
      const current = games[i];
      const next = games[i + 1];

      // Check if same team appears consecutively
      if (
          current.homeTeamId === next.homeTeamId ||
          current.homeTeamId === next.awayTeamId ||
          current.awayTeamId === next.homeTeamId ||
          current.awayTeamId === next.awayTeamId
      ) {
        return false;
      }
    }

    return true;
  }
  while (!isValidSchedule(shuffled) && attempts < maxAttempts) {
    shuffled = fisherYatesShuffle([...games]);
    attempts++;
  }

  if (attempts === maxAttempts) {
    console.warn('Could not find valid schedule after max attempts');
  }

  return shuffled;
}
