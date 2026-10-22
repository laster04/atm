import type { Currency } from '../pricing/catalog.js';

/**
 * The accounts organisers pay ATM's plans to, one per currency: Conesoft
 * s.r.o. at Air Bank. Fixed company data, like the issuer on the tax document.
 */

export interface PaymentAccount {
  currency: Currency;
  /** As Czech banks print it, e.g. 3573655016/3030. */
  local: string;
  iban: string;
  bic: string;
  recipient: string;
}

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

const RECIPIENT = 'Conesoft s.r.o.';
// Air Bank; goes into the QR code for payers from abroad. Verify with the bank before launch.
const BIC = 'AIRACZPP';
const LOCAL: Record<Currency, string> = { CZK: '3573655016/3030', EUR: '3573655032/3030' };

export const paymentAccount = (currency: Currency): PaymentAccount => ({
  currency,
  local: LOCAL[currency],
  iban: czechIban(LOCAL[currency])!,
  bic: BIC,
  recipient: RECIPIENT,
});

/** Currencies an organiser can pay in. */
export const payableCurrencies = (): Currency[] => ['CZK', 'EUR'];

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
