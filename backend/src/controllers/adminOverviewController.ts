import { Response } from 'express';
import prisma from '../config/database.js';
import { AuthRequest } from '../types/index.js';

const DAY_MS = 24 * 60 * 60 * 1000;
/** An application nobody answered for this long shows in the admin's queue. */
export const STALE_REGISTRATION_DAYS = 7;
const PERIOD_DAYS = 30;

/**
 * GET /api/admin/overview — what waits for an admin, and a few numbers for the
 * last 30 days. Payments join the queues with celek B.
 */
export const getOverview = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const since = new Date(now.getTime() - PERIOD_DAYS * DAY_MS);
    const staleBefore = new Date(now.getTime() - STALE_REGISTRATION_DAYS * DAY_MS);
    const playedRecently = { date: { gte: since, lte: now } };

    const [openTickets, staleRegistrations, newUsers, activeLeagues, activeTournaments] = await Promise.all([
      // WAITING_FOR_USER is the sender's move, not ours.
      prisma.supportTicket.count({ where: { status: { in: ['NEW', 'IN_PROGRESS'] } } }),
      prisma.registration.count({ where: { status: 'PENDING', createdAt: { lt: staleBefore } } }),
      prisma.user.count({ where: { createdAt: { gte: since } } }),
      prisma.league.count({ where: { seasons: { some: { games: { some: playedRecently } } } } }),
      prisma.tournament.count({ where: { games: { some: playedRecently } } }),
    ]);

    res.json({
      queues: { payments: null, openTickets, staleRegistrations },
      last30Days: { newUsers, activeLeagues, activeTournaments },
    });
  } catch (error) {
    console.error('Admin overview error:', error);
    res.status(500).json({ error: 'Failed to load the overview' });
  }
};
