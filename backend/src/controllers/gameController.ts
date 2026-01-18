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

    if (!homeTeamId || !awayTeamId || !date) {
      res.status(400).json({ error: 'Home team, away team, and date are required' });
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
        date: new Date(date),
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
    const { startDate, intervalDays = 7, doubleRoundRobin = true } = req.body;

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

    await prisma.game.deleteMany({ where: { seasonId: parseInt(seasonId) } });

    const games: Prisma.GameCreateManyInput[] = [];
    const teamIds: (number | null)[] = teams.map(t => t.id);

    if (teamIds.length % 2 !== 0) {
      teamIds.push(null);
    }

    const n = teamIds.length;
    const rounds = n - 1;
    const matchesPerRound = n / 2;

    for (let round = 0; round < rounds; round++) {
      for (let match = 0; match < matchesPerRound; match++) {
        const home = (round + match) % (n - 1);
        let away = (n - 1 - match + round) % (n - 1);

        if (match === 0) {
          away = n - 1;
        }

        const homeTeamId = teamIds[home];
        const awayTeamId = teamIds[away];

        if (homeTeamId === null || awayTeamId === null) continue;

        const gameDate = new Date(startDate || season.startDate);
        gameDate.setDate(gameDate.getDate() + round * intervalDays);

        games.push({
          seasonId: parseInt(seasonId),
          homeTeamId,
          awayTeamId,
          date: gameDate,
          round: round + 1,
          status: 'SCHEDULED' as GameStatus
        });
      }
    }

    if (doubleRoundRobin) {
      const firstHalfLength = games.length;
      for (let i = 0; i < firstHalfLength; i++) {
        const originalGame = games[i];
        const gameDate = new Date(startDate || season.startDate);
        gameDate.setDate(gameDate.getDate() + (rounds + originalGame.round! - 1) * intervalDays);

        games.push({
          seasonId: parseInt(seasonId),
          homeTeamId: originalGame.awayTeamId,
          awayTeamId: originalGame.homeTeamId,
          date: gameDate,
          round: rounds + originalGame.round!,
          status: 'SCHEDULED' as GameStatus
        });
      }
    }

    await prisma.game.createMany({ data: games });

    const createdGames = await prisma.game.findMany({
      where: { seasonId: parseInt(seasonId) },
      include: {
        homeTeam: { select: { id: true, name: true, logo: true } },
        awayTeam: { select: { id: true, name: true, logo: true } }
      },
      orderBy: [{ round: 'asc' }, { date: 'asc' }]
    });

    res.status(201).json({
      message: `Generated ${createdGames.length} games`,
      games: createdGames
    });
  } catch (error) {
    console.error('Generate schedule error:', error);
    res.status(500).json({ error: 'Failed to generate schedule' });
  }
};
