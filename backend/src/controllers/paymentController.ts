import { Response } from 'express';
import prisma from '../config/database.js';
import { AuthRequest } from '../types/index.js';
import { canManageTournament } from '../services/access.js';
import emailService from '../services/emailService.js';
import { CURRENCIES, type Currency } from '../services/pricing/catalog.js';
import { payableCurrencies } from '../services/payments/account.js';
import {
  cancelPayment,
  createPayment,
  findPayment,
  paymentView,
  planOffers,
  planStatus,
  PaymentError,
  type OfferPlan,
  type PaymentWithRelations,
} from '../services/payments/payments.js';

/** The organiser's side of buying a plan. Tournament access is checked by the routes. */

const OFFER_PLANS: OfferPlan[] = ['TOURNAMENT', 'TOURNAMENT_PLUS', 'ORGANIZER'];

const answerError = (res: Response, error: unknown, fallback: string, log: string): void => {
  if (error instanceof PaymentError) {
    res.status(error.status).json({ error: error.message, code: error.code });
    return;
  }
  console.error(log, error);
  res.status(500).json({ error: fallback });
};

/** GET /api/tournaments/:id/plan: the plan, its team limit and the payment waiting, if any. */
export const getPlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const status = await planStatus(req.params.id);
    if (!status) { res.status(404).json({ error: 'Tournament not found' }); return; }
    res.json(status);
  } catch (error) {
    answerError(res, error, 'Failed to fetch the plan', 'Get tournament plan error:');
  }
};

/** GET /api/tournaments/:id/plan/offers */
export const getOffers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json({ offers: await planOffers(req.params.id, req.user!.id), currencies: payableCurrencies() });
  } catch (error) {
    answerError(res, error, 'Failed to fetch the offers', 'Get plan offers error:');
  }
};

/** Tells every active admin a transfer is coming, so they watch the account for it. */
const notifyAdmins = (payment: PaymentWithRelations): void => {
  void (async () => {
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN', active: true }, select: { email: true } });
    const view = paymentView(payment);
    await Promise.all(admins.map((admin) => emailService.sendPaymentNoticeEmail({
      to: admin.email,
      variableSymbol: view.variableSymbol,
      productName: view.productName.cs,
      tournamentName: view.tournament?.name ?? null,
      payerEmail: view.payer?.email ?? null,
      amount: view.amount,
      currency: view.currency,
    })));
  })().catch((error) => console.error('Payment notice email error:', error));
};

/** POST /api/tournaments/:id/payments { plan, currency } */
export const startPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { plan, currency } = req.body ?? {};
    if (!OFFER_PLANS.includes(plan) || !CURRENCIES.includes(currency)) {
      res.status(400).json({ error: 'Choose a plan and a currency', code: 'INVALID_INPUT' });
      return;
    }
    const payment = await createPayment({
      tournamentId: req.params.id,
      payerId: req.user!.id,
      plan: plan as OfferPlan,
      currency: currency as Currency,
    });
    notifyAdmins(payment);
    res.status(201).json(paymentView(payment));
  } catch (error) {
    answerError(res, error, 'Failed to start the payment', 'Start payment error:');
  }
};

/** POST /api/payments/:id/cancel: the payer or whoever manages the tournament. */
export const cancelOwnPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const payment = await findPayment(req.params.id);
    const allowed = payment && (
      payment.payerId === req.user!.id
      || (payment.tournamentId && (await canManageTournament(req.user!, payment.tournamentId)))
    );
    if (!payment || !allowed) { res.status(404).json({ error: 'Payment not found' }); return; }
    res.json(paymentView(await cancelPayment(payment.id, req.user!.id)));
  } catch (error) {
    answerError(res, error, 'Failed to cancel the payment', 'Cancel payment error:');
  }
};
