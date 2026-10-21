/**
 * VAT rules and arithmetic, with no database: what rate a customer pays and
 * how a VAT-inclusive price splits into base and tax. The rule table is on
 * canvas page 14; the accountant of Conesoft s.r.o. confirms it before launch.
 */

/** EU member states by ISO 3166 code (GR for Greece; VIES calls it EL). */
export const EU_COUNTRIES = [
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU',
  'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK',
] as const;

export type EuCountry = (typeof EU_COUNTRIES)[number];

export const HOME_COUNTRY: EuCountry = 'CZ';

export const isEuCountry = (value: unknown): value is EuCountry =>
  typeof value === 'string' && (EU_COUNTRIES as readonly string[]).includes(value);

/**
 * - DOMESTIC: the Czech rate.
 * - REVERSE_CHARGE: 0 %, the customer accounts for the VAT; the document says so.
 * - OSS: the customer's country's rate, declared through One Stop Shop.
 */
export type VatMode = 'DOMESTIC' | 'REVERSE_CHARGE' | 'OSS';

/** What VIES said about the customer's VAT ID, or null when they gave none. */
export type VatIdStatus = 'VALID' | 'INVALID' | 'UNAVAILABLE' | null;

export class VatRuleError extends Error {
  constructor(public readonly code: 'COUNTRY_NOT_SUPPORTED' | 'NO_VAT_RATE', message: string) {
    super(message);
  }
}

/**
 * Which rate applies. `rateCountry` is whose rate to look up; null means 0 %.
 *
 * A VAT ID VIES could not confirm counts as no VAT ID with OSS off, i.e. the
 * Czech rate, until a retry gets an answer: charging 0 % without the evidence
 * is the one mistake that cannot be fixed later on the customer's side.
 */
export function vatRule(input: {
  country: string;
  vatIdStatus: VatIdStatus;
  ossEnabled: boolean;
}): { mode: VatMode; rateCountry: EuCountry | null } {
  const { country, vatIdStatus, ossEnabled } = input;
  if (!isEuCountry(country)) {
    throw new VatRuleError('COUNTRY_NOT_SUPPORTED', `Customers outside the EU are not supported yet (${country})`);
  }
  if (country === HOME_COUNTRY) return { mode: 'DOMESTIC', rateCountry: HOME_COUNTRY };
  if (vatIdStatus === 'VALID') return { mode: 'REVERSE_CHARGE', rateCountry: null };
  if (vatIdStatus === 'UNAVAILABLE' || !ossEnabled) return { mode: 'DOMESTIC', rateCountry: HOME_COUNTRY };
  return { mode: 'OSS', rateCountry: country };
}

/**
 * Splits a VAT-inclusive price per § 37 of the Czech VAT Act: the tax is
 * computed from the price with VAT, VAT = gross × rate / (100 + rate), rounded
 * half up to the haléř or cent, and the base is what remains, so base + VAT is
 * always exactly the price. Amounts are minor units; the rate is hundredths of
 * a percent (2100 = 21 %). Integer arithmetic only, so a .5 never drifts.
 */
export function splitGross(grossMinor: number, rateBp: number): { base: number; vat: number } {
  if (!Number.isInteger(grossMinor) || grossMinor < 0) throw new Error('gross must be a non-negative integer');
  if (!Number.isInteger(rateBp) || rateBp < 0) throw new Error('rate must be a non-negative integer');
  const numerator = grossMinor * rateBp;
  const denominator = 10_000 + rateBp;
  const vat = Math.floor((2 * numerator + denominator) / (2 * denominator));
  return { base: grossMinor - vat, vat };
}

/** `21` or `"20.5"` as hundredths of a percent; null when not a sane rate. */
export function percentToBp(value: unknown): number | null {
  const number = typeof value === 'string' ? Number(value.replace(',', '.')) : value;
  if (typeof number !== 'number' || !Number.isFinite(number) || number < 0 || number > 100) return null;
  const bp = Math.round(number * 100);
  return Math.abs(bp - number * 100) < 1e-6 ? bp : null;
}
