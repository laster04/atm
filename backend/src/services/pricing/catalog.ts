import prisma, { type DbClient } from '../../config/database.js';
import { splitGross, vatRule, VatRuleError, type VatIdStatus, type VatMode } from './vat.js';

/**
 * Prices, VAT rates, plan limits and the OSS switch as they stand at a given
 * moment. Celek B reads everything through here, never from config.
 */

export const PLANS = ['FREE', 'TOURNAMENT', 'TOURNAMENT_PLUS', 'ORGANIZER'] as const;
export type Plan = (typeof PLANS)[number];

export const LIMIT_KEYS = ['TEAMS_PER_TOURNAMENT', 'SPONSOR_LOGOS', 'DOCUMENTS', 'DOCUMENT_MAX_MB', 'LOGO_MAX_MB'] as const;
export type LimitKey = (typeof LIMIT_KEYS)[number];

export const CURRENCIES = ['CZK', 'EUR'] as const;
export type Currency = (typeof CURRENCIES)[number];

const OSS_KEY = 'oss';

/** The version of a product's price in force at `at`. */
export async function priceAt(code: string, at: Date = new Date(), tx: DbClient = prisma) {
  return tx.productPrice.findFirst({
    where: { product: { code }, validFrom: { lte: at } },
    orderBy: { validFrom: 'desc' },
    include: { product: true },
  });
}

/** The version of a country's VAT rate in force at `at`. */
export async function vatRateAt(country: string, at: Date = new Date(), tx: DbClient = prisma) {
  return tx.vatRate.findFirst({
    where: { country, validFrom: { lte: at } },
    orderBy: { validFrom: 'desc' },
  });
}

/** Every plan limit in force at `at`; a missing pair means no row was ever set. */
export async function limitsAt(at: Date = new Date(), tx: DbClient = prisma) {
  return tx.planLimit.findMany({
    where: { validFrom: { lte: at } },
    orderBy: { validFrom: 'desc' },
    distinct: ['plan', 'key'],
  });
}

/** One limit; `null` is unlimited, `undefined` means it was never set. */
export async function limitAt(plan: Plan, key: LimitKey, at: Date = new Date(), tx: DbClient = prisma) {
  const row = await tx.planLimit.findFirst({
    where: { plan, key, validFrom: { lte: at } },
    orderBy: { validFrom: 'desc' },
  });
  return row ? row.value : undefined;
}

export async function ossEnabled(tx: DbClient = prisma): Promise<boolean> {
  const row = await tx.appSetting.findUnique({ where: { key: OSS_KEY } });
  return (row?.value as { enabled?: boolean } | null)?.enabled === true;
}

export async function setOssEnabled(enabled: boolean, tx: DbClient = prisma): Promise<void> {
  await tx.appSetting.upsert({
    where: { key: OSS_KEY },
    create: { key: OSS_KEY, value: { enabled } },
    update: { value: { enabled } },
  });
}

/**
 * What a payment stores at the moment it is created. Nothing in it is looked
 * up again later, so a new price or rate never changes an issued document.
 */
export interface PriceSnapshot {
  productCode: string;
  productName: { cs: string; en: string };
  priceVersionId: string;
  currency: Currency;
  /** Minor units, VAT included. */
  gross: number;
  base: number;
  vat: number;
  vatRateBp: number;
  vatRateId: string | null;
  vatMode: VatMode;
  country: string;
  vatId: string | null;
  vatCheckId: string | null;
  quotedAt: string;
}

export class PricingError extends Error {
  constructor(public readonly code: 'UNKNOWN_PRODUCT' | 'NO_PRICE' | 'COUNTRY_NOT_SUPPORTED' | 'NO_VAT_RATE', message: string) {
    super(message);
  }
}

/**
 * The full price breakdown for one product, currency and customer, at `at`.
 * `vatCheck` is the customer's latest VIES lookup, if they gave a VAT ID.
 */
export async function quote(input: {
  productCode: string;
  currency: Currency;
  country: string;
  vatId?: string | null;
  vatCheck?: { id: string; status: Exclude<VatIdStatus, null> } | null;
  at?: Date;
}, tx: DbClient = prisma): Promise<PriceSnapshot> {
  const at = input.at ?? new Date();
  const price = await priceAt(input.productCode, at, tx);
  if (!price) {
    const exists = await tx.product.count({ where: { code: input.productCode } });
    throw new PricingError(exists ? 'NO_PRICE' : 'UNKNOWN_PRODUCT', `No price for ${input.productCode}`);
  }

  let rule;
  try {
    rule = vatRule({
      country: input.country,
      vatIdStatus: input.vatId ? (input.vatCheck?.status ?? 'UNAVAILABLE') : null,
      ossEnabled: await ossEnabled(tx),
    });
  } catch (error) {
    if (error instanceof VatRuleError) throw new PricingError(error.code, error.message);
    throw error;
  }

  const rate = rule.rateCountry ? await vatRateAt(rule.rateCountry, at, tx) : null;
  if (rule.rateCountry && !rate) {
    throw new PricingError('NO_VAT_RATE', `No VAT rate for ${rule.rateCountry}`);
  }
  const rateBp = rate?.rateBp ?? 0;
  const gross = input.currency === 'CZK' ? price.priceCzk : price.priceEur;
  const { base, vat } = splitGross(gross, rateBp);

  return {
    productCode: price.product.code,
    productName: { cs: price.product.nameCs, en: price.product.nameEn },
    priceVersionId: price.id,
    currency: input.currency,
    gross,
    base,
    vat,
    vatRateBp: rateBp,
    vatRateId: rate?.id ?? null,
    vatMode: rule.mode,
    country: input.country,
    vatId: input.vatId ?? null,
    vatCheckId: input.vatCheck?.id ?? null,
    quotedAt: at.toISOString(),
  };
}
