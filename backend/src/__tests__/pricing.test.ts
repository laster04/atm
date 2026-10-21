import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import prisma from '../config/database.js';
import { percentToBp, splitGross, vatRule } from '../services/pricing/vat.js';
import { limitAt, ossEnabled, priceAt, quote, setOssEnabled, PricingError } from '../services/pricing/catalog.js';
import { ossCrossing, ossLevel } from '../services/pricing/oss.js';
import { checkVatId, parseVatId, queryVies, retryUnavailableVatChecks, type Fetcher } from '../services/billing/vies.js';
import { clearAresCache, isValidIco, lookupCompany } from '../services/billing/ares.js';
import { resetBillingRateLimit } from '../controllers/billingController.js';

const stamp = Date.now();
const tag = `prc${stamp}`;
const auth = (value: string) => ({ Authorization: `Bearer ${value}` });

async function account(label: string, role: 'ADMIN' | 'USER', canManagePricing = false) {
  const email = `${label}-${tag}@test.com`;
  const user = await prisma.user.create({
    data: { email, password: await bcrypt.hash('password123', 10), name: label, role, active: true, emailVerified: true, canManagePricing },
  });
  const login = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
  return { id: user.id, token: login.body.token as string };
}

/** A fetch stand-in answering every call with the given status and JSON body. */
const answering = (status: number, body: unknown): Fetcher =>
  (async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })) as Fetcher;
const failing: Fetcher = (async () => { throw new Error('network down'); }) as Fetcher;

/** A day well ahead, so a test's versions never apply to anything else. */
const FUTURE = '2031-03-01';
const futureInstant = new Date('2031-03-01T12:00:00Z');

let manager: Awaited<ReturnType<typeof account>>;
let viewer: Awaited<ReturnType<typeof account>>;
let member: Awaited<ReturnType<typeof account>>;
const vatNumbers: string[] = [];

beforeAll(async () => {
  manager = await account('pricing-manager', 'ADMIN', true);
  viewer = await account('pricing-viewer', 'ADMIN');
  member = await account('pricing-member', 'USER');
});

afterEach(async () => {
  await setOssEnabled(false);
  resetBillingRateLimit();
});

afterAll(async () => {
  const ids = [manager.id, viewer.id, member.id];
  // Versions this suite made all start in the far future; the seeded ones stay.
  await prisma.productPrice.deleteMany({ where: { validFrom: { gte: new Date('2030-01-01') } } });
  await prisma.vatRate.deleteMany({ where: { validFrom: { gte: new Date('2030-01-01') } } });
  await prisma.planLimit.deleteMany({ where: { validFrom: { gte: new Date('2030-01-01') } } });
  await prisma.vatCheck.deleteMany({ where: { vatNumber: { in: vatNumbers } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

describe('splitGross (§ 37)', () => {
  it('matches the worked examples on the canvas', () => {
    expect(splitGross(69000, 2100)).toEqual({ base: 57025, vat: 11975 });
    expect(splitGross(79000, 2100)).toEqual({ base: 65289, vat: 13711 });
    expect(splitGross(149000, 2100)).toEqual({ base: 123140, vat: 25860 });
    expect(splitGross(3300, 2300)).toEqual({ base: 2683, vat: 617 });
  });

  it('always adds up to the price, and 0 % leaves it whole', () => {
    const wrong: string[] = [];
    for (let gross = 1; gross < 20000; gross += 7) {
      for (const rate of [500, 1000, 1200, 1900, 2000, 2100, 2300, 2700]) {
        const { base, vat } = splitGross(gross, rate);
        if (base + vat !== gross || Math.abs(vat - (gross * rate) / (10000 + rate)) > 0.5) wrong.push(`${gross}@${rate}`);
      }
    }
    expect(wrong).toEqual([]);
    expect(splitGross(2900, 0)).toEqual({ base: 2900, vat: 0 });
  });

  it('rounds a half up', () => {
    // 121 × 21 / 121 = 21 exactly; 1 × 10000 / 20000 = 0.5 → 1.
    expect(splitGross(121, 2100).vat).toBe(21);
    expect(splitGross(1, 10000).vat).toBe(1);
  });

  it('reads percentages', () => {
    expect(percentToBp(21)).toBe(2100);
    expect(percentToBp('20,5')).toBe(2050);
    expect(percentToBp(8.125)).toBeNull();
    expect(percentToBp(-1)).toBeNull();
    expect(percentToBp('x')).toBeNull();
  });
});

describe('vatRule', () => {
  it('covers the four rows of the table', () => {
    expect(vatRule({ country: 'CZ', vatIdStatus: 'VALID', ossEnabled: true })).toEqual({ mode: 'DOMESTIC', rateCountry: 'CZ' });
    expect(vatRule({ country: 'SK', vatIdStatus: 'VALID', ossEnabled: false })).toEqual({ mode: 'REVERSE_CHARGE', rateCountry: null });
    expect(vatRule({ country: 'SK', vatIdStatus: null, ossEnabled: false })).toEqual({ mode: 'DOMESTIC', rateCountry: 'CZ' });
    expect(vatRule({ country: 'SK', vatIdStatus: null, ossEnabled: true })).toEqual({ mode: 'OSS', rateCountry: 'SK' });
  });

  it('charges Czech VAT while VIES has not answered, and treats an invalid ID as none', () => {
    expect(vatRule({ country: 'DE', vatIdStatus: 'UNAVAILABLE', ossEnabled: true })).toEqual({ mode: 'DOMESTIC', rateCountry: 'CZ' });
    expect(vatRule({ country: 'DE', vatIdStatus: 'INVALID', ossEnabled: true })).toEqual({ mode: 'OSS', rateCountry: 'DE' });
  });

  it('refuses countries outside the EU', () => {
    expect(() => vatRule({ country: 'US', vatIdStatus: null, ossEnabled: false })).toThrow('outside the EU');
  });
});

describe('OSS threshold', () => {
  it('warns at 80 % and past 10 000 €, once per crossing', () => {
    expect(ossLevel(799_999)).toBe('OK');
    expect(ossLevel(800_000)).toBe('WARNING');
    expect(ossLevel(1_000_001)).toBe('EXCEEDED');
    expect(ossCrossing(790_000, 810_000)).toBe('WARNING');
    expect(ossCrossing(810_000, 820_000)).toBeNull();
    expect(ossCrossing(810_000, 1_000_100)).toBe('EXCEEDED');
    expect(ossCrossing(0, 2_000_000)).toBe('EXCEEDED');
  });
});

describe('quote', () => {
  it('uses the seeded prices and the Czech rate', async () => {
    const czk = await quote({ productCode: 'TOURNAMENT', currency: 'CZK', country: 'CZ' });
    expect(czk).toMatchObject({ gross: 69000, vat: 11975, base: 57025, vatRateBp: 2100, vatMode: 'DOMESTIC', productCode: 'TOURNAMENT' });
    const eur = await quote({ productCode: 'TOURNAMENT_PLUS', currency: 'EUR', country: 'CZ' });
    expect(eur).toMatchObject({ gross: 5900, vatRateBp: 2100 });
  });

  it('charges 0 % to an EU business with a confirmed VAT ID', async () => {
    const result = await quote({
      productCode: 'TOURNAMENT', currency: 'EUR', country: 'SK',
      vatId: 'SK2020000000', vatCheck: { id: 'check-1', status: 'VALID' },
    });
    expect(result).toMatchObject({ gross: 2900, vat: 0, base: 2900, vatMode: 'REVERSE_CHARGE', vatCheckId: 'check-1' });
  });

  it('takes the customer country rate with OSS on, and needs that rate to exist', async () => {
    await setOssEnabled(true);
    await expect(quote({ productCode: 'TOURNAMENT', currency: 'EUR', country: 'SK' })).rejects.toMatchObject({ code: 'NO_VAT_RATE' });

    await prisma.vatRate.create({ data: { country: 'SK', rateBp: 2300, validFrom: new Date('2031-01-01T00:00:00Z') } });
    const result = await quote({ productCode: 'TOURNAMENT', currency: 'EUR', country: 'SK', at: futureInstant });
    expect(result).toMatchObject({ vatMode: 'OSS', vatRateBp: 2300, vat: 542, base: 2358 });
  });

  it('reports unknown products', async () => {
    await expect(quote({ productCode: 'NOPE', currency: 'CZK', country: 'CZ' })).rejects.toBeInstanceOf(PricingError);
  });
});

describe('admin pricing API', () => {
  it('lets every admin look and only the pricing manager change', async () => {
    const asViewer = await request(app).get('/api/admin/pricing').set(auth(viewer.token));
    expect(asViewer.status).toBe(200);
    expect(asViewer.body.canEdit).toBe(false);
    expect(asViewer.body.products.map((row: { code: string }) => row.code)).toEqual(['TOURNAMENT', 'TOURNAMENT_PLUS', 'ORGANIZER_YEAR']);
    expect(asViewer.body.products[0].current).toMatchObject({ priceCzk: 69000, priceEur: 2900 });
    expect(asViewer.body.oss).toMatchObject({ enabled: false, limitEurCents: 1_000_000, tracked: false });

    const refused = await request(app).post('/api/admin/pricing/products/TOURNAMENT/prices').set(auth(viewer.token))
      .send({ priceCzk: 79000, priceEur: 3300, validFrom: FUTURE });
    expect(refused.status).toBe(403);
    expect((await request(app).get('/api/admin/pricing').set(auth(member.token))).status).toBe(403);

    const asManager = await request(app).get('/api/admin/pricing').set(auth(manager.token));
    expect(asManager.body.canEdit).toBe(true);
  });

  it('plans a price change that applies exactly from its day', async () => {
    const past = await request(app).post('/api/admin/pricing/products/TOURNAMENT/prices').set(auth(manager.token))
      .send({ priceCzk: 79000, priceEur: 3300, validFrom: '2020-01-01' });
    expect(past.status).toBe(400);
    expect(past.body.code).toBe('VALID_FROM_PAST');

    const halves = await request(app).post('/api/admin/pricing/products/TOURNAMENT/prices').set(auth(manager.token))
      .send({ priceCzk: 790.5, priceEur: 3300, validFrom: FUTURE });
    expect(halves.status).toBe(400);

    const created = await request(app).post('/api/admin/pricing/products/TOURNAMENT/prices').set(auth(manager.token))
      .send({ priceCzk: 79000, priceEur: 3300, validFrom: FUTURE });
    expect(created.status).toBe(201);
    // Midnight in Prague, which is 23:00 UTC the day before in winter.
    expect(created.body.validFrom).toBe('2031-02-28T23:00:00.000Z');

    const twice = await request(app).post('/api/admin/pricing/products/TOURNAMENT/prices').set(auth(manager.token))
      .send({ priceCzk: 80000, priceEur: 3400, validFrom: FUTURE });
    expect(twice.status).toBe(409);

    expect((await priceAt('TOURNAMENT', new Date('2031-02-28T22:59:59Z')))?.priceCzk).toBe(69000);
    expect((await priceAt('TOURNAMENT', new Date('2031-02-28T23:00:00Z')))?.priceCzk).toBe(79000);
    expect((await priceAt('TOURNAMENT'))?.priceCzk).toBe(69000);

    const audit = await prisma.auditLog.findFirst({ where: { entityType: 'ProductPrice', entityId: created.body.id } });
    expect(audit).toMatchObject({ action: 'CREATE', actorId: manager.id });

    const withdrawn = await request(app).delete(`/api/admin/pricing/prices/${created.body.id}`).set(auth(manager.token));
    expect(withdrawn.status).toBe(200);
    expect((await priceAt('TOURNAMENT', futureInstant))?.priceCzk).toBe(69000);
  });

  it('never withdraws a price already in force', async () => {
    const current = await priceAt('TOURNAMENT');
    const res = await request(app).delete(`/api/admin/pricing/prices/${current!.id}`).set(auth(manager.token));
    expect(res.status).toBe(409);
  });

  it('adds VAT rates for EU countries only', async () => {
    const bad = await request(app).post('/api/admin/pricing/vat-rates').set(auth(manager.token))
      .send({ country: 'US', ratePercent: 10, validFrom: FUTURE });
    expect(bad.status).toBe(400);
    const ok = await request(app).post('/api/admin/pricing/vat-rates').set(auth(manager.token))
      .send({ country: 'at', ratePercent: '20', validFrom: FUTURE });
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ country: 'AT', rateBp: 2000 });
  });

  it('versions plan limits in one batch', async () => {
    const res = await request(app).post('/api/admin/pricing/limits').set(auth(manager.token)).send({
      validFrom: FUTURE,
      values: [{ plan: 'FREE', key: 'TEAMS_PER_TOURNAMENT', value: 8 }, { plan: 'TOURNAMENT', key: 'TEAMS_PER_TOURNAMENT', value: null }],
    });
    expect(res.status).toBe(201);
    expect(await limitAt('FREE', 'TEAMS_PER_TOURNAMENT')).toBe(6);
    expect(await limitAt('FREE', 'TEAMS_PER_TOURNAMENT', futureInstant)).toBe(8);
    expect(await limitAt('TOURNAMENT', 'TEAMS_PER_TOURNAMENT', futureInstant)).toBeNull();

    const bad = await request(app).post('/api/admin/pricing/limits').set(auth(manager.token))
      .send({ values: [{ plan: 'FREE', key: 'TEAMS_PER_TOURNAMENT', value: -1 }] });
    expect(bad.status).toBe(400);
  });

  it('switches OSS only with a reason, and logs it', async () => {
    const noReason = await request(app).put('/api/admin/pricing/oss').set(auth(manager.token)).send({ enabled: true });
    expect(noReason.status).toBe(400);
    const on = await request(app).put('/api/admin/pricing/oss').set(auth(manager.token)).send({ enabled: true, reason: 'Over the limit' });
    expect(on.body).toEqual({ enabled: true });
    expect(await ossEnabled()).toBe(true);
    const audit = await prisma.auditLog.findFirst({ where: { entityType: 'Setting', entityId: 'oss', actorId: manager.id } });
    expect(audit).toMatchObject({ reason: 'Over the limit', after: { enabled: true } });
  });
});

describe('VIES', () => {
  const number = () => {
    const value = `${stamp % 1_000_000_000}${vatNumbers.length}`;
    vatNumbers.push(value);
    return value;
  };

  it('parses VAT IDs the way VIES wants them', () => {
    expect(parseVatId(' sk 2020-123.456 ')).toEqual({ countryCode: 'SK', vatNumber: '2020123456' });
    expect(parseVatId('GR123456789')).toEqual({ countryCode: 'EL', vatNumber: '123456789' });
    expect(() => parseVatId('12345678')).toThrow();
  });

  it('reads an answer, and treats errors and outages as unavailable', async () => {
    const valid = await queryVies('SK', '1', answering(200, {
      valid: true, name: 'Firma s.r.o.', address: '---', requestIdentifier: 'WAPIAAAA', requestDate: '2026-10-21T10:00:00Z',
    }));
    expect(valid).toMatchObject({ status: 'VALID', name: 'Firma s.r.o.', address: null, requestIdentifier: 'WAPIAAAA' });
    expect((await queryVies('SK', '1', answering(200, { valid: false }))).status).toBe('INVALID');
    expect((await queryVies('SK', '1', answering(500, { actionSucceed: false, errorWrappers: [{ error: 'MS_UNAVAILABLE' }] }))).status).toBe('UNAVAILABLE');
    expect((await queryVies('SK', '1', answering(200, { valid: false, userError: 'MS_MAX_CONCURRENT_REQ' }))).status).toBe('UNAVAILABLE');
    expect((await queryVies('SK', '1', failing)).status).toBe('UNAVAILABLE');
  });

  it('stores the check, reuses a definite answer for a day, and retries an outage', async () => {
    const valid = number();
    const first = await checkVatId(`SK${valid}`, member.id, answering(200, { valid: true, requestIdentifier: 'WAPI1' }));
    expect(first).toMatchObject({ status: 'VALID', requestIdentifier: 'WAPI1', nextRetryAt: null });
    const again = await checkVatId(`SK${valid}`, member.id, failing);
    expect(again.id).toBe(first.id);

    const down = number();
    const pending = await checkVatId(`DE${down}`, member.id, failing);
    expect(pending.status).toBe('UNAVAILABLE');
    expect(pending.nextRetryAt).not.toBeNull();

    const answered = await retryUnavailableVatChecks(answering(200, { valid: true, requestIdentifier: 'WAPI2' }), new Date(Date.now() + 60 * 60 * 1000));
    expect(answered).toBeGreaterThanOrEqual(1);
    const after = await prisma.vatCheck.findUnique({ where: { id: pending.id } });
    expect(after).toMatchObject({ status: 'VALID', attempts: 2, requestIdentifier: 'WAPI2', nextRetryAt: null });
  });
});

describe('ARES', () => {
  beforeEach(() => clearAresCache());

  it('checks the IČO check digit', () => {
    expect(isValidIco('00006947')).toBe(true);
    expect(isValidIco('00006948')).toBe(false);
    expect(isValidIco('1234567')).toBe(false);
  });

  it('maps a subject, and tells unknown from unavailable', async () => {
    const company = await lookupCompany('00006947', answering(200, {
      ico: '00006947', obchodniJmeno: 'Ministerstvo financí', dic: 'CZ00006947',
      sidlo: { kodStatu: 'CZ', nazevObce: 'Praha', psc: 11800, nazevUlice: 'Letenská', cisloDomovni: 525, cisloOrientacni: 15, textovaAdresa: 'Letenská 525/15, Malá Strana, 11800 Praha 1' },
    }));
    expect(company).toEqual({
      ico: '00006947', name: 'Ministerstvo financí', vatId: 'CZ00006947',
      address: { street: 'Letenská 525/15', city: 'Praha', postalCode: '11800', country: 'CZ', text: 'Letenská 525/15, Malá Strana, 11800 Praha 1' },
    });
    clearAresCache();
    expect(await lookupCompany('00006947', answering(404, {}))).toBeNull();
    clearAresCache();
    await expect(lookupCompany('00006947', answering(500, {}))).rejects.toThrow();
    await expect(lookupCompany('00006947', failing)).rejects.toThrow();
  });

  it('guards the endpoints', async () => {
    expect((await request(app).get('/api/billing/company/00006947')).status).toBe(401);
    expect((await request(app).get('/api/billing/company/00006948').set(auth(member.token))).status).toBe(400);
    const badVat = await request(app).post('/api/billing/vat-check').set(auth(member.token)).send({ vatId: '123' });
    expect(badVat.status).toBe(400);
    expect(badVat.body.code).toBe('VAT_ID_FORMAT');
  });
});
