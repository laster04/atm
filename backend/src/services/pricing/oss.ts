/**
 * The EU-wide 10 000 € threshold for B2C sales to other member states. Below
 * it, Czech VAT may be charged; past it, OSS has to be switched on. Celek B
 * feeds paid payments in; until then there is nothing to count.
 */

/** 10 000 € in cents. */
export const OSS_LIMIT_EUR_CENTS = 1_000_000;
/** The admin is warned at 80 % of the threshold, and again past it. */
export const OSS_WARNING_SHARE = 0.8;

export type OssLevel = 'OK' | 'WARNING' | 'EXCEEDED';

export function ossLevel(totalEurCents: number): OssLevel {
  if (totalEurCents > OSS_LIMIT_EUR_CENTS) return 'EXCEEDED';
  if (totalEurCents >= OSS_LIMIT_EUR_CENTS * OSS_WARNING_SHARE) return 'WARNING';
  return 'OK';
}

/**
 * The level a new sale moved the year's total into, when it moved up; null
 * otherwise. The caller emails the admins once per crossing.
 */
export function ossCrossing(beforeEurCents: number, afterEurCents: number): Exclude<OssLevel, 'OK'> | null {
  const before = ossLevel(beforeEurCents);
  const after = ossLevel(afterEurCents);
  if (after === before || after === 'OK') return null;
  return after;
}

/**
 * Sales to customers in other EU countries without a VAT ID, this calendar
 * year, in euro cents.
 *
 * TODO(celek B): sum paid payments with vatMode DOMESTIC or OSS whose country
 * is not CZ. CZK payments count at the ČNB rate of their tax point, which the
 * payment snapshot has to carry for this.
 */
export async function ossYearTotal(year: number = new Date().getFullYear()): Promise<{
  year: number;
  totalEurCents: number;
  limitEurCents: number;
  level: OssLevel;
  /** False until payments exist, so the screen can say the number is not live yet. */
  tracked: boolean;
}> {
  const totalEurCents = 0;
  return { year, totalEurCents, limitEurCents: OSS_LIMIT_EUR_CENTS, level: ossLevel(totalEurCents), tracked: false };
}
