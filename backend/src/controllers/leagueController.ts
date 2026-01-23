import { Request, Response } from 'express';
import prisma from '../config/database.js';
import {
  AuthRequest,
  CreateLeagueRequest,
  UpdateLeagueRequest,
} from '../types/index.js';
import { Prisma } from '@prisma/client';

export const getAllLeagues = async (req: Request, res: Response): Promise<void> => {
  try {
    const leagues = await prisma.league.findMany({
      include: {
        _count: { select: { seasons: true } },
        manager: { select: { id: true, name: true, email: true } }
      },
      orderBy: { name: 'asc' }
    });
    res.json(leagues);
  } catch (error) {
    console.error('Get leagues error:', error);
    res.status(500).json({ error: 'Failed to fetch leagues' });
  }
};

export const getMyLeagues = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const leagues = await prisma.league.findMany({
      where: { managerId: req.user!.id },
      include: {
        _count: { select: { seasons: true } },
        manager: { select: { id: true, name: true, email: true } }
      },
      orderBy: { name: 'asc' }
    });
    res.json(leagues);
  } catch (error) {
    console.error('Get my leagues error:', error);
    res.status(500).json({ error: 'Failed to fetch leagues' });
  }
};

export const getLeagueById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const league = await prisma.league.findUnique({
      where: { id: parseInt(id) },
      include: {
        seasons: {
          include: {
            _count: { select: { teams: true, games: true } },
            manager: { select: { id: true, name: true, email: true } }
          },
          orderBy: { startDate: 'desc' }
        },
        manager: { select: { id: true, name: true, email: true } }
      }
    });

    if (!league) {
      res.status(404).json({ error: 'League not found' });
      return;
    }

    res.json(league);
  } catch (error) {
    console.error('Get league error:', error);
    res.status(500).json({ error: 'Failed to fetch league' });
  }
};

export const createLeague = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, sportType, logo, description } = req.body as CreateLeagueRequest;

    if (!name || !sportType) {
      res.status(400).json({ error: 'Name and sport type are required' });
      return;
    }

    // Auto-set managerId for SEASON_MANAGER role
    const managerId = req.user!.role === 'SEASON_MANAGER' ? req.user!.id : null;

    const league = await prisma.league.create({
      data: {
        name,
        sportType,
        logo,
        description,
        managerId
      },
      include: {
        manager: { select: { id: true, name: true, email: true } }
      }
    });

    res.status(201).json(league);
  } catch (error) {
    console.error('Create league error:', error);
    res.status(500).json({ error: 'Failed to create league' });
  }
};

export const updateLeague = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, sportType, logo, description } = req.body as UpdateLeagueRequest;

    // Season managers can only update their own leagues
    if (req.user!.role === 'SEASON_MANAGER') {
      const league = await prisma.league.findUnique({ where: { id: parseInt(id) } });
      if (!league || league.managerId !== req.user!.id) {
        res.status(403).json({ error: 'Not authorized to update this league' });
        return;
      }
    }

    const league = await prisma.league.update({
      where: { id: parseInt(id) },
      data: {
        ...(name && { name }),
        ...(sportType && { sportType }),
        ...(logo !== undefined && { logo }),
        ...(description !== undefined && { description })
      },
      include: {
        manager: { select: { id: true, name: true, email: true } }
      }
    });

    res.json(league);
  } catch (error) {
    if ((error as Prisma.PrismaClientKnownRequestError).code === 'P2025') {
      res.status(404).json({ error: 'League not found' });
      return;
    }
    console.error('Update league error:', error);
    res.status(500).json({ error: 'Failed to update league' });
  }
};

export const deleteLeague = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Season managers can only delete their own empty leagues
    if (req.user!.role === 'SEASON_MANAGER') {
      const league = await prisma.league.findUnique({
        where: { id: parseInt(id) },
        include: { _count: { select: { seasons: true } } }
      });
      if (!league) {
        res.status(404).json({ error: 'League not found' });
        return;
      }
      if (league.managerId !== req.user!.id) {
        res.status(403).json({ error: 'Not authorized to delete this league' });
        return;
      }
      if (league._count.seasons > 0) {
        res.status(403).json({ error: 'Cannot delete a league with existing seasons' });
        return;
      }
    }

    await prisma.league.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'League deleted successfully' });
  } catch (error) {
    if ((error as Prisma.PrismaClientKnownRequestError).code === 'P2025') {
      res.status(404).json({ error: 'League not found' });
      return;
    }
    console.error('Delete league error:', error);
    res.status(500).json({ error: 'Failed to delete league' });
  }
};
