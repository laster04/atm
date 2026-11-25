import { Response } from 'express';
import type { LeaguePlanBand } from '@prisma/client';
import prisma from '../config/database.js';
import { AuthRequest } from '../types/index.js';
import emailService from '../services/emailService.js';
import { recordAudit } from '../services/audit/record.js';
import { CURRENCIES, leaguePlansEnabled, setLeaguePlansEnabled, type Currency } from '../services/pricing/catalog.js';
import { coverWaitingSeasons } from '../services/plans/leaguePlan.js';
import {
  createLeaguePayment,
  leaguePlanView,
  paymentView,
  sendPaymentInstructions,
  PaymentError,
  type LeagueOfferKind,
  type PaymentWithRelations,
} from '../services/payments/payments.js';

/**
 * The League plan: the league manager's view and payment (league access is
 * checked by the routes), and the admin's switch, waiver and manual grant.
 */

const BANDS: LeaguePlanBand[] = ['SMALL', 'LARGE'];
const KINDS: LeagueOfferKind[] = ['NEW', 'UPGRADE', 'RENEWAL'];

const answerError = (res: Response, error: unknown, fallback: string, log: string): void => {
  if (error instanceof PaymentError) {
    res.status(error.status).json({ error: error.message, code: error.code });
    return;
  }
  console.error(log, error);
  res.status(500).json({ error: fallback });
};

/** GET /api/leagues/:id/plan: cover, waiting seasons, offers and the payment waiting. */
export const getLeaguePlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const view = await leaguePlanView(req.params.id, req.user!.locale);
    if (!view) { res.status(404).json({ error: 'League not found' }); return; }
    res.json(view);
  } catch (error) {
    answerError(res, error, 'Failed to fetch the plan', 'Get league plan error:');
  }
};

const notifyAdmins = (payment: PaymentWithRelations): void => {
  void (async () => {
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN', active: true }, select: { email: true } });
    const view = paymentView(payment);
    await Promise.all(admins.map((admin) => emailService.sendPaymentNoticeEmail({
      to: admin.email,
      variableSymbol: view.variableSymbol,
      productName: view.productName.cs,
      tournamentName: null,
      leagueName: view.league?.name ?? null,
      payerEmail: view.payer?.email ?? null,
      amount: view.amount,
      currency: view.currency,
    })));
  })().catch((error) => console.error('Payment notice email error:', error));
};

/** POST /api/leagues/:id/payments { band, kind, currency, immediateStart } */
export const startLeaguePayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { band, kind, currency, immediateStart } = req.body ?? {};
    if (!BANDS.includes(band) || !KINDS.includes(kind) || !CURRENCIES.includes(currency)) {
      res.status(400).json({ error: 'Choose a plan and a currency', code: 'INVALID_INPUT' });
      return;
    }
    if (immediateStart !== true) {
      res.status(400).json({ error: 'Confirm that the plan should start at once', code: 'IMMEDIATE_START_REQUIRED' });
      return;
    }
    if (!(await leaguePlansEnabled())) {
      res.status(409).json({ error: 'League plans are not on sale yet', code: 'NOT_OFFERED' });
      return;
    }
    const payment = await createLeaguePayment({
      leagueId: req.params.id,
      payerId: req.user!.id,
      band: band as LeaguePlanBand,
      kind: kind as LeagueOfferKind,
      currency: currency as Currency,
      immediateStartConsentAt: new Date(),
    });
    notifyAdmins(payment);
    sendPaymentInstructions(payment);
    res.status(201).json(paymentView(payment));
  } catch (error) {
    answerError(res, error, 'Failed to start the payment', 'Start league payment error:');
  }
};

const reasonOf = (value: unknown) => (typeof value === 'string' ? value.trim().slice(0, 500) : '') || null;

/** PUT /api/admin/pricing/league-plans { enabled, reason }: only the pricing manager. */
export const setLeaguePlansSwitch = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { enabled, reason } = req.body ?? {};
    if (typeof enabled !== 'boolean') { res.status(400).json({ error: 'enabled must be true or false' }); return; }
    await prisma.$transaction(async (tx) => {
      const before = await leaguePlansEnabled(tx);
      if (before === enabled) return;
      await setLeaguePlansEnabled(enabled, tx);
      await recordAudit({
        entityType: 'Setting',
        entityId: 'league_plans',
        action: 'UPDATE',
        before: { name: 'league_plans', enabled: before },
        after: { name: 'league_plans', enabled },
        reason: reasonOf(reason),
        actorId: req.user!.id,
      }, tx);
    });
    res.json({ enabled });
  } catch (error) {
    console.error('Set league plans switch error:', error);
    res.status(500).json({ error: 'Failed to change the setting' });
  }
};

const isDate = (value: unknown): value is string => typeof value === 'string' && !Number.isNaN(Date.parse(value));

/**
 * PUT /api/admin/leagues/:id/plan
 *   { freeUntil: ISO | null, reason }            waiver or founding deal
 *   { grant: { band, until: ISO }, reason }      a plan without a payment
 * Either way the change is audited; a grant also covers seasons waiting for it.
 */
export const setLeaguePlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { freeUntil, grant, reason } = req.body ?? {};
    const why = reasonOf(reason);
    if (freeUntil !== undefined && freeUntil !== null && !isDate(freeUntil)) {
      res.status(400).json({ error: 'freeUntil must be a date or null' }); return;
    }
    if (grant !== undefined && (!BANDS.includes(grant?.band) || !isDate(grant?.until) || new Date(grant.until) <= new Date())) {
      res.status(400).json({ error: 'A grant needs a band and a future end date' }); return;
    }
    if (freeUntil === undefined && grant === undefined) { res.status(400).json({ error: 'Nothing to change' }); return; }

    const done = await prisma.$transaction(async (tx) => {
      const league = await tx.league.findUnique({ where: { id: req.params.id }, select: { id: true, name: true, freeUntil: true } });
      if (!league) return false;
      if (freeUntil !== undefined) {
        const value = freeUntil === null ? null : new Date(freeUntil);
        await tx.league.update({ where: { id: league.id }, data: { freeUntil: value } });
        await recordAudit({
          entityType: 'League',
          entityId: league.id,
          action: 'UPDATE',
          before: { name: league.name, freeUntil: league.freeUntil },
          after: { name: league.name, freeUntil: value },
          reason: why,
          actorId: req.user!.id,
        }, tx);
      }
      if (grant !== undefined) {
        const plan = await tx.leaguePlan.create({
          data: { leagueId: league.id, band: grant.band, validFrom: new Date(), validUntil: new Date(grant.until), grantedById: req.user!.id },
        });
        const covered = await coverWaitingSeasons(tx, league.id);
        await recordAudit({
          entityType: 'League',
          entityId: league.id,
          action: 'CREATE',
          after: { name: league.name, leaguePlan: plan.band, validUntil: plan.validUntil, coveredSeasons: covered },
          reason: why,
          actorId: req.user!.id,
        }, tx);
      }
      return true;
    });
    if (!done) { res.status(404).json({ error: 'League not found' }); return; }
    res.json(await leaguePlanView(req.params.id));
  } catch (error) {
    console.error('Set league plan error:', error);
    res.status(500).json({ error: 'Failed to set the plan' });
  }
};
