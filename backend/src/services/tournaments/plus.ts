import prisma from '../../config/database.js';
import { limitAt, type Plan } from '../pricing/catalog.js';
import { teamAllowance } from '../plans/tournamentPlan.js';

/**
 * Turnaj Plus (celek C): sponsor logos, documents and a lighter ATM brand.
 * What a tournament may have comes from the plan it runs on now: its own, or
 * the series manager's Organizátor while that lasts. When a plan ends nothing
 * is removed; only adding more stops.
 */

/** Plans whose public pages and e-mails carry only a small "Běží na ATM" credit. */
const LIGHT_PLANS: readonly Plan[] = ['TOURNAMENT_PLUS', 'ORGANIZER'];

export type Branding = 'FULL' | 'LIGHT';

export const brandingFor = (plan: Plan | null | undefined): Branding =>
  plan && LIGHT_PLANS.includes(plan) ? 'LIGHT' : 'FULL';

export class PlanFeatureError extends Error {
  readonly code = 'PLAN_FEATURE';

  constructor(
    public readonly feature: 'SPONSOR_LOGOS' | 'DOCUMENTS' | 'DOCUMENT_SIZE',
    public readonly plan: Plan,
    public readonly limit: number | null
  ) {
    super(`The ${plan} plan does not allow more ${feature.toLowerCase().replace('_', ' ')}`);
  }
}

/** The body every endpoint answers a PlanFeatureError with, under 409 (413 for a size). */
export const planFeatureBody = (error: PlanFeatureError) => ({
  error: error.message,
  code: error.code,
  feature: error.feature,
  plan: error.plan,
  limit: error.limit,
});

/** The tournament's plan, what it allows and what it uses; null if there is no such tournament. */
export async function plusAllowance(tournamentId: string) {
  const allowance = await teamAllowance(tournamentId);
  if (!allowance) return null;
  const { plan } = allowance;
  const [sponsorLimit, documentLimit, documentMaxMb, sponsors, documents] = await Promise.all([
    limitAt(plan, 'SPONSOR_LOGOS'),
    limitAt(plan, 'DOCUMENTS'),
    limitAt(plan, 'DOCUMENT_MAX_MB'),
    prisma.tournamentSponsor.count({ where: { tournamentId } }),
    prisma.tournamentDocument.count({ where: { tournamentId } }),
  ]);
  return {
    plan,
    branding: brandingFor(plan),
    // A limit never set counts as none allowed: these are paid features.
    sponsors: { limit: sponsorLimit ?? 0, used: sponsors },
    documents: { limit: documentLimit ?? 0, used: documents, maxMb: documentMaxMb ?? 0 },
  };
}

export type PlusAllowance = NonNullable<Awaited<ReturnType<typeof plusAllowance>>>;

/** What the public tournament page shows: partners, documents and how much ATM brand. */
export async function publicExtras(tournamentId: string, plan: Plan | null) {
  const [sponsors, documents] = await Promise.all([
    prisma.tournamentSponsor.findMany({
      where: { tournamentId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, url: true, logo: true },
    }),
    prisma.tournamentDocument.findMany({
      where: { tournamentId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, title: true, file: { select: { size: true } } },
    }),
  ]);
  return {
    sponsors,
    documents: documents.map((doc) => ({ id: doc.id, title: doc.title, size: doc.file.size })),
    branding: brandingFor(plan),
  };
}
