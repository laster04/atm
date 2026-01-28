import { Request, Response } from 'express';
import prisma from '../config/database.js';
import {
  AuthRequest,
  CreateGameStatisticRequest,
  UpdateGameStatisticRequest,
} from '../types/index.js';
import { Prisma } from '@prisma/client';

export const getStatisticsByGameId = async (req: Request, res: Response): Promise<void> => {
  try {
    const { gameId } = req.params;
    const statistics = await prisma.gameStatistic.findMany({
      where: { gameId: parseInt(gameId) },
      include: {
        player: {
          include: { team: true }
        }
      },
      orderBy: [
        { goals: 'desc' },
        { assists: 'desc' }
      ]
    });
    res.json(statistics);
  } catch (error) {
    console.error('Get game statistics error:', error);
    res.status(500).json({ error: 'Failed to fetch game statistics' });
  }
};

export const getStatisticsByPlayerId = async (req: Request, res: Response): Promise<void> => {
  try {
    const { playerId } = req.params;
    const statistics = await prisma.gameStatistic.findMany({
      where: { playerId: parseInt(playerId) },
      include: {
        game: {
          include: {
            homeTeam: true,
            awayTeam: true
          }
        }
      },
      orderBy: { game: { date: 'desc' } }
    });
    res.json(statistics);
  } catch (error) {
    console.error('Get player statistics error:', error);
    res.status(500).json({ error: 'Failed to fetch player statistics' });
  }
};

export const getStatisticById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const statistic = await prisma.gameStatistic.findUnique({
      where: { id: parseInt(id) },
      include: {
        player: {
          include: { team: true }
        },
        game: {
          include: {
            homeTeam: true,
            awayTeam: true,
            season: true
          }
        }
      }
    });

    if (!statistic) {
      res.status(404).json({ error: 'Statistic not found' });
      return;
    }

    res.json(statistic);
  } catch (error) {
    console.error('Get statistic error:', error);
    res.status(500).json({ error: 'Failed to fetch statistic' });
  }
};

export const createStatistic = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { gameId } = req.params;
    const { playerId, goals, assists } = req.body as CreateGameStatisticRequest;

    if (!playerId) {
      res.status(400).json({ error: 'Player ID is required' });
      return;
    }

    const game = await prisma.game.findUnique({
      where: { id: parseInt(gameId) },
      include: { season: true }
    });
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    const player = await prisma.player.findUnique({
      where: { id: parseInt(String(playerId)) },
      include: { team: true }
    });
    if (!player) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }

    // Check if player's team is participating in this game
    if (player.team.seasonId !== game.seasonId) {
      res.status(400).json({ error: 'Player does not belong to a team in this game\'s season' });
      return;
    }

    if (game.homeTeamId !== player.teamId && game.awayTeamId !== player.teamId) {
      res.status(400).json({ error: 'Player\'s team is not participating in this game' });
      return;
    }

    // Check if statistic already exists for this player in this game
    const existingStatistic = await prisma.gameStatistic.findFirst({
      where: {
        gameId: parseInt(gameId),
        playerId: parseInt(String(playerId))
      }
    });
    if (existingStatistic) {
      res.status(400).json({ error: 'Statistic already exists for this player in this game' });
      return;
    }

    const statistic = await prisma.gameStatistic.create({
      data: {
        gameId: parseInt(gameId),
        playerId: parseInt(String(playerId)),
        goals: goals ?? null,
        assists: assists ?? null
      },
      include: {
        player: {
          include: { team: true }
        }
      }
    });

    res.status(201).json(statistic);
  } catch (error) {
    console.error('Create statistic error:', error);
    res.status(500).json({ error: 'Failed to create statistic' });
  }
};

export const updateStatistic = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { goals, assists } = req.body as UpdateGameStatisticRequest;

    const statistic = await prisma.gameStatistic.update({
      where: { id: parseInt(id) },
      data: {
        ...(goals !== undefined && { goals }),
        ...(assists !== undefined && { assists })
      },
      include: {
        player: {
          include: { team: true }
        }
      }
    });

    res.json(statistic);
  } catch (error) {
    if ((error as Prisma.PrismaClientKnownRequestError).code === 'P2025') {
      res.status(404).json({ error: 'Statistic not found' });
      return;
    }
    console.error('Update statistic error:', error);
    res.status(500).json({ error: 'Failed to update statistic' });
  }
};

export const deleteStatistic = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await prisma.gameStatistic.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Statistic deleted successfully' });
  } catch (error) {
    if ((error as Prisma.PrismaClientKnownRequestError).code === 'P2025') {
      res.status(404).json({ error: 'Statistic not found' });
      return;
    }
    console.error('Delete statistic error:', error);
    res.status(500).json({ error: 'Failed to delete statistic' });
  }
};

export const getTopScorersBySeason = async (req: Request, res: Response): Promise<void> => {
  try {
    const { seasonId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;

    // First get all game IDs for this season
    const games = await prisma.game.findMany({
      where: { seasonId: parseInt(seasonId) },
      select: { id: true }
    });
    const gameIds = games.map(g => g.id);

    // Get all game statistics for these games
    const statistics = await prisma.gameStatistic.findMany({
      where: {
        gameId: { in: gameIds }
      },
      include: {
        player: {
          include: {
            team: true
          }
        }
      }
    });

    // Aggregate by player
    const playerStats = new Map<number, {
      player: typeof statistics[0]['player'];
      goals: number;
      assists: number;
      gamesPlayed: number;
    }>();

    for (const stat of statistics) {
      const existing = playerStats.get(stat.playerId);
      if (existing) {
        existing.goals += stat.goals || 0;
        existing.assists += stat.assists || 0;
        existing.gamesPlayed += 1;
      } else {
        playerStats.set(stat.playerId, {
          player: stat.player,
          goals: stat.goals || 0,
          assists: stat.assists || 0,
          gamesPlayed: 1
        });
      }
    }

    // Convert to array and sort by goals + assists (points)
    const topScorers = Array.from(playerStats.values())
      .map(ps => ({
        ...ps,
        points: ps.goals + ps.assists
      }))
      .sort((a, b) => b.points - a.points || b.goals - a.goals)
      .slice(0, limit);

    res.json(topScorers);
  } catch (error) {
    console.error('Get top scorers error:', error);
    res.status(500).json({ error: 'Failed to fetch top scorers' });
  }
};
