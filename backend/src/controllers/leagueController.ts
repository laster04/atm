import { Request, Response } from 'express';
import prisma from '../config/database.js';
import emailService from '../services/emailService.js';
import { resolveInvitee } from '../services/invite.js';
import { normalizeEmail } from '../utils/email.js';
import { toNullableId } from '../utils/ids.js';
import { isAdmin } from '../services/access.js';
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
      where: { id: id },
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

    // The creator owns the league; only an admin may hand it to someone else.
    // TODO(free-tier): cap how many leagues a non-admin may own once quotas land.
    const managerId = isAdmin(req.user!) ? (toNullableId(req.body.managerId) ?? null) : req.user!.id;

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

    const league = await prisma.league.update({
      where: { id: id },
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
      where: { id: id },
      include: { _count: { select: { seasons: true } } }
    });
    if (!league) {
      res.status(404).json({ error: 'League not found' });
      return;
    }

    // No one can delete a league that still has seasons, regardless of role
    if (league._count.seasons > 0) {
      res.status(403).json({ error: 'Cannot delete a league with existing seasons' });
      return;
    }

    await prisma.league.delete({ where: { id: id } });
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
    const { email: rawEmail, name, locale } = req.body as InviteManagerRequest;

    if (!rawEmail || !name) {
      res.status(400).json({ error: 'Email and name are required' });
      return;
    }

    const email = normalizeEmail(rawEmail);

    const league = await prisma.league.findUnique({ where: { id: id } });
    if (!league) {
      res.status(404).json({ error: 'League not found' });
      return;
    }

    const invitee = await resolveInvitee(email, name);

    // Assign as league manager
    const updatedLeague = await prisma.league.update({
      where: { id: id },
      data: { managerId: invitee.id },
      include: {
        _count: { select: { seasons: true } },
        manager: { select: { id: true, name: true, email: true } }
      }
    });

    // Only a freshly created account needs the set-your-password link; an
    // existing user just gains the relation.
    if (invitee.resetToken) {
      emailService.sendLeagueManagerInviteEmail(email, name, league.name, invitee.resetToken, locale).catch((err) => {
        console.error('Failed to send league manager invite email:', err);
      });
    }

    res.status(201).json(updatedLeague);
  } catch (error) {
    console.error('Invite league manager error:', error);
    res.status(500).json({ error: 'Failed to invite manager' });
  }
};
