import { Request, Response } from 'express';
import prisma from '../config/database.js';
import {
  AuthRequest,
  CreatePlayerRequest,
  UpdatePlayerRequest,
} from '../types/index.js';
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
    const { name, number, position, bornYear, note } = req.body as CreatePlayerRequest;

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

    const numberValue = number ? (typeof number === 'string' ? parseInt(number) : number) : null;
    const bornYearValue = bornYear ? (typeof bornYear === 'string' ? parseInt(bornYear) : bornYear) : null;

    const player = await prisma.player.create({
      data: {
        name,
        number: numberValue,
        position,
        bornYear: bornYearValue,
        note: note || null,
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
    const { name, number, position, bornYear, note } = req.body as UpdatePlayerRequest;

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

    const numberValue = number !== undefined
      ? (number ? (typeof number === 'string' ? parseInt(number) : number) : null)
      : undefined;

    const bornYearValue = bornYear !== undefined
      ? (bornYear ? (typeof bornYear === 'string' ? parseInt(bornYear) : bornYear) : null)
      : undefined;

    const player = await prisma.player.update({
      where: { id: parseInt(id) },
      data: {
        ...(name && { name }),
        ...(numberValue !== undefined && { number: numberValue }),
        ...(position !== undefined && { position }),
        ...(bornYearValue !== undefined && { bornYear: bornYearValue }),
        ...(note !== undefined && { note: note || null })
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

export const movePlayer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { targetTeamId } = req.body;

    if (!targetTeamId) {
      res.status(400).json({ error: 'Target team ID is required' });
      return;
    }

    // Get player with current team and season/league info
    const player = await prisma.player.findUnique({
      where: { id: parseInt(id) },
      include: {
        team: {
          include: {
            season: {
              include: { league: true }
            }
          }
        }
      }
    });

    if (!player) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }

    // Get target team with season/league info
    const targetTeam = await prisma.team.findUnique({
      where: { id: parseInt(targetTeamId) },
      include: {
        season: {
          include: { league: true }
        }
      }
    });

    if (!targetTeam) {
      res.status(404).json({ error: 'Target team not found' });
      return;
    }

    // Check authorization for SEASON_MANAGER
    if (req.user!.role === 'SEASON_MANAGER') {
      const sourceLeagueManagerId = player.team.season.league.managerId;
      const targetLeagueManagerId = targetTeam.season.league.managerId;

      // SEASON_MANAGER can only move players within leagues they manage
      if (sourceLeagueManagerId !== req.user!.id || targetLeagueManagerId !== req.user!.id) {
        res.status(403).json({ error: 'Not authorized to move players between these teams' });
        return;
      }
    }

    // Prevent moving to the same team
    if (player.teamId === parseInt(targetTeamId)) {
      res.status(400).json({ error: 'Player is already on this team' });
      return;
    }

    // Move the player
    const updatedPlayer = await prisma.player.update({
      where: { id: parseInt(id) },
      data: { teamId: parseInt(targetTeamId) },
      include: {
        team: {
          include: { season: true }
        }
      }
    });

    res.json(updatedPlayer);
  } catch (error) {
    console.error('Move player error:', error);
    res.status(500).json({ error: 'Failed to move player' });
  }
};
