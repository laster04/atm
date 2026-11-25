import type { Prisma } from '@prisma/client';
import prisma, { type DbClient } from '../../config/database.js';
import type { Currency } from '../pricing/catalog.js';

/**
 * The accounts organisers pay ATM's plans to, one per currency (celek K).
 * The bank details live in the administration (app_settings.bank_accounts),
 * set by the pricing manager and audited; account numbers never go into the
 * code, migrations or tests with real values. A currency without an account
 * cannot be paid in.
 */

export interface PaymentAccount {
  currency: Currency;
  /** As Czech banks print it (e.g. 19-2000145399/0800), for a Czech IBAN; otherwise the IBAN. */
  local: string;
  iban: string;
  bic: string;
  recipient: string;
}

export type BankAccounts = Partial<Record<Currency, PaymentAccount>>;

const SETTING_KEY = 'bank_accounts';

const ACCOUNT_PATTERN = /^(?:(\d{1,6})-)?(\d{2,10})\/(\d{4})$/;

/** The IBAN of a Czech account number, or null if it is not one. */
export function czechIban(local: string): string | null {
  const match = ACCOUNT_PATTERN.exec(local.trim());
  if (!match) return null;
  const [, prefix = '', number, bank] = match;
  const bban = `${bank}${prefix.padStart(6, '0')}${number.padStart(10, '0')}`;
  // ISO 13616: the country (C=12, Z=35) and 00 go behind, the check makes it 1 mod 97.
  const check = 98 - Number(BigInt(`${bban}123500`) % 97n);
  return `CZ${String(check).padStart(2, '0')}${bban}`;
}

/** The Czech account number of a Czech IBAN, as banks print it; null for other countries. */
export function czechLocal(iban: string): string | null {
  const match = /^CZ\d{2}(\d{4})(\d{6})(\d{10})$/.exec(iban);
  if (!match) return null;
  const [, bank, prefix, number] = match;
  const trimmedPrefix = prefix.replace(/^0+/, '');
  return `${trimmedPrefix ? `${trimmedPrefix}-` : ''}${number.replace(/^0+/, '') || '0'}/${bank}`;
}

/** An IBAN without spaces, upper case, if its ISO 13616 check digits are right. */
export function normaliseIban(value: string): string | null {
  const iban = value.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return null;
  const rearranged = `${iban.slice(4)}${iban.slice(0, 4)}`;
  const digits = rearranged.replace(/[A-Z]/g, (letter) => String(letter.charCodeAt(0) - 55));
  return BigInt(digits) % 97n === 1n ? iban : null;
}

/** A BIC (SWIFT code) in upper case, 8 or 11 characters, or null. */
export function normaliseBic(value: string): string | null {
  const bic = value.replace(/\s+/g, '').toUpperCase();
  return /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic) ? bic : null;
}

interface StoredAccount { iban: string; bic: string; recipient: string }

const toAccount = (currency: Currency, stored: StoredAccount): PaymentAccount => ({
  currency,
  local: czechLocal(stored.iban) ?? stored.iban,
  iban: stored.iban,
  bic: stored.bic,
  recipient: stored.recipient,
});

/** Every account set in the administration, by currency. */
export async function bankAccounts(tx: DbClient = prisma): Promise<BankAccounts> {
  const row = await tx.appSetting.findUnique({ where: { key: SETTING_KEY } });
  const stored = (row?.value ?? {}) as Partial<Record<Currency, StoredAccount>>;
  const accounts: BankAccounts = {};
  for (const currency of ['CZK', 'EUR'] as const) {
    const value = stored[currency];
    if (value?.iban && value.bic && value.recipient) accounts[currency] = toAccount(currency, value);
  }
  return accounts;
}

/** The account for a currency, or null when the administration has none. */
export async function paymentAccount(currency: Currency, tx: DbClient = prisma): Promise<PaymentAccount | null> {
  return (await bankAccounts(tx))[currency] ?? null;
}

/** Currencies an organiser can pay in: those with an account. */
export async function payableCurrencies(tx: DbClient = prisma): Promise<Currency[]> {
  const accounts = await bankAccounts(tx);
  return (['CZK', 'EUR'] as const).filter((currency) => accounts[currency]);
}

/** Stores one currency's account; returns what it replaced. */
export async function setBankAccount(currency: Currency, account: StoredAccount, tx: DbClient = prisma): Promise<StoredAccount | null> {
  const row = await tx.appSetting.findUnique({ where: { key: SETTING_KEY } });
  const stored = (row?.value ?? {}) as Partial<Record<Currency, StoredAccount>>;
  const before = stored[currency] ?? null;
  const value = { ...stored, [currency]: account } as unknown as Prisma.InputJsonObject;
  await tx.appSetting.upsert({ where: { key: SETTING_KEY }, create: { key: SETTING_KEY, value }, update: { value } });
  return before;
}

// ---------------------------------------------------------------------------
// QR payment strings
// ---------------------------------------------------------------------------

/**
 * How a payment is made: a Czech SPD QR code, a Slovak PAY by square QR code,
 * or a plain SEPA transfer typed in by hand (no QR code: other eurozone banks
 * read QR payment codes too unevenly to rely on one).
 */
export type PaymentMethod = 'SPD' | 'BYSQUARE' | 'SEPA';

/** The ways a currency can be paid. */
export const METHODS_BY_CURRENCY: Record<Currency, PaymentMethod[]> = { CZK: ['SPD'], EUR: ['BYSQUARE', 'SEPA'] };

/**
 * The method an organiser most likely needs, from their country. Until
 * billing details exist (celek B6) the account's language stands in for it:
 * Slovak → PAY by square in EUR, German or Polish → SEPA transfer in EUR, else Czech SPD.
 */
export function suggestedMethod(locale: string | null | undefined, available: Currency[]): PaymentMethod | null {
  const wanted: PaymentMethod = locale === 'sk' ? 'BYSQUARE' : locale === 'de' || locale === 'pl' ? 'SEPA' : 'SPD';
  const currency: Currency = wanted === 'SPD' ? 'CZK' : 'EUR';
  if (available.includes(currency)) return wanted;
  const fallback = available[0];
  return fallback ? METHODS_BY_CURRENCY[fallback][0] : null;
}

/**
 * The reference a payer's bank passes on with a SEPA transfer. A Czech bank
 * shows the variable symbol of an incoming SEPA payment when the message
 * carries it as /VS/number/.
 */
export const transferMessage = (variableSymbol: number, productCode: string) => `/VS/${variableSymbol}/ ATM ${productCode}`;

/**
 * The QR payment string (Short Payment Descriptor, the Czech banks' standard).
 * `amount` is in minor units. Values may not contain `*`, the field separator.
 */
export function spdString(account: PaymentAccount, amount: number, variableSymbol: number, message: string): string {
  const clean = (value: string) => value.replace(/\*/g, ' ').slice(0, 60);
  const fields = [
    'SPD',
    '1.0',
    `ACC:${account.iban}+${account.bic}`,
    `AM:${(amount / 100).toFixed(2)}`,
    `CC:${account.currency}`,
    `X-VS:${variableSymbol}`,
    `RN:${clean(account.recipient)}`,
    `MSG:${clean(message)}`,
  ];
  return fields.join('*');
}
