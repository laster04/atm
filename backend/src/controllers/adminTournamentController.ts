import { Response } from 'express';
import { TournamentPlan } from '@prisma/client';
import prisma from '../config/database.js';
import { AuthRequest } from '../types/index.js';
import { recordAudit } from '../services/audit/record.js';
import { teamAllowance } from '../services/plans/tournamentPlan.js';

const TOURNAMENT_PLANS = Object.values(TournamentPlan);

/**
 * Sets a tournament's plan by hand, for support or before payments exist.
 * Lowering it removes no team: the limit only stops new ones. Every change
 * goes to the audit log with its reason.
 */
export const setTournamentPlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { plan, reason } = req.body ?? {};
    if (!TOURNAMENT_PLANS.includes(plan)) {
      res.status(400).json({ error: 'Unknown plan', code: 'INVALID_PLAN' });
      return;
    }
    const why = typeof reason === 'string' ? reason.trim().slice(0, 500) : '';

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.tournament.findUnique({ where: { id: req.params.id }, select: { id: true, name: true, plan: true } });
      if (!current) return null;
      if (current.plan !== plan) {
        await tx.tournament.update({ where: { id: current.id }, data: { plan } });
        await recordAudit({
          entityType: 'Tournament',
          entityId: current.id,
          action: 'UPDATE',
          before: { name: current.name, plan: current.plan },
          after: { name: current.name, plan },
          reason: why || null,
          actorId: req.user!.id,
        }, tx);
      }
      return current.id;
    });
    if (!result) {
      res.status(404).json({ error: 'Tournament not found' });
      return;
    }
    res.json(await teamAllowance(result));
  } catch (error) {
    console.error('Set tournament plan error:', error);
    res.status(500).json({ error: 'Failed to set the plan' });
  }
};
