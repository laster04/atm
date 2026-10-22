import { Response } from 'express';
import { Prisma, PaymentStatus } from '@prisma/client';
import prisma from '../config/database.js';
import { AuthRequest } from '../types/index.js';
import { csvFilename, dayRange, enumParam, parseListParams, sendCsv, totalRows, type CsvColumn } from '../services/admin/list.js';
import { deliverTaxDocument, documentLink } from '../services/invoices/documents.js';
import {
  cancelPayment,
  confirmPayment,
  paymentView,
  PaymentError,
  type PaymentWithRelations,
} from '../services/payments/payments.js';

const SORTABLE = ['createdAt', 'variableSymbol', 'amount'] as const;
const STATUSES = Object.values(PaymentStatus);
const PRODUCTS = ['TOURNAMENT', 'TOURNAMENT_PLUS', 'ORGANIZER_YEAR'] as const;

const include = {
  tournament: { select: { id: true, name: true } },
  payer: { select: { id: true, name: true, email: true } },
  confirmedBy: { select: { id: true, name: true, email: true } },
  taxDocument: { select: { id: true, number: true, kind: true, issuedAt: true, emailedAt: true } },
} satisfies Prisma.PaymentInclude;

const columns: CsvColumn<PaymentWithRelations>[] = [
  { header: 'variableSymbol', value: (row) => row.variableSymbol },
  { header: 'status', value: (row) => row.status },
  { header: 'product', value: (row) => row.productCode },
  { header: 'currency', value: (row) => row.currency },
  { header: 'amount', value: (row) => (row.amount / 100).toFixed(2) },
  { header: 'payer', value: (row) => row.payer?.email ?? '' },
  { header: 'tournament', value: (row) => row.tournament?.name ?? '' },
  { header: 'createdAt', value: (row) => row.createdAt },
  { header: 'confirmedAt', value: (row) => row.confirmedAt },
  { header: 'document', value: (row) => row.taxDocument?.number ?? '' },
];

/**
 * GET /api/admin/payments
 *
 * Filters: `status`, `product`, `currency`, `createdFrom`/`createdTo`. The search
 * matches the variable symbol, the tax document's number, the payer's email
 * or the tournament's name.
 */
export const listPayments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const params = parseListParams(req.query, SORTABLE, { sort: 'createdAt', dir: 'desc' });
    const status = enumParam(req.query.status, STATUSES);
    const product = enumParam(req.query.product, PRODUCTS);
    const currency = enumParam(req.query.currency, ['CZK', 'EUR'] as const);
    const period = dayRange(req.query.createdFrom, req.query.createdTo);
    const symbol = params.q && /^\d{1,10}$/.test(params.q) ? Number(params.q) : null;

    const conditions: Prisma.PaymentWhereInput[] = [
      ...(status ? [{ status }] : []),
      ...(product ? [{ productCode: product }] : []),
      ...(currency ? [{ currency }] : []),
      ...(period ? [{ createdAt: period }] : []),
      ...(params.q ? [{ OR: [
        ...(symbol !== null ? [{ variableSymbol: symbol }] : []),
        { taxDocument: { number: params.q } },
        { payer: { email: { contains: params.q, mode: 'insensitive' as const } } },
        { tournament: { name: { contains: params.q, mode: 'insensitive' as const } } },
      ] }] : []),
    ];
    const where: Prisma.PaymentWhereInput = conditions.length ? { AND: conditions } : {};
    const orderBy: Prisma.PaymentOrderByWithRelationInput[] = [{ [params.sort]: params.dir }, { id: params.dir }];

    if (params.csv) {
      await sendCsv(res, csvFilename('payments'), columns, (skip, take) =>
        prisma.payment.findMany({ where, include, orderBy, skip, take }));
      return;
    }

    const [rows, count] = await Promise.all([
      prisma.payment.findMany({ where, include, orderBy, skip: (params.page - 1) * params.pageSize, take: params.pageSize }),
      totalRows('payments', conditions.length > 0, () => prisma.payment.count({ where })),
    ]);
    res.json({ rows: rows.map(paymentView), ...count, page: params.page, pageSize: params.pageSize });
  } catch (error) {
    console.error('List payments error:', error);
    res.status(500).json({ error: 'Failed to list payments' });
  }
};

const ids = (body: unknown): string[] | null => {
  const value = (body as { ids?: unknown })?.ids;
  return Array.isArray(value) && value.length > 0 && value.length <= 100 && value.every((id) => typeof id === 'string') ? value : null;
};

const reasonOf = (body: unknown): string | null => {
  const value = (body as { reason?: unknown })?.reason;
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 500) : null;
};

/**
 * POST /api/admin/payments/confirm { ids, reason? } and /cancel: one by one,
 * so a payment someone else decided meanwhile is reported and the rest go on.
 */
const decide = (action: 'confirm' | 'cancel') => async (req: AuthRequest, res: Response): Promise<void> => {
  const chosen = ids(req.body);
  if (!chosen) { res.status(400).json({ error: 'Choose 1 to 100 payments' }); return; }
  const reason = reasonOf(req.body);
  const done: string[] = [];
  const skipped: { id: string; code: string }[] = [];
  for (const id of chosen) {
    try {
      if (action === 'confirm') await confirmPayment(id, req.user!.id, reason);
      else await cancelPayment(id, req.user!.id, reason);
      done.push(id);
    } catch (error) {
      if (error instanceof PaymentError) { skipped.push({ id, code: error.code }); continue; }
      console.error(`Admin ${action} payment error:`, error);
      res.status(500).json({ error: `Failed to ${action} the payments`, done });
      return;
    }
  }
  // Each confirmed payment's document goes to its payer once the confirmation is committed.
  if (action === 'confirm') {
    for (const id of done) {
      void deliverTaxDocument(id).catch((error) => console.error('Tax document delivery error:', error));
    }
  }
  res.json({ done, skipped });
};

/** GET /api/admin/payments/:id/document: a short-lived link to the payment's tax document. */
export const getPaymentDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const document = await prisma.taxDocument.findUnique({ where: { paymentId: req.params.id } });
    if (!document) { res.status(404).json({ error: 'No document for this payment' }); return; }
    res.json({ url: await documentLink(document), number: document.number });
  } catch (error) {
    console.error('Payment document error:', error);
    res.status(500).json({ error: 'Failed to prepare the document' });
  }
};

export const confirmPayments = decide('confirm');
export const cancelPayments = decide('cancel');
