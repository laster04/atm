import { Request, Response } from 'express';
import prisma from '../config/database.js';
import {
  AuthRequest,
  CreatePlayerRequest,
  UpdatePlayerRequest,
} from '../types/index.js';
import { Prisma } from '@prisma/client';
import { toId } from '../utils/ids.js';
import { canManageTeam } from '../services/access.js';
import { normalizeEmail } from '../utils/email.js';

export const getPlayersByTeamId = async (req: Request, res: Response): Promise<void> => {
  try {
    const { teamId } = req.params;
    const players = await prisma.player.findMany({
      where: { teamId: teamId },
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
      where: { id: id },
      include: {
        team: {
          include: {
            seasonTeams: {
              include: {
                season: true
              }
            }
          }
        }
      }
    });

    if (!player) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }

    // Add convenience `season` field on team for backward compat
    const activeSeason = player.team.seasonTeams
      .map(st => st.season)
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
      .find(s => s.status === 'ACTIVE') || player.team.seasonTeams[0]?.season || null;

    res.json({
      ...player,
      team: { ...player.team, season: activeSeason }
    });
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

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        seasonTeams: {
          include: { season: { include: { league: { select: { managerId: true } } } } }
        }
      }
    });
    if (!team) {
      res.status(404).json({ error: 'Team not found' });
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
        teamId: teamId
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

    const numberValue = number !== undefined
      ? (number ? (typeof number === 'string' ? parseInt(number) : number) : null)
      : undefined;

    const bornYearValue = bornYear !== undefined
      ? (bornYear ? (typeof bornYear === 'string' ? parseInt(bornYear) : bornYear) : null)
      : undefined;

    const player = await prisma.player.update({
      where: { id: id },
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

    await prisma.player.delete({ where: { id: id } });
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
    const targetTeamId = toId(req.body.targetTeamId);

    if (!targetTeamId) {
      res.status(400).json({ error: 'Target team ID is required' });
      return;
    }

    // Get player with current team and season/league info
    const player = await prisma.player.findUnique({
      where: { id: id },
      include: {
        team: {
          include: {
            seasonTeams: {
              include: {
                season: { include: { league: true } }
              }
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
      where: { id: targetTeamId },
      include: {
        seasonTeams: {
          include: {
            season: { include: { league: true } }
          }
        }
      }
    });

    if (!targetTeam) {
      res.status(404).json({ error: 'Target team not found' });
      return;
    }

    // requirePlayerAccess covered the source team; the destination needs its own check.
    if (!(await canManageTeam(req.user!, targetTeamId))) {
      res.status(403).json({ error: 'Not authorized to move players between these teams' });
      return;
    }

    // Prevent moving to the same team
    if (player.teamId === targetTeamId) {
      res.status(400).json({ error: 'Player is already on this team' });
      return;
    }

    // Move the player
    const updatedPlayer = await prisma.player.update({
      where: { id: id },
      data: { teamId: targetTeamId },
      include: {
        team: {
          include: {
            seasonTeams: {
              include: { season: true }
            }
          }
        }
      }
    });

    // Add convenience `season` field
    const activeSeason = updatedPlayer.team.seasonTeams
      .map(st => st.season)
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
      .find(s => s.status === 'ACTIVE') || updatedPlayer.team.seasonTeams[0]?.season || null;

    res.json({
      ...updatedPlayer,
      team: { ...updatedPlayer.team, season: activeSeason }
    });
  } catch (error) {
    console.error('Move player error:', error);
    res.status(500).json({ error: 'Failed to move player' });
  }
};

/**
 * Links a roster row to the account of the person who holds it. A roster row is
 * created by a manager typing a name and exists whether or not that person ever
 * signs up, so the link is a separate, reversible step rather than part of
 * creating the player.
 *
 * Only an account that already exists can be linked: silently creating one from
 * a typo in an email field would hand a stranger a seat on the team.
 */
export const linkPlayerToUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { email } = req.body as { email?: string };

    if (!email || typeof email !== 'string' || !email.trim()) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const player = await prisma.player.findUnique({
      where: { id },
      select: { id: true, teamId: true, userId: true },
    });
    if (!player) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }
    if (player.userId) {
      res.status(409).json({ error: 'Player is already linked to an account' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
      select: { id: true, active: true },
    });
    if (!user) {
      res.status(404).json({ error: 'No account with that email' });
      return;
    }
    if (!user.active) {
      res.status(400).json({ error: 'That account is deactivated' });
      return;
    }

    // One person cannot hold two roster spots in the same team.
    const alreadyOnTeam = await prisma.player.findFirst({
      where: { teamId: player.teamId, userId: user.id },
      select: { id: true },
    });
    if (alreadyOnTeam) {
      res.status(409).json({ error: 'That account is already linked to a player in this team' });
      return;
    }

    const updated = await prisma.player.update({
      where: { id },
      data: { userId: user.id },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    res.json(updated);
  } catch (error) {
    console.error('Link player error:', error);
    res.status(500).json({ error: 'Failed to link player' });
  }
};

/**
 * Unlinks without touching the roster row: the player, their number and their
 * recorded games all stay, only the account association goes.
 */
export const unlinkPlayerFromUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const player = await prisma.player.findUnique({ where: { id }, select: { id: true } });
    if (!player) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }

    const updated = await prisma.player.update({ where: { id }, data: { userId: null } });
    res.json(updated);
  } catch (error) {
    console.error('Unlink player error:', error);
    res.status(500).json({ error: 'Failed to unlink player' });
  }
};

/**
 * Every roster spot the signed-in user holds. This is what lets a player who
 * manages nothing still have somewhere to land after logging in.
 */
export const getMyPlayerProfiles = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const players = await prisma.player.findMany({
      where: { userId: req.user!.id },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            logo: true,
            primaryColor: true,
            seasonTeams: {
              select: { season: { select: { id: true, name: true, status: true, startDate: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json(
      players.map(player => ({
        ...player,
        team: {
          ...player.team,
          seasons: player.team.seasonTeams.map(st => st.season),
          seasonTeams: undefined,
        },
      }))
    );
  } catch (error) {
    console.error('Get my player profiles error:', error);
    res.status(500).json({ error: 'Failed to fetch player profiles' });
  }
};
