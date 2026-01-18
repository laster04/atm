import { Request, Response } from 'express';
import prisma from '../config/database.js';
import { AuthRequest } from '../types/index.js';
import { Prisma } from '@prisma/client';

export const getMyTeams = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teams = await prisma.team.findMany({
      where: { managerId: req.user!.id },
      include: {
        season: true,
        _count: { select: { players: true } },
        manager: { select: { id: true, name: true, email: true } }
      },
      orderBy: { name: 'asc' }
    });
    res.json(teams);
  } catch (error) {
    console.error('Get my teams error:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
};

export const getTeamsBySeasonId = async (req: Request, res: Response): Promise<void> => {
  try {
    const { seasonId } = req.params;
    const teams = await prisma.team.findMany({
      where: { seasonId: parseInt(seasonId) },
      include: {
        _count: { select: { players: true } },
        manager: { select: { id: true, name: true, email: true } }
      },
      orderBy: { name: 'asc' }
    });
    res.json(teams);
  } catch (error) {
    console.error('Get teams error:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
};

export const getTeamById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const team = await prisma.team.findUnique({
      where: { id: parseInt(id) },
      include: {
        season: true,
        players: { orderBy: { number: 'asc' } },
        manager: { select: { id: true, name: true, email: true } },
        homeGames: {
          include: {
            awayTeam: { select: { id: true, name: true } }
          },
          orderBy: { date: 'asc' }
        },
        awayGames: {
          include: {
            homeTeam: { select: { id: true, name: true } }
          },
          orderBy: { date: 'asc' }
        }
      }
    });

    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    const allGames = [...team.homeGames, ...team.awayGames].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    res.json({ ...team, games: allGames });
  } catch (error) {
    console.error('Get team error:', error);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
};

export const createTeam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { seasonId } = req.params;
    const { name, logo, managerId } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Team name is required' });
      return;
    }

    const season = await prisma.season.findUnique({ where: { id: parseInt(seasonId) } });
    if (!season) {
      res.status(404).json({ error: 'Season not found' });
      return;
    }

    // Season managers can only add teams to their own seasons
    if (req.user!.role === 'SEASON_MANAGER' && season.managerId !== req.user!.id) {
      res.status(403).json({ error: 'Not authorized to add teams to this season' });
      return;
    }

    const team = await prisma.team.create({
      data: {
        name,
        logo,
        seasonId: parseInt(seasonId),
        managerId: managerId ? parseInt(managerId) : null
      },
      include: {
        manager: { select: { id: true, name: true, email: true } }
      }
    });

    res.status(201).json(team);
  } catch (error) {
    if ((error as Prisma.PrismaClientKnownRequestError).code === 'P2002') {
      res.status(400).json({ error: 'Team name already exists in this season' });
      return;
    }
    console.error('Create team error:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
};

export const updateTeam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, logo, managerId } = req.body;

    const existingTeam = await prisma.team.findUnique({
      where: { id: parseInt(id) },
      include: { season: true }
    });

    if (!existingTeam) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    // Season managers can only update teams in their own seasons
    if (req.user!.role === 'SEASON_MANAGER' && existingTeam.season.managerId !== req.user!.id) {
      res.status(403).json({ error: 'Not authorized to update this team' });
      return;
    }

    // Team managers can only update their own teams
    if (req.user!.role === 'TEAM_MANAGER' && existingTeam.managerId !== req.user!.id) {
      res.status(403).json({ error: 'Not authorized to update this team' });
      return;
    }

    const team = await prisma.team.update({
      where: { id: parseInt(id) },
      data: {
        ...(name && { name }),
        ...(logo !== undefined && { logo }),
        ...(managerId !== undefined && { managerId: managerId ? parseInt(managerId) : null })
      },
      include: {
        manager: { select: { id: true, name: true, email: true } }
      }
    });

    res.json(team);
  } catch (error) {
    if ((error as Prisma.PrismaClientKnownRequestError).code === 'P2025') {
      res.status(404).json({ error: 'Team not found' });
      return;
    }
    if ((error as Prisma.PrismaClientKnownRequestError).code === 'P2002') {
      res.status(400).json({ error: 'Team name already exists in this season' });
      return;
    }
    console.error('Update team error:', error);
    res.status(500).json({ error: 'Failed to update team' });
  }
};

export const deleteTeam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const team = await prisma.team.findUnique({
      where: { id: parseInt(id) },
      include: { season: true }
    });

    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    // Season managers can only delete teams in their own seasons
    if (req.user!.role === 'SEASON_MANAGER' && team.season.managerId !== req.user!.id) {
      res.status(403).json({ error: 'Not authorized to delete this team' });
      return;
    }

    await prisma.team.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Team deleted successfully' });
  } catch (error) {
    console.error('Delete team error:', error);
    res.status(500).json({ error: 'Failed to delete team' });
  }
};
