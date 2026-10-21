import { NextFunction, Response } from 'express';
import prisma from '../config/database.js';
import { AuthRequest } from '../types/index.js';
import { recordAudit } from '../services/audit/record.js';
import { CURRENCIES, LIMIT_KEYS, PLANS, ossEnabled, setOssEnabled, type LimitKey, type Plan } from '../services/pricing/catalog.js';
import { EU_COUNTRIES, isEuCountry, percentToBp } from '../services/pricing/vat.js';
import { ossYearTotal } from '../services/pricing/oss.js';
import { parseCalendarDate, zonedDateTime, zonedParts } from '../utils/time.js';

/**
 * Prices, VAT rates, plan limits and OSS. Every admin may look; only an
 * account with `canManagePricing` may change anything, checked here on the
 * server. Changes are new versions with a start date, never edits, and each
 * one is written to the audit log.
 */

/** Refuses a pricing change from anyone without the flag, whatever their role. */
export const requirePricingManager = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { canManagePricing: true } });
    if (!user?.canManagePricing) {
      res.status(403).json({ error: 'Only the pricing manager may change prices, VAT rates or limits', code: 'PRICING_FORBIDDEN' });
      return;
    }
    next();
  } catch (error) {
    console.error('Pricing permission error:', error);
    res.status(500).json({ error: 'Failed to check permissions' });
  }
};

class InputError extends Error {
  constructor(message: string, public readonly code: string) { super(message); }
}

/**
 * When a change takes effect: `YYYY-MM-DD` is that day's midnight in Prague,
 * today or nothing is right now. A day in the past is refused; nothing is
 * ever back-dated under an issued payment.
 */
function effectiveFrom(raw: unknown, now: Date = new Date()): Date {
  if (raw === undefined || raw === null || raw === '') return now;
  const day = typeof raw === 'string' ? parseCalendarDate(raw) : null;
  if (!day) throw new InputError('validFrom must be a date (YYYY-MM-DD)', 'VALID_FROM_FORMAT');
  const today = zonedParts(now);
  const todayKey = today.year * 10_000 + today.month * 100 + today.day;
  const dayKey = day.year * 10_000 + day.month * 100 + day.day;
  if (dayKey < todayKey) throw new InputError('validFrom cannot be in the past', 'VALID_FROM_PAST');
  return dayKey === todayKey ? now : zonedDateTime(day.year, day.month, day.day);
}

/** A whole amount of minor units (haléře, cents) above zero. */
function minorUnits(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0 || value > 100_000_000) {
    throw new InputError(`${field} must be a positive whole number of minor units`, 'PRICE_FORMAT');
  }
  return value;
}

const fail = (res: Response, error: unknown, message: string) => {
  if (error instanceof InputError) { res.status(400).json({ error: error.message, code: error.code }); return; }
  console.error(`${message}:`, error);
  res.status(500).json({ error: message });
};

/** Versions split around now: the one in force, the planned ones, the last few past ones. */
function splitVersions<T extends { validFrom: Date }>(rows: T[], now: Date) {
  const sorted = [...rows].sort((a, b) => b.validFrom.getTime() - a.validFrom.getTime());
  const past = sorted.filter((row) => row.validFrom <= now);
  return {
    current: past[0] ?? null,
    scheduled: sorted.filter((row) => row.validFrom > now).reverse(),
    history: past.slice(1, 6),
  };
}

/** GET /api/admin/pricing — the whole Pricing and VAT screen. */
export const getPricing = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const [me, products, rates, limits, oss, ossTotal] = await Promise.all([
      prisma.user.findUnique({ where: { id: req.user!.id }, select: { canManagePricing: true } }),
      prisma.product.findMany({ orderBy: { sortOrder: 'asc' }, include: { prices: true } }),
      prisma.vatRate.findMany(),
      prisma.planLimit.findMany(),
      ossEnabled(),
      ossYearTotal(),
    ]);

    const countries = [...new Set(rates.map((rate) => rate.country))].sort((a, b) => (a === 'CZ' ? -1 : b === 'CZ' ? 1 : a.localeCompare(b)));
    const limitCells = PLANS.flatMap((plan) => LIMIT_KEYS.map((key) => ({
      plan, key, ...splitVersions(limits.filter((row) => row.plan === plan && row.key === key), now),
    })));

    res.json({
      canEdit: me?.canManagePricing === true,
      currencies: CURRENCIES,
      products: products.map(({ prices, ...product }) => ({ ...product, ...splitVersions(prices, now) })),
      vatRates: countries.map((country) => ({ country, ...splitVersions(rates.filter((rate) => rate.country === country), now) })),
      euCountries: EU_COUNTRIES,
      limits: { plans: PLANS, keys: LIMIT_KEYS, cells: limitCells },
      oss: { enabled: oss, ...ossTotal },
    });
  } catch (error) {
    fail(res, error, 'Failed to load pricing');
  }
};

/** POST /api/admin/pricing/products/:code/prices — `{ priceCzk, priceEur, validFrom? }` in minor units. */
export const createPrice = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const product = await prisma.product.findUnique({ where: { code: req.params.code } });
    if (!product) { res.status(404).json({ error: 'Product not found' }); return; }
    const priceCzk = minorUnits(req.body?.priceCzk, 'priceCzk');
    const priceEur = minorUnits(req.body?.priceEur, 'priceEur');
    const validFrom = effectiveFrom(req.body?.validFrom);

    const clash = await prisma.productPrice.findFirst({ where: { productId: product.id, validFrom } });
    if (clash) { res.status(409).json({ error: 'A price already starts at that moment', code: 'VERSION_EXISTS' }); return; }

    const version = await prisma.$transaction(async (tx) => {
      const created = await tx.productPrice.create({
        data: { productId: product.id, priceCzk, priceEur, validFrom, createdById: req.user!.id },
      });
      await recordAudit({
        entityType: 'ProductPrice',
        entityId: created.id,
        action: 'CREATE',
        after: { product: product.code, priceCzk, priceEur, validFrom: validFrom.toISOString() },
        reason: typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 500) || null : null,
        actorId: req.user!.id,
      }, tx);
      return created;
    });
    res.status(201).json(version);
  } catch (error) {
    fail(res, error, 'Failed to create the price');
  }
};

/** DELETE /api/admin/pricing/prices/:id — withdraws a planned price that has not started. */
export const cancelPrice = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const version = await prisma.productPrice.findUnique({ where: { id: req.params.id }, include: { product: true } });
    if (!version) { res.status(404).json({ error: 'Price not found' }); return; }
    if (version.validFrom <= new Date()) {
      res.status(409).json({ error: 'A price already in force cannot be withdrawn; plan a new one', code: 'VERSION_IN_FORCE' });
      return;
    }
    await prisma.$transaction(async (tx) => {
      await tx.productPrice.delete({ where: { id: version.id } });
      await recordAudit({
        entityType: 'ProductPrice',
        entityId: version.id,
        action: 'DELETE',
        before: { product: version.product.code, priceCzk: version.priceCzk, priceEur: version.priceEur, validFrom: version.validFrom.toISOString() },
        actorId: req.user!.id,
      }, tx);
    });
    res.json({ deleted: true });
  } catch (error) {
    fail(res, error, 'Failed to withdraw the price');
  }
};

/** POST /api/admin/pricing/vat-rates — `{ country, ratePercent, validFrom? }` */
export const createVatRate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const country = typeof req.body?.country === 'string' ? req.body.country.toUpperCase() : '';
    if (!isEuCountry(country)) throw new InputError('country must be an EU member state code', 'COUNTRY');
    const rateBp = percentToBp(req.body?.ratePercent);
    if (rateBp === null) throw new InputError('ratePercent must be between 0 and 100, at most two decimals', 'RATE_FORMAT');
    const validFrom = effectiveFrom(req.body?.validFrom);

    const clash = await prisma.vatRate.findFirst({ where: { country, validFrom } });
    if (clash) { res.status(409).json({ error: 'A rate already starts at that moment', code: 'VERSION_EXISTS' }); return; }

    const rate = await prisma.$transaction(async (tx) => {
      const created = await tx.vatRate.create({ data: { country, rateBp, validFrom, createdById: req.user!.id } });
      await recordAudit({
        entityType: 'VatRate',
        entityId: created.id,
        action: 'CREATE',
        after: { country, rateBp, validFrom: validFrom.toISOString() },
        actorId: req.user!.id,
      }, tx);
      return created;
    });
    res.status(201).json(rate);
  } catch (error) {
    fail(res, error, 'Failed to create the VAT rate');
  }
};

/** DELETE /api/admin/pricing/vat-rates/:id — withdraws a planned rate that has not started. */
export const cancelVatRate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rate = await prisma.vatRate.findUnique({ where: { id: req.params.id } });
    if (!rate) { res.status(404).json({ error: 'VAT rate not found' }); return; }
    if (rate.validFrom <= new Date()) {
      res.status(409).json({ error: 'A rate already in force cannot be withdrawn; plan a new one', code: 'VERSION_IN_FORCE' });
      return;
    }
    await prisma.$transaction(async (tx) => {
      await tx.vatRate.delete({ where: { id: rate.id } });
      await recordAudit({
        entityType: 'VatRate',
        entityId: rate.id,
        action: 'DELETE',
        before: { country: rate.country, rateBp: rate.rateBp, validFrom: rate.validFrom.toISOString() },
        actorId: req.user!.id,
      }, tx);
    });
    res.json({ deleted: true });
  } catch (error) {
    fail(res, error, 'Failed to withdraw the VAT rate');
  }
};

/**
 * POST /api/admin/pricing/limits — `{ validFrom?, values: [{ plan, key, value }] }`
 *
 * One batch, one start date. `value` null is unlimited.
 */
export const createLimits = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const values = req.body?.values;
    if (!Array.isArray(values) || values.length === 0 || values.length > PLANS.length * LIMIT_KEYS.length) {
      throw new InputError('values must list the limits to change', 'LIMITS_FORMAT');
    }
    const parsed = values.map((entry: { plan?: unknown; key?: unknown; value?: unknown }) => {
      if (!PLANS.includes(entry?.plan as Plan) || !LIMIT_KEYS.includes(entry?.key as LimitKey)) {
        throw new InputError('Unknown plan or limit', 'LIMITS_FORMAT');
      }
      if (entry.value !== null && (typeof entry.value !== 'number' || !Number.isInteger(entry.value) || entry.value < 0 || entry.value > 1_000_000)) {
        throw new InputError('A limit is a whole number of 0 or more, or null for unlimited', 'LIMITS_FORMAT');
      }
      return { plan: entry.plan as Plan, key: entry.key as LimitKey, value: entry.value as number | null };
    });
    if (new Set(parsed.map((entry) => `${entry.plan}:${entry.key}`)).size !== parsed.length) {
      throw new InputError('Each limit may appear once', 'LIMITS_FORMAT');
    }
    const validFrom = effectiveFrom(req.body?.validFrom);

    const created = await prisma.$transaction(async (tx) => {
      const rows = [];
      for (const entry of parsed) {
        const row = await tx.planLimit.create({ data: { ...entry, validFrom, createdById: req.user!.id } });
        await recordAudit({
          entityType: 'PlanLimit',
          entityId: row.id,
          action: 'CREATE',
          after: { ...entry, validFrom: validFrom.toISOString() },
          actorId: req.user!.id,
        }, tx);
        rows.push(row);
      }
      return rows;
    });
    res.status(201).json(created);
  } catch (error) {
    fail(res, error, 'Failed to change the limits');
  }
};

/** PUT /api/admin/pricing/oss — `{ enabled, reason }`; takes effect for payments created from now on. */
export const updateOss = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const enabled = req.body?.enabled;
    if (typeof enabled !== 'boolean') throw new InputError('enabled must be true or false', 'OSS_FORMAT');
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 500) : '';
    if (!reason) throw new InputError('A reason is required to switch OSS', 'REASON_REQUIRED');
    const before = await ossEnabled();
    if (before === enabled) { res.json({ enabled }); return; }

    await prisma.$transaction(async (tx) => {
      await setOssEnabled(enabled, tx);
      await recordAudit({
        entityType: 'Setting',
        entityId: 'oss',
        action: 'UPDATE',
        before: { enabled: before },
        after: { enabled },
        reason,
        actorId: req.user!.id,
      }, tx);
    });
    res.json({ enabled });
  } catch (error) {
    fail(res, error, 'Failed to switch OSS');
  }
};
