import { CurrencyCode, encode, PaymentOptions } from 'bysquare/pay';
import type { PaymentAccount } from './account.js';

/**
 * PAY by square, the QR payment format of the Slovak Banking Association,
 * read by every Slovak banking app. Written with the `bysquare` library
 * (Apache-2.0, maintained, follows the SBA specification including the LZMA
 * compression and base32hex step that a hand-written encoder would get
 * wrong); pinned to an exact version in package.json.
 *
 * The variable symbol has its own field, so a Slovak bank passes it on; the
 * note carries the same /VS/…/ reference as the other formats.
 */
export function bysquareString(account: PaymentAccount, amount: number, variableSymbol: number, message: string): string {
  if (account.currency !== 'EUR') throw new Error('PAY by square is for euro transfers only');
  return encode({
    payments: [{
      type: PaymentOptions.PaymentOrder,
      amount: amount / 100,
      currencyCode: CurrencyCode.EUR,
      variableSymbol: String(variableSymbol),
      paymentNote: message.slice(0, 140),
      beneficiary: { name: account.recipient.slice(0, 70) },
      bankAccounts: [{ iban: account.iban, bic: account.bic }],
    }],
  });
}
