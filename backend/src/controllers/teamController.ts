import { Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '../config/database.js';
import emailService from '../services/emailService.js';
import {
  AuthRequest,
  CreateTeamRequest,
  UpdateTeamRequest,
  InviteManagerRequest,
} from '../types/index.js';
import { Prisma } from '@prisma/client';

export const getMyTeams = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teams = await prisma.team.findMany({
      where: { managerId: req.user!.id },
      include: {
        season: {
          include: {
            league: { select: { id: true, name: true, sportType: true } }
          }
        },
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
        season: {
          include: {
            league: { select: { id: true, name: true, sportType: true } }
          }
        },
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
      (a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime()
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
    const { name, logo, managerId } = req.body as CreateTeamRequest;

    if (!name) {
      res.status(400).json({ error: 'Team name is required' });
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

    // Season managers can only add teams to their own leagues' seasons
    if (req.user!.role === 'SEASON_MANAGER' && season.league.managerId !== req.user!.id) {
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
    const { name, logo, managerId, primaryColor } = req.body as UpdateTeamRequest;

    const existingTeam = await prisma.team.findUnique({
      where: { id: parseInt(id) },
      include: { season: { include: { league: { select: { managerId: true } } } } }
    });

    if (!existingTeam) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    // Season managers can only update teams in their own leagues' seasons
    if (req.user!.role === 'SEASON_MANAGER' && existingTeam.season.league.managerId !== req.user!.id) {
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
        ...(primaryColor !== undefined && { primaryColor }),
        ...(managerId !== undefined && { managerId: managerId ? parseInt(managerId) : null }),
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
      include: { season: { include: { league: { select: { managerId: true } } } } }
    });

    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    // Season managers can only delete teams in their own leagues' seasons
    if (req.user!.role === 'SEASON_MANAGER' && team.season.league.managerId !== req.user!.id) {
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

export const inviteManager = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { email, name, locale } = req.body as InviteManagerRequest;

    if (!email || !name) {
      res.status(400).json({ error: 'Email and name are required' });
      return;
    }

    const team = await prisma.team.findUnique({ where: { id: parseInt(id) } });
    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({ error: 'A user with this email already exists' });
      return;
    }

    // Create user with random password and password reset token
    const randomPassword = crypto.randomBytes(32).toString('hex');
    const hashedPassword = await bcrypt.hash(randomPassword, 10);
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date();
    resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 1);

    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: 'TEAM_MANAGER',
        active: true,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        passwordResetToken: resetToken,
        passwordResetTokenExpiresAt: resetTokenExpiry,
      },
      select: { id: true, email: true, name: true, role: true },
    });

    // Assign as team manager
    const updatedTeam = await prisma.team.update({
      where: { id: parseInt(id) },
      data: { managerId: newUser.id },
      include: {
        season: {
          include: {
            league: { select: { id: true, name: true, sportType: true } }
          }
        },
        players: { orderBy: { number: 'asc' } },
        manager: { select: { id: true, name: true, email: true } },
        homeGames: {
          include: { awayTeam: { select: { id: true, name: true } } },
          orderBy: { date: 'asc' }
        },
        awayGames: {
          include: { homeTeam: { select: { id: true, name: true } } },
          orderBy: { date: 'asc' }
        }
      }
    });

    // Send invitation email
    emailService.sendManagerInviteEmail(email, name, team.name, resetToken, locale).catch((err) => {
      console.error('Failed to send manager invite email:', err);
    });

    const allGames = [...updatedTeam.homeGames, ...updatedTeam.awayGames].sort(
      (a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime()
    );

    res.status(201).json({ ...updatedTeam, games: allGames });
  } catch (error) {
    console.error('Invite manager error:', error);
    res.status(500).json({ error: 'Failed to invite manager' });
  }
};
