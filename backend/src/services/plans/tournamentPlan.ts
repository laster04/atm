import type { Prisma, TournamentPlan } from '@prisma/client';
import prisma, { type DbClient } from '../../config/database.js';
import { limitAt, type Plan } from '../pricing/catalog.js';

/**
 * Which plan a tournament runs on and how many teams it may take (celek B).
 *
 * A tournament has its own plan (FREE until paid for). While the series
 * manager holds a running Organizer plan, every tournament in their series
 * runs on ORGANIZER instead. When that plan ends nothing is removed: teams
 * already in stay, the limit only stops new ones.
 */

export interface TeamAllowance {
  /** The plan the limit comes from: the tournament's own, or ORGANIZER. */
  plan: Plan;
  /** What the tournament itself was set to or paid for. */
  ownPlan: TournamentPlan;
  /** Teams the plan allows; null is unlimited. */
  limit: number | null;
  teams: number;
  /** When the series manager's Organizer plan ends, while one runs. */
  organizerUntil: Date | null;
  /**
   * A plan paid for and waiting for ATM to confirm the transfer. Applications
   * may fill its places meanwhile; approving past `limit` waits for it.
   */
  pending: { paymentId: string; plan: Plan; limit: number | null } | null;
}

/** The plan a paid product unlocks. */
export const PRODUCT_PLAN: Record<string, Plan> = {
  TOURNAMENT: 'TOURNAMENT',
  TOURNAMENT_PLUS: 'TOURNAMENT_PLUS',
  ORGANIZER_YEAR: 'ORGANIZER',
};

/** Places applications may take: the paid limit, or the pending plan's when it is higher. */
export function capacityLimit(allowance: TeamAllowance | null): number | null {
  if (!allowance) return null;
  if (!allowance.pending) return allowance.limit;
  if (allowance.limit === null || allowance.pending.limit === null) return null;
  return Math.max(allowance.limit, allowance.pending.limit);
}

export class PlanLimitError extends Error {
  readonly code = 'PLAN_LIMIT';

  constructor(public readonly allowance: TeamAllowance) {
    super(`The ${allowance.plan} plan takes at most ${allowance.limit} teams.`);
  }
}

/** The body every endpoint answers a PlanLimitError with, under 409. */
export const planLimitBody = (error: PlanLimitError) => ({
  error: error.message,
  code: error.code,
  plan: error.allowance.plan,
  limit: error.allowance.limit,
  teams: error.allowance.teams,
  pending: error.allowance.pending,
});

/**
 * When the user's Organizer plan running at `at` ends, counting a renewal
 * that follows on from it; null when none runs.
 */
export async function organizerPlanUntil(userId: string, at: Date = new Date(), tx: DbClient = prisma): Promise<Date | null> {
  const plans = await tx.organizerPlan.findMany({
    where: { userId, validUntil: { gt: at } },
    orderBy: { validFrom: 'asc' },
    select: { validFrom: true, validUntil: true },
  });
  let until: Date | null = null;
  for (const plan of plans) {
    if (plan.validFrom > (until ?? at)) break;
    until = plan.validUntil;
  }
  return until;
}

/** Whether the user holds an Organizer plan running at `at`. */
export async function hasOrganizerPlan(userId: string, at: Date = new Date(), tx: DbClient = prisma): Promise<boolean> {
  return (await organizerPlanUntil(userId, at, tx)) !== null;
}

/** The tournament's plan, its team limit and its teams now; null if it does not exist. */
export async function teamAllowance(tournamentId: string, tx: DbClient = prisma, at: Date = new Date()): Promise<TeamAllowance | null> {
  const tournament = await tx.tournament.findUnique({
    where: { id: tournamentId },
    select: { plan: true, series: { select: { managerId: true } }, _count: { select: { teams: true } } },
  });
  if (!tournament) return null;

  const managerId = tournament.series.managerId;
  const organizerUntil = managerId ? await organizerPlanUntil(managerId, at, tx) : null;
  const plan: Plan = organizerUntil ? 'ORGANIZER' : tournament.plan;
  const limit = await teamLimit(plan, at, tx);

  const payment = await tx.payment.findFirst({
    where: { tournamentId, status: 'PENDING' },
    select: { id: true, productCode: true },
  });
  const pendingPlan = payment ? PRODUCT_PLAN[payment.productCode] : undefined;
  const pending = payment && pendingPlan
    ? { paymentId: payment.id, plan: pendingPlan, limit: await teamLimit(pendingPlan, at, tx) }
    : null;
  return { plan, ownPlan: tournament.plan, limit, teams: tournament._count.teams, organizerUntil, pending };
}

// A limit nobody ever set is no limit; the pricing migration sets all of them.
const teamLimit = async (plan: Plan, at: Date, tx: DbClient) => (await limitAt(plan, 'TEAMS_PER_TOURNAMENT', at, tx)) ?? null;

/**
 * Locks the competition's row until the transaction ends, so whatever adds a
 * team to it runs one at a time and counts what the one before it added.
 */
export async function lockCompetition(tx: Prisma.TransactionClient, kind: 'season' | 'tournament', id: string): Promise<void> {
  if (kind === 'season') await tx.$queryRaw`SELECT id FROM seasons WHERE id = ${id} FOR UPDATE`;
  else await tx.$queryRaw`SELECT id FROM tournaments WHERE id = ${id} FOR UPDATE`;
}

/**
 * Inside a transaction, before adding one team: locks the tournament and
 * throws PlanLimitError when its plan has no place left.
 */
export async function assertTeamSlot(tx: Prisma.TransactionClient, tournamentId: string): Promise<TeamAllowance | null> {
  await lockCompetition(tx, 'tournament', tournamentId);
  const allowance = await teamAllowance(tournamentId, tx);
  if (allowance && allowance.limit !== null && allowance.teams >= allowance.limit) throw new PlanLimitError(allowance);
  return allowance;
}
