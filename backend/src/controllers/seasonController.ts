import { Request, Response } from 'express';
import prisma from '../config/database.js';
import { AuthRequest } from '../types/index.js';
import { Prisma } from '@prisma/client';

export const getAllSeasons = async (req: Request, res: Response): Promise<void> => {
  try {
    const seasons = await prisma.season.findMany({
      include: {
        _count: { select: { teams: true, games: true } },
        manager: { select: { id: true, name: true, email: true } }
      },
      orderBy: { startDate: 'desc' }
    });
    res.json(seasons);
  } catch (error) {
    console.error('Get seasons error:', error);
    res.status(500).json({ error: 'Failed to fetch seasons' });
  }
};

export const getMySeasons = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const seasons = await prisma.season.findMany({
      where: { managerId: req.user!.id },
      include: {
        _count: { select: { teams: true, games: true } },
        manager: { select: { id: true, name: true, email: true } }
      },
      orderBy: { startDate: 'desc' }
    });
    res.json(seasons);
  } catch (error) {
    console.error('Get my seasons error:', error);
    res.status(500).json({ error: 'Failed to fetch seasons' });
  }
};

export const getSeasonById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const season = await prisma.season.findUnique({
      where: { id: parseInt(id) },
      include: {
        teams: {
          include: {
            _count: { select: { players: true } },
            manager: { select: { id: true, name: true, email: true } }
          }
        },
        manager: { select: { id: true, name: true, email: true } },
        _count: { select: { games: true } }
      }
    });

    if (!season) {
      res.status(404).json({ error: 'Season not found' });
      return;
    }

    res.json(season);
  } catch (error) {
    console.error('Get season error:', error);
    res.status(500).json({ error: 'Failed to fetch season' });
  }
};

export const createSeason = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, sportType, startDate, endDate, status } = req.body;

    if (!name || !sportType || !startDate || !endDate) {
      res.status(400).json({ error: 'Name, sport type, start date, and end date are required' });
      return;
    }

    // Auto-set managerId for SEASON_MANAGER role
    const managerId = req.user!.role === 'SEASON_MANAGER' ? req.user!.id : null;

    const season = await prisma.season.create({
      data: {
        name,
        sportType,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: status || 'DRAFT',
        managerId
      },
      include: {
        manager: { select: { id: true, name: true, email: true } }
      }
    });

    res.status(201).json(season);
  } catch (error) {
    console.error('Create season error:', error);
    res.status(500).json({ error: 'Failed to create season' });
  }
};

export const updateSeason = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, sportType, startDate, endDate, status } = req.body;

    // Season managers can only update their own seasons
    if (req.user!.role === 'SEASON_MANAGER') {
      const season = await prisma.season.findUnique({ where: { id: parseInt(id) } });
      if (!season || season.managerId !== req.user!.id) {
        res.status(403).json({ error: 'Not authorized to update this season' });
        return;
      }
    }

    const season = await prisma.season.update({
      where: { id: parseInt(id) },
      data: {
        ...(name && { name }),
        ...(sportType && { sportType }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(status && { status })
      },
      include: {
        manager: { select: { id: true, name: true, email: true } }
      }
    });

    res.json(season);
  } catch (error) {
    if ((error as Prisma.PrismaClientKnownRequestError).code === 'P2025') {
      res.status(404).json({ error: 'Season not found' });
      return;
    }
    console.error('Update season error:', error);
    res.status(500).json({ error: 'Failed to update season' });
  }
};

export const deleteSeason = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Season managers can only delete their own seasons that haven't started yet
    if (req.user!.role === 'SEASON_MANAGER') {
      const season = await prisma.season.findUnique({ where: { id: parseInt(id) } });
      if (!season) {
        res.status(404).json({ error: 'Season not found' });
        return;
      }
      if (season.managerId !== req.user!.id) {
        res.status(403).json({ error: 'Not authorized to delete this season' });
        return;
      }
      if (new Date(season.startDate) <= new Date()) {
        res.status(403).json({ error: 'Cannot delete a season that has already started' });
        return;
      }
    }

    await prisma.season.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Season deleted successfully' });
  } catch (error) {
    if ((error as Prisma.PrismaClientKnownRequestError).code === 'P2025') {
      res.status(404).json({ error: 'Season not found' });
      return;
    }
    console.error('Delete season error:', error);
    res.status(500).json({ error: 'Failed to delete season' });
  }
};

export const getSeasonStandings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const seasonId = parseInt(id);

    const season = await prisma.season.findUnique({ where: { id: seasonId } });
    if (!season) {
      res.status(404).json({ error: 'Season not found' });
      return;
    }

    const teams = await prisma.team.findMany({
      where: { seasonId },
      select: { id: true, name: true, logo: true, primaryColor: true }
    });

    const games = await prisma.game.findMany({
      where: { seasonId, status: 'COMPLETED' }
    });

    const standings = teams.map(team => {
      let wins = 0, losses = 0, draws = 0, goalsFor = 0, goalsAgainst = 0;

      games.forEach(game => {
        if (game.homeTeamId === team.id) {
          goalsFor += game.homeScore || 0;
          goalsAgainst += game.awayScore || 0;
          if ((game.homeScore || 0) > (game.awayScore || 0)) wins++;
          else if ((game.homeScore || 0) < (game.awayScore || 0)) losses++;
          else draws++;
        } else if (game.awayTeamId === team.id) {
          goalsFor += game.awayScore || 0;
          goalsAgainst += game.homeScore || 0;
          if ((game.awayScore || 0) > (game.homeScore || 0)) wins++;
          else if ((game.awayScore || 0) < (game.homeScore || 0)) losses++;
          else draws++;
        }
      });

      const points = wins * 2 + draws;
      const played = wins + losses + draws;
      const goalDifference = goalsFor - goalsAgainst;

      return {
        team,
        played,
        wins,
        draws,
        losses,
        goalsFor,
        goalsAgainst,
        goalDifference,
        points
      };
    });

    standings.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      return b.goalsFor - a.goalsFor;
    });

    res.json(standings);
  } catch (error) {
    console.error('Get standings error:', error);
    res.status(500).json({ error: 'Failed to fetch standings' });
  }
};

export const getTeamStanding = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, teamId } = req.params;
    const seasonId = parseInt(id);
    const teamIdNum = parseInt(teamId);

    const season = await prisma.season.findUnique({ where: { id: seasonId } });
    if (!season) {
      res.status(404).json({ error: 'Season not found' });
      return;
    }

    const team = await prisma.team.findFirst({
      where: { id: teamIdNum, seasonId },
      select: { id: true, name: true, logo: true }
    });

    if (!team) {
      res.status(404).json({ error: 'Team not found in this season' });
      return;
    }

    const allTeams = await prisma.team.findMany({
      where: { seasonId },
      select: { id: true, name: true, logo: true }
    });

    const games = await prisma.game.findMany({
      where: { seasonId, status: 'COMPLETED' }
    });

    // Calculate standings for all teams to determine rank
    const allStandings = allTeams.map(t => {
      let wins = 0, losses = 0, draws = 0, goalsFor = 0, goalsAgainst = 0;

      games.forEach(game => {
        if (game.homeTeamId === t.id) {
          goalsFor += game.homeScore || 0;
          goalsAgainst += game.awayScore || 0;
          if ((game.homeScore || 0) > (game.awayScore || 0)) wins++;
          else if ((game.homeScore || 0) < (game.awayScore || 0)) losses++;
          else draws++;
        } else if (game.awayTeamId === t.id) {
          goalsFor += game.awayScore || 0;
          goalsAgainst += game.homeScore || 0;
          if ((game.awayScore || 0) > (game.homeScore || 0)) wins++;
          else if ((game.awayScore || 0) < (game.homeScore || 0)) losses++;
          else draws++;
        }
      });

      const points = wins * 2 + draws;
      const played = wins + losses + draws;
      const goalDifference = goalsFor - goalsAgainst;

      return {
        team: t,
        played,
        wins,
        draws,
        losses,
        goalsFor,
        goalsAgainst,
        goalDifference,
        points
      };
    });

    allStandings.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      return b.goalsFor - a.goalsFor;
    });

    const rank = allStandings.findIndex(s => s.team.id === teamIdNum) + 1;
    const teamStanding = allStandings.find(s => s.team.id === teamIdNum);

    res.json({
      ...teamStanding,
      rank,
      totalTeams: allTeams.length
    });
  } catch (error) {
    console.error('Get team standing error:', error);
    res.status(500).json({ error: 'Failed to fetch team standing' });
  }
};
