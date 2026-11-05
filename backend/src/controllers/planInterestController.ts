import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/database.js';
import { AuthRequest } from '../types/index.js';

/** Plans that are shown on the price list before they are on sale. */
const PLANS = ['LEAGUE'] as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LEAGUE_NAME_MAX = 120;
const TEAM_COUNT_MAX = 500;

// ---------------------------------------------------------------- rate limit

/**
 * New rows per address per window. Filling in the contact form updates the
 * row the click made, so it does not count again. Kept in process memory, like
 * the contact form's limit.
 */
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const recentByIp = new Map<string, number[]>();

const overRateLimit = (ip: string, now = Date.now()): boolean => {
  const recent = (recentByIp.get(ip) ?? []).filter((at) => now - at < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    recentByIp.set(ip, recent);
    return true;
  }
  recent.push(now);
  recentByIp.set(ip, recent);
  return false;
};

/** For tests: forget every address. */
export const resetPlanInterestRateLimit = (): void => recentByIp.clear();

// ---------------------------------------------------------------- handlers

/**
 * POST /api/billing/interest — anyone: "I would want this plan".
 *
 * The click sends only the plan and a token; the optional contact form that
 * follows sends the same token with an email, league name and team count,
 * which fill in that row. A retry with the same token never adds a second row.
 */
export const registerPlanInterest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { plan, clientToken, email, leagueName, teamCount, website } = req.body ?? {};

    // Honeypot: hidden from people, so anything in it is a bot. Same answer
    // as for a person, so it has nothing to learn from.
    if (typeof website === 'string' && website.trim() !== '') {
      res.status(202).json({ received: true });
      return;
    }

    const errors: Record<string, string> = {};
    if (!PLANS.includes(plan)) errors.plan = 'invalid';
    if (typeof clientToken !== 'string' || clientToken.length < 8 || clientToken.length > 100) errors.clientToken = 'invalid';

    const cleanEmail = typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null;
    if (cleanEmail && (cleanEmail.length > 254 || !EMAIL_PATTERN.test(cleanEmail))) errors.email = 'invalid';
    const cleanLeague = typeof leagueName === 'string' && leagueName.trim() ? leagueName.trim() : null;
    if (cleanLeague && cleanLeague.length > LEAGUE_NAME_MAX) errors.leagueName = 'invalid';
    const cleanTeams = teamCount === undefined || teamCount === null || teamCount === '' ? null : Number(teamCount);
    if (cleanTeams !== null && (!Number.isInteger(cleanTeams) || cleanTeams < 1 || cleanTeams > TEAM_COUNT_MAX)) {
      errors.teamCount = 'invalid';
    }

    if (Object.keys(errors).length) {
      res.status(400).json({ error: 'Invalid request', fields: errors });
      return;
    }

    // Only the fields that were sent: the click must not wipe a contact the
    // form already left, whichever request arrives last.
    const contact = {
      ...(cleanEmail ? { email: cleanEmail } : {}),
      ...(cleanLeague ? { leagueName: cleanLeague } : {}),
      ...(cleanTeams !== null ? { teamCount: cleanTeams } : {}),
      ...(req.user ? { userId: req.user.id } : {}),
    };

    const existing = await prisma.planInterest.findUnique({ where: { clientToken }, select: { id: true } });
    if (existing) {
      await prisma.planInterest.update({ where: { id: existing.id }, data: contact });
      res.status(200).json({ received: true });
      return;
    }

    if (overRateLimit(req.ip ?? 'unknown')) {
      res.status(429).json({ error: 'Too many requests. Please try again later.' });
      return;
    }

    try {
      await prisma.planInterest.create({ data: { plan, clientToken, ...contact } });
    } catch (error) {
      // The click and the form racing each other: the loser updates the winner's row.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        await prisma.planInterest.update({ where: { clientToken }, data: contact });
        res.status(200).json({ received: true });
        return;
      }
      throw error;
    }

    res.status(201).json({ received: true });
  } catch (error) {
    console.error('Register plan interest error:', error);
    res.status(500).json({ error: 'Failed to record interest' });
  }
};

/**
 * GET /api/admin/plan-interest — how many people asked for a plan not on sale
 * yet, and the ones who left a way to reach them, newest first.
 */
export const getPlanInterest = async (_req: Request, res: Response): Promise<void> => {
  try {
    const plan = 'LEAGUE';
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const withContact: Prisma.PlanInterestWhereInput = {
      plan,
      OR: [{ email: { not: null } }, { userId: { not: null } }],
    };

    const [total, last30Days, contacts, leads] = await Promise.all([
      prisma.planInterest.count({ where: { plan } }),
      prisma.planInterest.count({ where: { plan, createdAt: { gte: since } } }),
      prisma.planInterest.count({ where: withContact }),
      prisma.planInterest.findMany({
        where: withContact,
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          email: true,
          leagueName: true,
          teamCount: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);

    res.json({ plan, total, last30Days, contacts, leads });
  } catch (error) {
    console.error('Plan interest overview error:', error);
    res.status(500).json({ error: 'Failed to load plan interest' });
  }
};
