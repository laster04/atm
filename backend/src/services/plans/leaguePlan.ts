import type { LeaguePlanBand, Prisma, SeasonPlan } from '@prisma/client';
import prisma, { type DbClient } from '../../config/database.js';
import { leaguePlansEnabled, limitAt, type Plan } from '../pricing/catalog.js';
import { lockCompetition } from './tournamentPlan.js';

/**
 * The League plan (decided 5 and 16 Nov 2026, canvas page 9).
 *
 * Every organiser account gets one league and its first season free (TRIAL).
 * After that a league pays a yearly plan, in two bands by team count. Leagues
 * that were in ATM before the plan existed are free until League.freeUntil,
 * and an admin may set that date for any league. The whole paywall waits for
 * an admin switch (app_settings.league_plans); while it is off every new
 * season is FREE.
 *
 * Each season's cover is decided once, when it is created, and stored in
 * Season.plan. Only UNPAID ever changes (to LEAGUE, once the plan is paid), so
 * a running season always finishes in the plan it started in and published
 * pages are never hidden again. An UNPAID season can be set up in full, but
 * stays out of public view, sends no e-mails to players and confirms no
 * results (decision 6).
 */

/** The free season may run at most this long from the day it is created. */
export const TRIAL_MAX_MONTHS = 12;

export const BAND_PLAN: Record<LeaguePlanBand, Plan> = { SMALL: 'LEAGUE_SMALL', LARGE: 'LEAGUE_LARGE' };
export const BAND_PRODUCT: Record<LeaguePlanBand, string> = { SMALL: 'LEAGUE_SMALL_YEAR', LARGE: 'LEAGUE_LARGE_YEAR' };
export const PRODUCT_BAND: Record<string, LeaguePlanBand> = { LEAGUE_SMALL_YEAR: 'SMALL', LEAGUE_LARGE_YEAR: 'LARGE' };
export const BAND_RANK: Record<LeaguePlanBand, number> = { SMALL: 0, LARGE: 1 };

const addMonths = (from: Date, months: number) => {
  const to = new Date(from);
  to.setUTCMonth(to.getUTCMonth() + months);
  return to;
};

/** The last moment a free season created at `createdAt` may end. */
export const trialEndLimit = (createdAt: Date) => addMonths(createdAt, TRIAL_MAX_MONTHS);

export class TrialTooLongError extends Error {
  readonly code = 'TRIAL_TOO_LONG';

  constructor(public readonly latestEnd: Date) {
    super(`The free season may end on ${latestEnd.toISOString().slice(0, 10)} at the latest.`);
  }
}

/** A season waiting for its League plan was asked to do something only a paid season may. */
export class PlanRequiredError extends Error {
  readonly code = 'PLAN_REQUIRED';

  constructor(public readonly seasonId: string, public readonly leagueId: string) {
    super('This season waits for the League plan to be paid.');
  }
}

export const planRequiredBody = (error: PlanRequiredError) => ({
  error: error.message,
  code: error.code,
  seasonId: error.seasonId,
  leagueId: error.leagueId,
});

/** A season of a SMALL plan has no place for another team. */
export class SeasonTeamLimitError extends Error {
  readonly code = 'PLAN_LIMIT';

  constructor(public readonly limit: number, public readonly teams: number, public readonly leagueId: string) {
    super(`The League plan for up to ${limit} teams is full.`);
  }
}

export const seasonTeamLimitBody = (error: SeasonTeamLimitError) => ({
  error: error.message,
  code: error.code,
  plan: 'LEAGUE_SMALL',
  limit: error.limit,
  teams: error.teams,
  leagueId: error.leagueId,
});

export interface RunningLeaguePlan {
  band: LeaguePlanBand;
  /** When the plan ends, counting a renewal that follows on from it. */
  until: Date;
}

/** The league's plan running at `at`, chained through renewals; null when none runs. */
export async function runningLeaguePlan(leagueId: string, at: Date = new Date(), tx: DbClient = prisma): Promise<RunningLeaguePlan | null> {
  const plans = await tx.leaguePlan.findMany({
    where: { leagueId, validUntil: { gt: at } },
    orderBy: { validFrom: 'asc' },
    select: { band: true, validFrom: true, validUntil: true },
  });
  let band: LeaguePlanBand | null = null;
  let until: Date | null = null;
  for (const plan of plans) {
    if (plan.validFrom > (until ?? at)) break;
    // The band in force now is the highest of the plans that have started;
    // an upgrade mid-year is its own row covering the rest of that year.
    if (plan.validFrom <= at && (!band || BAND_RANK[plan.band] > BAND_RANK[band])) band = plan.band;
    if (!until || plan.validUntil > until) until = plan.validUntil;
  }
  return band && until ? { band, until } : null;
}

/**
 * How a new season of the league is covered. Claims the manager's free season
 * when it applies, so call it inside the transaction that creates the season.
 */
export async function seasonCoverage(
  tx: Prisma.TransactionClient,
  input: { leagueId: string; endDate: Date; at?: Date },
): Promise<SeasonPlan> {
  const at = input.at ?? new Date();
  if (!(await leaguePlansEnabled(tx))) return 'FREE';

  const league = await tx.league.findUnique({
    where: { id: input.leagueId },
    select: { freeUntil: true, managerId: true, _count: { select: { seasons: true } } },
  });
  if (!league) return 'UNPAID';
  if (league.freeUntil && league.freeUntil > at) return 'FREE';
  if (await runningLeaguePlan(input.leagueId, at, tx)) return 'LEAGUE';

  // One free season per organiser account: the first season of a league whose
  // manager has not had theirs yet.
  if (league.managerId && league._count.seasons === 0) {
    const claimed = await tx.user.updateMany({
      where: { id: league.managerId, leagueTrialUsedAt: null },
      data: { leagueTrialUsedAt: at },
    });
    if (claimed.count === 1) {
      const latestEnd = trialEndLimit(at);
      if (input.endDate > latestEnd) throw new TrialTooLongError(latestEnd);
      return 'TRIAL';
    }
  }
  return 'UNPAID';
}

/** Throws PlanRequiredError when the season waits for its League plan. */
export async function assertSeasonPaid(seasonId: string, tx: DbClient = prisma): Promise<void> {
  const season = await tx.season.findUnique({ where: { id: seasonId }, select: { plan: true, leagueId: true } });
  if (season?.plan === 'UNPAID') throw new PlanRequiredError(seasonId, season.leagueId);
}

/** The error to answer with when the season waits for its League plan; null when it may go on. */
export async function unpaidSeason(seasonId: string, tx: DbClient = prisma): Promise<PlanRequiredError | null> {
  const season = await tx.season.findUnique({ where: { id: seasonId }, select: { plan: true, leagueId: true } });
  return season?.plan === 'UNPAID' ? new PlanRequiredError(seasonId, season.leagueId) : null;
}

/**
 * The team limit of a season: only a season covered by a SMALL League plan has
 * one, and only while the league's plan is still SMALL. null is no limit.
 */
export async function seasonTeamLimit(seasonId: string, tx: DbClient = prisma, at: Date = new Date()): Promise<{ limit: number | null; teams: number; leagueId: string } | null> {
  const season = await tx.season.findUnique({
    where: { id: seasonId },
    select: { plan: true, leagueId: true, _count: { select: { seasonTeams: true } } },
  });
  if (!season) return null;
  const teams = season._count.seasonTeams;
  if (season.plan !== 'LEAGUE') return { limit: null, teams, leagueId: season.leagueId };
  const running = await runningLeaguePlan(season.leagueId, at, tx);
  const band = running?.band ?? (await lastBand(season.leagueId, tx));
  const limit = band ? ((await limitAt(BAND_PLAN[band], 'TEAMS_PER_SEASON', at, tx)) ?? null) : null;
  return { limit, teams, leagueId: season.leagueId };
}

const lastBand = async (leagueId: string, tx: DbClient): Promise<LeaguePlanBand | null> =>
  (await tx.leaguePlan.findFirst({ where: { leagueId }, orderBy: { validUntil: 'desc' }, select: { band: true } }))?.band ?? null;

/**
 * Inside a transaction, before adding teams to a season: locks the season
 * and throws SeasonTeamLimitError when its League plan has no place left.
 */
export async function assertSeasonTeamSlot(tx: Prisma.TransactionClient, seasonId: string, adding = 1): Promise<void> {
  await lockCompetition(tx, 'season', seasonId);
  const allowance = await seasonTeamLimit(seasonId, tx);
  if (allowance && allowance.limit !== null && allowance.teams + adding > allowance.limit) {
    throw new SeasonTeamLimitError(allowance.limit, allowance.teams, allowance.leagueId);
  }
}

/** The smallest band that fits a season of this many teams. */
export async function bandFor(teams: number, at: Date = new Date(), tx: DbClient = prisma): Promise<LeaguePlanBand> {
  const small = await limitAt('LEAGUE_SMALL', 'TEAMS_PER_SEASON', at, tx);
  return small === null || small === undefined || teams <= small ? 'SMALL' : 'LARGE';
}

/** Turns the league's waiting seasons into covered ones, once its plan is paid or granted. */
export async function coverWaitingSeasons(tx: Prisma.TransactionClient, leagueId: string): Promise<number> {
  const updated = await tx.season.updateMany({ where: { leagueId, plan: 'UNPAID' }, data: { plan: 'LEAGUE' } });
  return updated.count;
}

/** What the league's manager sees about its plan. */
export async function leaguePlanStatus(leagueId: string, tx: DbClient = prisma, at: Date = new Date()) {
  const league = await tx.league.findUnique({
    where: { id: leagueId },
    select: { id: true, freeUntil: true, managerId: true, manager: { select: { leagueTrialUsedAt: true } } },
  });
  if (!league) return null;
  const [enabled, running, waiting] = await Promise.all([
    leaguePlansEnabled(tx),
    runningLeaguePlan(leagueId, at, tx),
    tx.season.findMany({ where: { leagueId, plan: 'UNPAID' }, select: { id: true, name: true, _count: { select: { seasonTeams: true } } } }),
  ]);
  return {
    enabled,
    freeUntil: league.freeUntil && league.freeUntil > at ? league.freeUntil : null,
    plan: running,
    waitingSeasons: waiting.map((season) => ({ id: season.id, name: season.name, teams: season._count.seasonTeams })),
    trialAvailable: !!league.managerId && !league.manager?.leagueTrialUsedAt,
  };
}
