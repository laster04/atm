import { Request, Response } from 'express';
import prisma from '../config/database.js';
import { AuthRequest } from '../types/index.js';
import { Prisma } from '@prisma/client';

export const getPlayersByTeamId = async (req: Request, res: Response): Promise<void> => {
  try {
    const { teamId } = req.params;
    const players = await prisma.player.findMany({
      where: { teamId: parseInt(teamId) },
      orderBy: { number: 'asc' }
    });
    res.json(players);
  } catch (error) {
    console.error('Get players error:', error);
    res.status(500).json({ error: 'Failed to fetch players' });
  }
};

export const getPlayerById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const player = await prisma.player.findUnique({
      where: { id: parseInt(id) },
      include: {
        team: {
          include: { season: true }
        }
      }
    });

    if (!player) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }

    res.json(player);
  } catch (error) {
    console.error('Get player error:', error);
    res.status(500).json({ error: 'Failed to fetch player' });
  }
};

export const createPlayer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { teamId } = req.params;
    const { name, number, position } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Player name is required' });
      return;
    }

    const team = await prisma.team.findUnique({ where: { id: parseInt(teamId) } });
    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    if (req.user!.role === 'TEAM_MANAGER' && team.managerId !== req.user!.id) {
      res.status(403).json({ error: 'Not authorized to add players to this team' });
      return;
    }

    const player = await prisma.player.create({
      data: {
        name,
        number: number ? parseInt(number) : null,
        position,
        teamId: parseInt(teamId)
      }
    });

    res.status(201).json(player);
  } catch (error) {
    console.error('Create player error:', error);
    res.status(500).json({ error: 'Failed to create player' });
  }
};

export const updatePlayer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, number, position } = req.body;

    if (req.user!.role === 'TEAM_MANAGER') {
      const player = await prisma.player.findUnique({
        where: { id: parseInt(id) },
        include: { team: true }
      });
      if (!player || player.team.managerId !== req.user!.id) {
        res.status(403).json({ error: 'Not authorized to update this player' });
        return;
      }
    }

    const player = await prisma.player.update({
      where: { id: parseInt(id) },
      data: {
        ...(name && { name }),
        ...(number !== undefined && { number: number ? parseInt(number) : null }),
        ...(position !== undefined && { position })
      }
    });

    res.json(player);
  } catch (error) {
    if ((error as Prisma.PrismaClientKnownRequestError).code === 'P2025') {
      res.status(404).json({ error: 'Player not found' });
      return;
    }
    console.error('Update player error:', error);
    res.status(500).json({ error: 'Failed to update player' });
  }
};

export const deletePlayer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (req.user!.role === 'TEAM_MANAGER') {
      const player = await prisma.player.findUnique({
        where: { id: parseInt(id) },
        include: { team: true }
      });
      if (!player || player.team.managerId !== req.user!.id) {
        res.status(403).json({ error: 'Not authorized to delete this player' });
        return;
      }
    }

    await prisma.player.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Player deleted successfully' });
  } catch (error) {
    if ((error as Prisma.PrismaClientKnownRequestError).code === 'P2025') {
      res.status(404).json({ error: 'Player not found' });
      return;
    }
    console.error('Delete player error:', error);
    res.status(500).json({ error: 'Failed to delete player' });
  }
};
