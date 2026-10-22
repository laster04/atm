import { Prisma, type Payment, type TournamentPlan } from '@prisma/client';
import prisma, { type DbClient } from '../../config/database.js';
import { recordAudit } from '../audit/record.js';
import { limitAt, priceAt, quote, type Currency, type Plan, type PriceSnapshot } from '../pricing/catalog.js';
import { splitGross } from '../pricing/vat.js';
import { lockCompetition, organizerPlanUntil, PRODUCT_PLAN, teamAllowance } from '../plans/tournamentPlan.js';
import { paymentAccount, payableCurrencies, spdString } from './account.js';
import { issueTaxDocument } from '../invoices/documents.js';

/**
 * Buying a plan for a tournament (celek B3): the organiser picks a plan, ATM
 * shows a QR transfer, and the plan applies once an admin confirms the money
 * arrived. Nothing changes for the tournament until then, except that its
 * form may take applications up to the new plan's limit.
 */

export type OfferPlan = 'TOURNAMENT' | 'TOURNAMENT_PLUS' | 'ORGANIZER';

const OFFER_PRODUCT: Record<OfferPlan, string> = {
  TOURNAMENT: 'TOURNAMENT',
  TOURNAMENT_PLUS: 'TOURNAMENT_PLUS',
  ORGANIZER: 'ORGANIZER_YEAR',
};

const RANK: Record<TournamentPlan, number> = { FREE: 0, TOURNAMENT: 1, TOURNAMENT_PLUS: 2 };

/** How long before a running Organizer year ends its holder may buy the next one. */
export const RENEWAL_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface PlanOffer {
  plan: OfferPlan;
  productCode: string;
  limit: number | null;
  /** Minor units, VAT included, per payable currency. An upgrade costs the difference. */
  prices: Partial<Record<Currency, number>>;
  upgradeFrom: TournamentPlan | null;
  /** A renewal of a running Organizer year: when the new one starts. */
  startsAt: Date | null;
}

/** What a payment snapshot holds beyond the quote: an upgrade records what it was paid on top of. */
export type PaymentSnapshot = PriceSnapshot & { upgradeFrom?: TournamentPlan; fullGross?: number };

export class PaymentError extends Error {
  constructor(
    public readonly code: 'NOT_FOUND' | 'NOT_OFFERED' | 'NO_ACCOUNT' | 'PAYMENT_PENDING' | 'NOT_PENDING' | 'NOT_ALLOWED',
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

/** The plans a user may buy for a tournament now, with prices. */
export async function planOffers(tournamentId: string, userId: string, tx: DbClient = prisma): Promise<PlanOffer[]> {
  const tournament = await tx.tournament.findUnique({
    where: { id: tournamentId },
    select: { plan: true, series: { select: { managerId: true } } },
  });
  if (!tournament) throw new PaymentError('NOT_FOUND', 'Tournament not found', 404);
  const currencies = payableCurrencies();
  const managerId = tournament.series.managerId;
  const now = new Date();
  const organizerUntil = managerId ? await organizerPlanUntil(managerId, now, tx) : null;

  const candidates: OfferPlan[] = [];
  // While an Organizer year runs every plan is in effect; only its renewal is
  // offered, in its last days, and the next year follows on from it.
  if (!organizerUntil) {
    if (RANK.TOURNAMENT > RANK[tournament.plan]) candidates.push('TOURNAMENT');
    if (RANK.TOURNAMENT_PLUS > RANK[tournament.plan]) candidates.push('TOURNAMENT_PLUS');
  }
  const renewable = !organizerUntil || organizerUntil.getTime() - now.getTime() <= RENEWAL_DAYS * DAY_MS;
  // The yearly plan belongs to whoever manages the series, so only they buy it.
  if (managerId === userId && renewable) candidates.push('ORGANIZER');

  const offers: PlanOffer[] = [];
  for (const plan of candidates) {
    const productCode = OFFER_PRODUCT[plan];
    const price = await priceAt(productCode, new Date(), tx);
    if (!price) continue;
    const upgradeFrom = plan === 'TOURNAMENT_PLUS' && tournament.plan === 'TOURNAMENT' ? 'TOURNAMENT' : null;
    const credit = upgradeFrom ? await priceAt(upgradeFrom, new Date(), tx) : null;
    const prices: Partial<Record<Currency, number>> = {};
    for (const currency of currencies) {
      const field = currency === 'CZK' ? 'priceCzk' : 'priceEur';
      prices[currency] = Math.max(0, price[field] - (credit?.[field] ?? 0));
    }
    offers.push({
      plan,
      productCode,
      limit: (await limitAt(plan as Plan, 'TEAMS_PER_TOURNAMENT', new Date(), tx)) ?? null,
      prices,
      upgradeFrom,
      startsAt: plan === 'ORGANIZER' ? organizerUntil : null,
    });
  }
  return offers;
}

const paymentInclude = {
  tournament: { select: { id: true, name: true } },
  payer: { select: { id: true, name: true, email: true } },
  confirmedBy: { select: { id: true, name: true, email: true } },
  taxDocument: { select: { id: true, number: true, kind: true, issuedAt: true, emailedAt: true } },
} satisfies Prisma.PaymentInclude;

export type PaymentWithRelations = Prisma.PaymentGetPayload<{ include: typeof paymentInclude }>;

/** A payment as the organiser and the admin see it, with what to pay to. */
export function paymentView(payment: PaymentWithRelations) {
  const snapshot = payment.snapshot as unknown as PaymentSnapshot;
  const currency = payment.currency as Currency;
  const account = paymentAccount(currency);
  return {
    id: payment.id,
    variableSymbol: payment.variableSymbol,
    status: payment.status,
    productCode: payment.productCode,
    plan: PRODUCT_PLAN[payment.productCode] ?? null,
    productName: snapshot.productName,
    currency,
    amount: payment.amount,
    base: snapshot.base,
    vat: snapshot.vat,
    vatRateBp: snapshot.vatRateBp,
    upgradeFrom: snapshot.upgradeFrom ?? null,
    tournament: payment.tournament,
    payer: payment.payer,
    confirmedBy: payment.confirmedBy,
    createdAt: payment.createdAt,
    confirmedAt: payment.confirmedAt,
    cancelledAt: payment.cancelledAt,
    document: payment.taxDocument,
    account: account && { local: account.local, iban: account.iban, bic: account.bic, recipient: account.recipient },
    qr: account && payment.status === 'PENDING'
      ? spdString(account, payment.amount, payment.variableSymbol, `ATM ${payment.productCode} ${payment.variableSymbol}`)
      : null,
  };
}

export async function findPayment(id: string, tx: DbClient = prisma) {
  return tx.payment.findUnique({ where: { id }, include: paymentInclude });
}

/** The tournament's payment waiting for confirmation, if there is one. */
export async function pendingPayment(tournamentId: string, tx: DbClient = prisma) {
  return tx.payment.findFirst({ where: { tournamentId, status: 'PENDING' }, include: paymentInclude });
}

/**
 * Starts a payment for a plan. One payment per tournament waits at a time;
 * the organiser cancels it to choose another plan.
 */
export async function createPayment(input: {
  tournamentId: string;
  payerId: string;
  plan: OfferPlan;
  currency: Currency;
}): Promise<PaymentWithRelations> {
  if (!paymentAccount(input.currency)) throw new PaymentError('NO_ACCOUNT', `No account for ${input.currency}`, 400);

  return prisma.$transaction(async (tx) => {
    await lockCompetition(tx, 'tournament', input.tournamentId);
    if (await tx.payment.count({ where: { tournamentId: input.tournamentId, status: 'PENDING' } })) {
      throw new PaymentError('PAYMENT_PENDING', 'A payment for this tournament is already waiting', 409);
    }
    const offer = (await planOffers(input.tournamentId, input.payerId, tx)).find((item) => item.plan === input.plan);
    const amount = offer?.prices[input.currency];
    if (!offer || amount === undefined) throw new PaymentError('NOT_OFFERED', 'This plan is not offered for the tournament', 400);

    // Until billing details arrive (B6), every customer is a Czech consumer.
    const quoted = await quote({ productCode: offer.productCode, currency: input.currency, country: 'CZ' }, tx);
    let snapshot: PaymentSnapshot = quoted;
    if (offer.upgradeFrom) {
      snapshot = { ...quoted, ...splitGross(amount, quoted.vatRateBp), gross: amount, upgradeFrom: offer.upgradeFrom, fullGross: quoted.gross };
    }

    const payment = await tx.payment.create({
      data: {
        productCode: offer.productCode,
        currency: input.currency,
        amount: snapshot.gross,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        payerId: input.payerId,
        tournamentId: input.tournamentId,
      },
      include: paymentInclude,
    });
    await recordAudit({
      entityType: 'Payment',
      entityId: payment.id,
      action: 'CREATE',
      after: auditView(payment),
      actorId: input.payerId,
    }, tx);
    return payment;
  });
}

const auditView = (payment: Payment & { tournament?: { name: string } | null }) => ({
  name: `${payment.variableSymbol}`,
  variableSymbol: payment.variableSymbol,
  productCode: payment.productCode,
  amount: payment.amount,
  currency: payment.currency,
  status: payment.status,
  tournament: payment.tournament?.name ?? null,
});

/** Withdraws a payment nobody confirmed yet. */
export async function cancelPayment(id: string, actorId: string, reason?: string | null): Promise<PaymentWithRelations> {
  return prisma.$transaction(async (tx) => {
    const cancelled = await tx.payment.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    const payment = await findPayment(id, tx);
    if (!payment) throw new PaymentError('NOT_FOUND', 'Payment not found', 404);
    if (cancelled.count === 0) throw new PaymentError('NOT_PENDING', 'Only a waiting payment can be cancelled', 409);
    await recordAudit({
      entityType: 'Payment',
      entityId: id,
      action: 'UPDATE',
      before: { ...auditView(payment), status: 'PENDING' },
      after: auditView(payment),
      reason: reason || null,
      actorId,
    }, tx);
    return payment;
  });
}

const addYear = (from: Date) => {
  const until = new Date(from);
  until.setUTCFullYear(until.getUTCFullYear() + 1);
  return until;
};

/**
 * Marks a transfer as arrived and applies what it paid for: the tournament's
 * plan, or a year of Organizer for the payer, starting when any running year
 * of theirs ends.
 */
export async function confirmPayment(id: string, adminId: string, reason?: string | null): Promise<PaymentWithRelations> {
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const confirmed = await tx.payment.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'PAID', confirmedAt: now, confirmedById: adminId },
    });
    const payment = await findPayment(id, tx);
    if (!payment) throw new PaymentError('NOT_FOUND', 'Payment not found', 404);
    if (confirmed.count === 0) throw new PaymentError('NOT_PENDING', 'Only a waiting payment can be confirmed', 409);

    const plan = PRODUCT_PLAN[payment.productCode];
    let period: { from: Date; until: Date } | undefined;
    if (plan === 'ORGANIZER') {
      if (!payment.payerId) throw new PaymentError('NOT_ALLOWED', 'The payer no longer exists', 409);
      const validFrom = (await organizerPlanUntil(payment.payerId, now, tx)) ?? now;
      period = { from: validFrom, until: addYear(validFrom) };
      await tx.organizerPlan.create({
        data: { userId: payment.payerId, validFrom, validUntil: period.until, paymentId: payment.id },
      });
    } else if (plan && payment.tournamentId) {
      const tournament = await tx.tournament.findUnique({ where: { id: payment.tournamentId }, select: { plan: true } });
      const target = plan as TournamentPlan;
      // Never lower a plan an admin raised by hand meanwhile.
      if (tournament && RANK[target] > RANK[tournament.plan]) {
        await tx.tournament.update({ where: { id: payment.tournamentId }, data: { plan: target } });
      }
    }

    // The tax point is the confirmation (decided 22 Oct 2026).
    await issueTaxDocument(tx, payment, now, period);

    await recordAudit({
      entityType: 'Payment',
      entityId: id,
      action: 'CONFIRM',
      before: { ...auditView(payment), status: 'PENDING' },
      after: auditView(payment),
      reason: reason || null,
      actorId: adminId,
    }, tx);
    return payment;
  });
}

/** For the organiser's view: the plan now and the payment waiting, if any. */
export async function planStatus(tournamentId: string) {
  const allowance = await teamAllowance(tournamentId);
  if (!allowance) return null;
  const pending = await pendingPayment(tournamentId);
  return { ...allowance, payment: pending ? paymentView(pending) : null };
}
