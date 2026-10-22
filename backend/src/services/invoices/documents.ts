import type { Payment, Prisma, TaxDocument } from '@prisma/client';
import prisma from '../../config/database.js';
import emailService from '../emailService.js';
import { storage } from '../storage/index.js';
import { zonedParts } from '../../utils/time.js';
import { paymentAccount } from '../payments/account.js';
import type { PaymentSnapshot } from '../payments/payments.js';
import { formatAmount, ISSUER, renderTaxDocument, type DocumentContent } from './template.js';

/**
 * Tax documents for confirmed payments (celek B4). The number is taken and
 * the document recorded inside the transaction that confirms the payment;
 * the PDF is rendered from the stored content afterwards, so a storage or
 * mail failure never loses a number or leaves a gap.
 */

const PLAN_NAMES: Record<string, { cs: string; en: string }> = {
  TOURNAMENT: { cs: 'Turnaj', en: 'Tournament' },
  TOURNAMENT_PLUS: { cs: 'Turnaj Plus', en: 'Tournament Plus' },
};

const shortDay = (date: Date) => {
  const { day, month, year } = zonedParts(date);
  return `${day}. ${month}. ${year}`;
};

type PaymentForDocument = Payment & { tournament: { name: string } | null };

/**
 * ATM26-0001: the year's last two digits and the sequence (decided 22 Oct
 * 2026). Unlike a variable symbol it has letters, so the two are never mixed
 * up; past 9999 the sequence simply grows a digit.
 */
export const documentNumber = (year: number, sequence: number) =>
  `ATM${String(year).slice(-2)}-${String(sequence).padStart(4, '0')}`;

/** What the line says: the plan, its tournament, and what an upgrade or a year covers. */
function describe(payment: PaymentForDocument, snapshot: PaymentSnapshot, period?: { from: Date; until: Date }) {
  let cs = snapshot.productName.cs;
  let en = snapshot.productName.en;
  if (snapshot.upgradeFrom) {
    const from = PLAN_NAMES[snapshot.upgradeFrom] ?? { cs: snapshot.upgradeFrom, en: snapshot.upgradeFrom };
    cs += `, doplatek z plánu ${from.cs}`;
    en += `, upgrade from ${from.en}`;
  }
  if (period) {
    const span = `${shortDay(period.from)} – ${shortDay(period.until)}`;
    cs += `, ${span}`;
    en += `, ${span}`;
  }
  if (payment.tournament) {
    cs += ` – ${payment.tournament.name}`;
    en += ` – ${payment.tournament.name}`;
  }
  return { cs, en };
}

/**
 * Inside the confirming transaction: takes the year's next number and
 * records the document. Simplified until billing details exist (celek B6);
 * every price is under the 10 000 Kč such a document allows.
 */
export async function issueTaxDocument(
  tx: Prisma.TransactionClient,
  payment: PaymentForDocument,
  at: Date,
  period?: { from: Date; until: Date },
): Promise<TaxDocument> {
  const year = zonedParts(at).year;
  // The counter row stays locked until the transaction ends: a second
  // confirmation waits, and a rolled-back one gives its number back.
  const [{ last }] = await tx.$queryRaw<{ last: number }[]>`
    INSERT INTO document_counters (year, last) VALUES (${year}, 1)
    ON CONFLICT (year) DO UPDATE SET last = document_counters.last + 1
    RETURNING last`;
  const number = documentNumber(year, last);
  const snapshot = payment.snapshot as unknown as PaymentSnapshot;
  const account = paymentAccount(payment.currency as 'CZK' | 'EUR');

  const content: DocumentContent = {
    number,
    kind: 'SIMPLIFIED',
    issuedAt: at.toISOString(),
    taxPointAt: at.toISOString(),
    issuer: ISSUER,
    customer: null,
    currency: payment.currency as 'CZK' | 'EUR',
    lines: [{
      description: describe(payment, snapshot, period),
      gross: snapshot.gross,
      base: snapshot.base,
      vat: snapshot.vat,
      vatRateBp: snapshot.vatRateBp,
    }],
    totals: { gross: snapshot.gross, base: snapshot.base, vat: snapshot.vat },
    vatMode: snapshot.vatMode,
    payment: { variableSymbol: payment.variableSymbol, account: `${account.local} · IBAN ${account.iban}` },
  };

  return tx.taxDocument.create({
    data: {
      number,
      year,
      sequence: last,
      kind: 'SIMPLIFIED',
      paymentId: payment.id,
      issuedAt: at,
      taxPointAt: at,
      content: content as unknown as Prisma.InputJsonValue,
    },
  });
}

const fileKeyOf = (document: TaxDocument) => `invoices/${document.year}/${document.number}.pdf`;

/** The document's PDF, written to private storage the first time it is asked for. */
export async function documentPdf(document: TaxDocument): Promise<Buffer> {
  const pdf = await renderTaxDocument(document.content as unknown as DocumentContent);
  if (!document.fileKey) {
    const key = fileKeyOf(document);
    await storage().put(key, pdf, 'application/pdf', 'PRIVATE');
    await prisma.taxDocument.update({ where: { id: document.id }, data: { fileKey: key } });
    document.fileKey = key;
  }
  return pdf;
}

/** A short-lived link to the stored PDF. */
export async function documentLink(document: TaxDocument): Promise<string> {
  if (!document.fileKey) await documentPdf(document);
  return storage().signedUrl(document.fileKey!, 10 * 60);
}

/**
 * Stores the PDF and e-mails it to the payer. Runs after the confirmation is
 * committed; a failure is logged and the admin can still download the
 * document, so it never undoes the confirmation.
 */
export async function deliverTaxDocument(paymentId: string): Promise<void> {
  const document = await prisma.taxDocument.findUnique({
    where: { paymentId },
    include: { payment: { include: { payer: { select: { email: true, name: true } }, tournament: { select: { name: true } } } } },
  });
  if (!document) return;
  const pdf = await documentPdf(document);
  const payer = document.payment.payer;
  if (!payer) return;

  const content = document.content as unknown as DocumentContent;
  const sent = await emailService.sendTaxDocumentEmail({
    to: payer.email,
    name: payer.name,
    // No language is stored per user; a payment in euros comes from abroad.
    locale: content.currency === 'EUR' ? 'en' : 'cs',
    number: document.number,
    item: content.lines[0].description,
    amount: formatAmount(content.totals.gross, content.currency),
    pdf,
  });
  if (sent) await prisma.taxDocument.update({ where: { id: document.id }, data: { emailedAt: new Date() } });
}
