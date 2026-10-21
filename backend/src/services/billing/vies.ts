import { Prisma, type VatCheck } from '@prisma/client';
import prisma from '../../config/database.js';

/**
 * EU VAT ID checks through VIES, the Commission's free service. Each check is
 * stored: a VALID answer, with its consultation number, is the evidence behind
 * charging 0 % under reverse charge. When VIES does not answer the check is
 * kept as UNAVAILABLE, the customer pays Czech VAT, and the retry job asks
 * again later; a payment is never held up by VIES.
 */

const DEFAULT_URL = 'https://ec.europa.eu/taxation_customs/vies/rest-api';
const TIMEOUT_MS = 8_000;
/** A definite answer is reused for a day instead of asking again. */
export const VAT_CHECK_REUSE_MS = 24 * 60 * 60 * 1000;
const RETRY_BASE_MS = 15 * 60 * 1000;
const RETRY_MAX_MS = 6 * 60 * 60 * 1000;
export const VAT_CHECK_MAX_ATTEMPTS = 10;

export type Fetcher = typeof fetch;

export class VatIdFormatError extends Error {}

/** `SK 2020 123 456` → `{ countryCode: 'SK', vatNumber: '2020123456' }`; GR becomes VIES's EL. */
export function parseVatId(raw: unknown): { countryCode: string; vatNumber: string } {
  if (typeof raw !== 'string') throw new VatIdFormatError('VAT ID is required');
  const compact = raw.toUpperCase().replace(/[\s.\-/]/g, '');
  const match = /^([A-Z]{2})([0-9A-Z+*]{2,12})$/.exec(compact);
  if (!match) throw new VatIdFormatError('VAT ID must start with a two-letter country code');
  const countryCode = match[1] === 'GR' ? 'EL' : match[1];
  return { countryCode, vatNumber: match[2] };
}

export interface ViesAnswer {
  status: 'VALID' | 'INVALID' | 'UNAVAILABLE';
  name: string | null;
  address: string | null;
  requestIdentifier: string | null;
  requestDate: Date | null;
  raw: unknown;
}

/** VIES writes "---" where a member state does not disclose a field. */
const disclosed = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' && value.trim() !== '---' ? value.trim() : null;

/**
 * Asks VIES once. Sends ATM's own VAT ID (`VIES_REQUESTER_VAT`, e.g.
 * CZ12345678) when set, which is what makes VIES issue a consultation number.
 * Any failure, timeout or non-answer comes back as UNAVAILABLE, never thrown.
 */
export async function queryVies(countryCode: string, vatNumber: string, fetcher: Fetcher = fetch): Promise<ViesAnswer> {
  const requester = process.env.VIES_REQUESTER_VAT ? parseVatId(process.env.VIES_REQUESTER_VAT) : null;
  try {
    const res = await fetcher(`${process.env.VIES_API_URL ?? DEFAULT_URL}/check-vat-number`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        countryCode,
        vatNumber,
        ...(requester && { requesterMemberStateCode: requester.countryCode, requesterNumber: requester.vatNumber }),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    // Errors come back as { actionSucceed: false, errorWrappers: [...] }, and a
    // member state that is down as a `userError` other than VALID/INVALID.
    const userError = typeof body?.userError === 'string' ? body.userError : null;
    if (!res.ok || !body || typeof body.valid !== 'boolean' || (userError && !['VALID', 'INVALID'].includes(userError))) {
      return { status: 'UNAVAILABLE', name: null, address: null, requestIdentifier: null, requestDate: null, raw: body };
    }
    const requestDate = typeof body.requestDate === 'string' ? new Date(body.requestDate) : null;
    return {
      status: body.valid ? 'VALID' : 'INVALID',
      name: disclosed(body.name),
      address: disclosed(body.address),
      requestIdentifier: disclosed(body.requestIdentifier),
      requestDate: requestDate && !Number.isNaN(requestDate.getTime()) ? requestDate : null,
      raw: body,
    };
  } catch (error) {
    return { status: 'UNAVAILABLE', name: null, address: null, requestIdentifier: null, requestDate: null, raw: { error: String(error) } };
  }
}

const nextRetry = (attempts: number, now: Date) =>
  new Date(now.getTime() + Math.min(RETRY_BASE_MS * 2 ** (attempts - 1), RETRY_MAX_MS));

const answerData = (answer: ViesAnswer) => ({
  status: answer.status,
  name: answer.name,
  address: answer.address,
  requestIdentifier: answer.requestIdentifier,
  requestDate: answer.requestDate,
  response: (answer.raw ?? Prisma.JsonNull) as Prisma.InputJsonValue,
});

/**
 * Checks a VAT ID, reusing a definite answer from the last day. Returns the
 * stored check, whatever VIES said.
 */
export async function checkVatId(rawVatId: unknown, requestedById: string | null, fetcher: Fetcher = fetch): Promise<VatCheck> {
  const { countryCode, vatNumber } = parseVatId(rawVatId);
  const now = new Date();
  const recent = await prisma.vatCheck.findFirst({
    where: {
      countryCode, vatNumber,
      status: { in: ['VALID', 'INVALID'] },
      checkedAt: { gte: new Date(now.getTime() - VAT_CHECK_REUSE_MS) },
    },
    orderBy: { checkedAt: 'desc' },
  });
  if (recent) return recent;

  const answer = await queryVies(countryCode, vatNumber, fetcher);
  return prisma.vatCheck.create({
    data: {
      countryCode,
      vatNumber,
      ...answerData(answer),
      checkedAt: now,
      nextRetryAt: answer.status === 'UNAVAILABLE' ? nextRetry(1, now) : null,
      requestedById,
    },
  });
}

/**
 * Asks VIES again about checks it did not answer. Run by the retry job; a
 * check gives up after VAT_CHECK_MAX_ATTEMPTS and stays UNAVAILABLE.
 */
export async function retryUnavailableVatChecks(fetcher: Fetcher = fetch, now: Date = new Date()): Promise<number> {
  const due = await prisma.vatCheck.findMany({
    where: { status: 'UNAVAILABLE', nextRetryAt: { lte: now }, attempts: { lt: VAT_CHECK_MAX_ATTEMPTS } },
    orderBy: { nextRetryAt: 'asc' },
    take: 50,
  });
  let answered = 0;
  for (const check of due) {
    const answer = await queryVies(check.countryCode, check.vatNumber, fetcher);
    const attempts = check.attempts + 1;
    const unanswered = answer.status === 'UNAVAILABLE';
    await prisma.vatCheck.update({
      where: { id: check.id },
      data: {
        ...answerData(answer),
        attempts,
        checkedAt: now,
        nextRetryAt: unanswered && attempts < VAT_CHECK_MAX_ATTEMPTS ? nextRetry(attempts, now) : null,
      },
    });
    if (!unanswered) answered += 1;
  }
  return answered;
}
