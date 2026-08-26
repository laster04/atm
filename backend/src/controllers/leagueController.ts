import { Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '../config/database.js';
import emailService from '../services/emailService.js';
import {
  AuthRequest,
  CreateLeagueRequest,
  UpdateLeagueRequest,
  InviteManagerRequest,
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
            _count: { select: { seasonTeams: true, games: true } }
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

    const league = await prisma.league.findUnique({
      where: { id: parseInt(id) },
      include: { _count: { select: { seasons: true } } }
    });
    if (!league) {
      res.status(404).json({ error: 'League not found' });
      return;
    }

    // Season managers can only delete their own leagues
    if (req.user!.role === 'SEASON_MANAGER' && league.managerId !== req.user!.id) {
      res.status(403).json({ error: 'Not authorized to delete this league' });
      return;
    }

    // No one can delete a league that still has seasons, regardless of role
    if (league._count.seasons > 0) {
      res.status(403).json({ error: 'Cannot delete a league with existing seasons' });
      return;
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

export const inviteManager = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { email, name, locale } = req.body as InviteManagerRequest;

    if (!email || !name) {
      res.status(400).json({ error: 'Email and name are required' });
      return;
    }

    const league = await prisma.league.findUnique({ where: { id: parseInt(id) } });
    if (!league) {
      res.status(404).json({ error: 'League not found' });
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
        role: 'SEASON_MANAGER',
        active: true,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        passwordResetToken: resetToken,
        passwordResetTokenExpiresAt: resetTokenExpiry,
      },
      select: { id: true, email: true, name: true, role: true },
    });

    // Assign as league manager
    const updatedLeague = await prisma.league.update({
      where: { id: parseInt(id) },
      data: { managerId: newUser.id },
      include: {
        _count: { select: { seasons: true } },
        manager: { select: { id: true, name: true, email: true } }
      }
    });

    // Send invitation email
    emailService.sendLeagueManagerInviteEmail(email, name, league.name, resetToken, locale).catch((err) => {
      console.error('Failed to send league manager invite email:', err);
    });

    res.status(201).json(updatedLeague);
  } catch (error) {
    console.error('Invite league manager error:', error);
    res.status(500).json({ error: 'Failed to invite manager' });
  }
};
