import { jest } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import prisma from '../config/database.js';
import emailService from '../services/emailService.js';
import { resetRegistrationRateLimit } from '../controllers/registrationController.js';
import { czechIban, czechLocal, epcString, normaliseBic, normaliseIban, spdString, suggestedMethod, transferMessage, type PaymentAccount } from '../services/payments/account.js';
import { TEST_ACCOUNTS, useTestBankAccounts } from './helpers/bankAccounts.js';

// Confirming a payment renders its tax document; keep those out of the project's uploads.
process.env.STORAGE_LOCAL_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-pay-'));

const stamp = Date.now();
const auth = (value: string) => ({ Authorization: `Bearer ${value}` });
let token = 0;

async function account(label: string, role: 'ADMIN' | 'USER' = 'USER') {
  const email = `${label}-pay-${stamp}@test.com`;
  const user = await prisma.user.create({
    data: { email, password: await bcrypt.hash('password123', 10), name: label, role, active: true, emailVerified: true },
  });
  const res = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
  return { id: user.id, email, token: res.body.token as string };
}

let admin: Awaited<ReturnType<typeof account>>;
let organiser: Awaited<ReturnType<typeof account>>;
let stranger: Awaited<ReturnType<typeof account>>;

beforeAll(async () => {
  await useTestBankAccounts();
  admin = await account('admin', 'ADMIN');
  organiser = await account('organiser');
  stranger = await account('stranger');
});

beforeEach(() => resetRegistrationRateLimit());

const notices = jest.spyOn(emailService, 'sendPaymentNoticeEmail').mockResolvedValue(true);
const instructions = jest.spyOn(emailService, 'sendPaymentInstructionsEmail').mockResolvedValue(true);
jest.spyOn(emailService, 'sendRegistrationDecisionEmail').mockResolvedValue(true);
jest.spyOn(emailService, 'sendRegistrationReceivedEmail').mockResolvedValue(true);
jest.spyOn(emailService, 'sendRegistrationNoticeEmail').mockResolvedValue(true);

afterAll(async () => {
  await prisma.$disconnect();
});

async function tournament(label: string, teams = 0, owner = organiser.token) {
  const series = await request(app).post('/api/tournaments/series').set(auth(owner))
    .send({ name: `Pay Series ${label} ${stamp}`, sportType: 'FLOORBALL' });
  const created = await request(app).post(`/api/tournaments/series/${series.body.id}/tournaments`).set(auth(owner))
    .send({ name: `Pay Cup ${label} ${stamp}` });
  const id = created.body.id as string;
  if (teams > 0) {
    await prisma.tournamentTeam.createMany({
      data: Array.from({ length: teams }, (_, i) => ({ tournamentId: id, name: `Team ${i + 1}` })),
    });
  }
  return id;
}

const offers = (id: string, as = organiser.token) => request(app).get(`/api/tournaments/${id}/plan/offers`).set(auth(as));
const statusAs = (id: string, as: string) => request(app).get(`/api/tournaments/${id}/plan`).set(auth(as));
const buy = (id: string, plan: string, currency = 'CZK', as = organiser.token) =>
  request(app).post(`/api/tournaments/${id}/payments`).set(auth(as)).send({ plan, currency, immediateStart: true });
const status = (id: string) => request(app).get(`/api/tournaments/${id}/plan`).set(auth(organiser.token));
const confirm = (ids: string[], as = admin.token) =>
  request(app).post('/api/admin/payments/confirm').set(auth(as)).send({ ids, reason: 'On the statement' });

async function pendingApplication(id: string) {
  const window = await prisma.registrationWindow.upsert({
    where: { tournamentId: id }, create: { tournamentId: id, open: true }, update: {},
  });
  return prisma.registration.create({
    data: {
      windowId: window.id, contactName: 'Coach', email: `coach-${token}-${stamp}@test.com`,
      teamName: `Applicant ${token}`, clientToken: `pay-${stamp}-${token++}`,
    },
  });
}

// Made-up accounts; the Czech one is the example from the Czech banks' IBAN standard.
const czk: PaymentAccount = { currency: 'CZK', local: '19-2000145399/0800', iban: 'CZ6508000000192000145399', bic: 'TESTCZPP', recipient: 'Test s.r.o.' };
const eur: PaymentAccount = { ...czk, currency: 'EUR' };

describe('the account and the QR code', () => {
  it('turns Czech account numbers into IBANs and back', () => {
    expect(czechIban('19-2000145399/0800')).toBe('CZ6508000000192000145399');
    expect(czechLocal('CZ6508000000192000145399')).toBe('19-2000145399/0800');
    expect(czechLocal(czechIban('123456/0800')!)).toBe('123456/0800');
    expect(czechLocal('SK3112000000198742637541')).toBeNull();
    expect(czechIban('not an account')).toBeNull();
  });

  it('checks an IBAN and a BIC typed in the administration', () => {
    expect(normaliseIban('cz65 0800 0000 1920 0014 5399')).toBe('CZ6508000000192000145399');
    expect(normaliseIban('CZ6608000000192000145399')).toBeNull();
    expect(normaliseIban('DE89370400440532013000')).toBe('DE89370400440532013000');
    expect(normaliseBic('testczpp')).toBe('TESTCZPP');
    expect(normaliseBic('TEST CZ')).toBeNull();
  });

  it('writes the Short Payment Descriptor', () => {
    expect(spdString(czk, 69000, 2026000001, 'ATM TOURNAMENT 2026000001')).toBe(
      'SPD*1.0*ACC:CZ6508000000192000145399+TESTCZPP*AM:690.00*CC:CZK*X-VS:2026000001*RN:Test s.r.o.*MSG:ATM TOURNAMENT 2026000001'
    );
  });

  it('writes the EPC QR code with the variable symbol in the message', () => {
    expect(epcString(eur, 5900, transferMessage(2026000042, 'TOURNAMENT_PLUS'))).toBe([
      'BCD', '002', '1', 'SCT', 'TESTCZPP', 'Test s.r.o.', 'CZ6508000000192000145399', 'EUR59.00', '', '',
      '/VS/2026000042/ ATM TOURNAMENT_PLUS',
    ].join('\n'));
    expect(() => epcString(czk, 5900, 'x')).toThrow();
  });

  it('suggests the QR format by the payer\'s language', () => {
    expect(suggestedMethod('sk', ['CZK', 'EUR'])).toBe('BYSQUARE');
    expect(suggestedMethod('de', ['CZK', 'EUR'])).toBe('EPC');
    expect(suggestedMethod('pl', ['CZK', 'EUR'])).toBe('EPC');
    expect(suggestedMethod('cs', ['CZK', 'EUR'])).toBe('SPD');
    expect(suggestedMethod('en', ['CZK', 'EUR'])).toBe('SPD');
    // Without a euro account a Slovak payer is offered the Czech code, and nothing without any account.
    expect(suggestedMethod('sk', ['CZK'])).toBe('SPD');
    expect(suggestedMethod('cs', [])).toBeNull();
  });
});

describe('offers', () => {
  it('lists the paid plans with prices, the yearly plan only for the series manager', async () => {
    const id = await tournament('offers');
    const mine = await offers(id);
    expect(mine.body.currencies).toEqual(['CZK', 'EUR']);
    expect(mine.body.offers).toEqual([
      expect.objectContaining({ plan: 'TOURNAMENT', limit: 32, prices: { CZK: 69000, EUR: 2900 }, upgradeFrom: null }),
      expect.objectContaining({ plan: 'TOURNAMENT_PLUS', limit: null, prices: { CZK: 149000, EUR: 5900 } }),
      expect.objectContaining({ plan: 'ORGANIZER', prices: { CZK: 499000, EUR: 19900 } }),
    ]);
    const asAdmin = await offers(id, admin.token);
    expect(asAdmin.body.offers.map((offer: { plan: string }) => offer.plan)).toEqual(['TOURNAMENT', 'TOURNAMENT_PLUS']);
    expect((await offers(id, stranger.token)).status).toBe(403);
  });

  it('charges the difference to upgrade from Tournament to Tournament Plus', async () => {
    const id = await tournament('upgrade');
    await prisma.tournament.update({ where: { id }, data: { plan: 'TOURNAMENT' } });
    const listed = await offers(id);
    expect(listed.body.offers.map((offer: { plan: string }) => offer.plan)).toEqual(['TOURNAMENT_PLUS', 'ORGANIZER']);
    expect(listed.body.offers[0]).toMatchObject({ prices: { CZK: 80000, EUR: 3000 }, upgradeFrom: 'TOURNAMENT' });

    const paid = await buy(id, 'TOURNAMENT_PLUS');
    expect(paid.status).toBe(201);
    // 800 Kč with 21 % VAT inside: 138.84 VAT, 661.16 base.
    expect(paid.body).toMatchObject({ amount: 80000, vat: 13884, base: 66116, upgradeFrom: 'TOURNAMENT' });
  });
});

describe('paying in euros', () => {
  it('gives a PAY by square and an EPC code to the euro account, with the variable symbol', async () => {
    const id = await tournament('euro', 7);
    const paid = await buy(id, 'TOURNAMENT', 'EUR');
    expect(paid.status).toBe(201);
    const vs = paid.body.variableSymbol;
    expect(paid.body.methods).toEqual(['BYSQUARE', 'EPC']);
    expect(paid.body.transfer).toEqual({
      iban: TEST_ACCOUNTS.EUR.iban, bic: 'TESTCZPP', recipient: TEST_ACCOUNTS.EUR.recipient,
      amount: '29.00', currency: 'EUR', variableSymbol: vs, message: `/VS/${vs}/ ATM TOURNAMENT`,
    });
    expect(paid.body.qr.EPC.split('\n')).toEqual([
      'BCD', '002', '1', 'SCT', 'TESTCZPP', TEST_ACCOUNTS.EUR.recipient, TEST_ACCOUNTS.EUR.iban, 'EUR29.00', '', '', `/VS/${vs}/ ATM TOURNAMENT`,
    ]);
    const { decode } = await import('bysquare/pay');
    const decoded = decode(paid.body.qr.BYSQUARE);
    expect(decoded.payments[0]).toMatchObject({
      amount: 29, currencyCode: 'EUR', variableSymbol: String(vs),
      bankAccounts: [expect.objectContaining({ iban: TEST_ACCOUNTS.EUR.iban })],
    });
    expect(paid.body.qr.SPD).toBeUndefined();
  });

  it('keeps the account a payment was given when the administration changes it', async () => {
    const id = await tournament('kept');
    const paid = await buy(id, 'TOURNAMENT');
    await prisma.payment.update({
      where: { id: paid.body.id },
      data: { snapshot: { ...(await prisma.payment.findUniqueOrThrow({ where: { id: paid.body.id } })).snapshot as object, account: { iban: 'CZ6508000000192000145399', bic: 'OLDBCZPP', recipient: 'Old s.r.o.' } } },
    });
    const view = await statusAs(id, organiser.token);
    expect(view.body.payment.transfer).toMatchObject({ iban: 'CZ6508000000192000145399', bic: 'OLDBCZPP', recipient: 'Old s.r.o.' });
  });

  it('lets only the pricing manager change the accounts, with a reason', async () => {
    const plain = await request(app).put('/api/admin/pricing/bank-accounts/EUR').set(auth(admin.token))
      .send({ ...TEST_ACCOUNTS.EUR, reason: 'x' });
    expect(plain.status).toBe(403);
    await prisma.user.update({ where: { id: admin.id }, data: { canManagePricing: true } });
    try {
      const put = (body: object) => request(app).put('/api/admin/pricing/bank-accounts/EUR').set(auth(admin.token)).send(body);
      expect((await put({ ...TEST_ACCOUNTS.EUR, iban: 'CZ00 1234', reason: 'x' })).body.code).toBe('IBAN_FORMAT');
      expect((await put({ ...TEST_ACCOUNTS.EUR, bic: '12', reason: 'x' })).body.code).toBe('BIC_FORMAT');
      expect((await put({ ...TEST_ACCOUNTS.EUR })).body.code).toBe('REASON_REQUIRED');
      const saved = await put({ ...TEST_ACCOUNTS.EUR, reason: `New euro account ${stamp}` });
      expect(saved.status).toBe(200);
      expect(saved.body).toMatchObject({ currency: 'EUR', iban: TEST_ACCOUNTS.EUR.iban });
      expect(await prisma.auditLog.count({ where: { entityId: 'bank_account_EUR', reason: `New euro account ${stamp}` } })).toBe(1);
    } finally {
      await prisma.user.update({ where: { id: admin.id }, data: { canManagePricing: false } });
    }
  });
});

describe('paying for a plan', () => {
  it('needs the payer to ask for an immediate start, and remembers when they did', async () => {
    const id = await tournament('consent');
    const refused = await request(app).post(`/api/tournaments/${id}/payments`).set(auth(organiser.token))
      .send({ plan: 'TOURNAMENT', currency: 'CZK' });
    expect(refused.status).toBe(400);
    expect(refused.body.code).toBe('IMMEDIATE_START_REQUIRED');

    const paid = await buy(id, 'TOURNAMENT');
    expect(paid.status).toBe(201);
    const stored = await prisma.payment.findUnique({ where: { id: paid.body.id } });
    expect(stored?.immediateStartConsentAt).toBeInstanceOf(Date);
  });

  it('shows the amount, the account and a QR code, tells the admins, and allows one at a time', async () => {
    const id = await tournament('pay', 6);
    notices.mockClear();
    const paid = await buy(id, 'TOURNAMENT');
    expect(paid.status).toBe(201);
    expect(paid.body).toMatchObject({
      status: 'PENDING', plan: 'TOURNAMENT', currency: 'CZK', amount: 69000, vat: 11975,
      account: { local: '123456/0800', iban: TEST_ACCOUNTS.CZK.iban, recipient: TEST_ACCOUNTS.CZK.recipient },
      methods: ['SPD'],
    });
    expect(paid.body.variableSymbol).toBeGreaterThanOrEqual(2026000001);
    expect(paid.body.qr.SPD).toContain(`X-VS:${paid.body.variableSymbol}`);
    expect(paid.body.transfer).toMatchObject({ amount: '690.00', currency: 'CZK', iban: TEST_ACCOUNTS.CZK.iban, variableSymbol: paid.body.variableSymbol });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(notices).toHaveBeenCalledWith(expect.objectContaining({ to: admin.email, variableSymbol: paid.body.variableSymbol }));
    expect(instructions).toHaveBeenCalledWith(expect.objectContaining({
      to: organiser.email, method: 'SPD', currency: 'CZK', amount: '690.00', variableSymbol: paid.body.variableSymbol,
      path: `/tournament-management/tournament/${id}`,
    }));

    const again = await buy(id, 'TOURNAMENT_PLUS');
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('PAYMENT_PENDING');

    expect((await status(id)).body).toMatchObject({
      plan: 'FREE', limit: 6, pending: { plan: 'TOURNAMENT', limit: 32 }, payment: { id: paid.body.id },
    });
  });

  it('lets applications fill the new places while waiting, and approvals past the limit wait for the money', async () => {
    const id = await tournament('waiting', 6);
    const paid = await buy(id, 'TOURNAMENT');
    expect(paid.status).toBe(201);

    const settings = await request(app).put(`/api/registrations/tournament/${id}/settings`).set(auth(organiser.token))
      .send({ open: true, maxTeams: 12 });
    expect(settings.status).toBe(200);

    const applied = await request(app).post(`/api/registrations/tournament/${id}`)
      .send({ clientToken: `pay-${stamp}-${token++}`, contactName: 'Coach', email: `wait-${stamp}@test.com`, teamName: 'Seventh' });
    expect(applied.body.status).toBe('PENDING');

    const early = await request(app).post(`/api/registrations/${applied.body.id}/approve`).set(auth(organiser.token));
    expect(early.status).toBe(409);
    expect(early.body).toMatchObject({ code: 'PLAN_LIMIT', limit: 6, pending: { plan: 'TOURNAMENT' } });

    expect((await confirm([paid.body.id])).body).toEqual({ done: [paid.body.id], skipped: [] });
    expect((await prisma.tournament.findUniqueOrThrow({ where: { id } })).plan).toBe('TOURNAMENT');
    const approved = await request(app).post(`/api/registrations/${applied.body.id}/approve`).set(auth(organiser.token));
    expect(approved.status).toBe(200);

    // Confirmed once only, and in the audit log with the reason.
    expect((await confirm([paid.body.id])).body.skipped).toEqual([{ id: paid.body.id, code: 'NOT_PENDING' }]);
    const trail = await prisma.auditLog.findFirst({ where: { entityType: 'Payment', entityId: paid.body.id, action: 'CONFIRM' } });
    expect(trail).toMatchObject({ actorId: admin.id, reason: 'On the statement' });
  });

  it('can be cancelled by the organiser, not by a stranger, and then another plan chosen', async () => {
    const id = await tournament('cancel');
    const paid = await buy(id, 'TOURNAMENT');
    expect(paid.status).toBe(201);
    expect((await request(app).post(`/api/billing/payments/${paid.body.id}/cancel`).set(auth(stranger.token))).status).toBe(404);
    const cancelled = await request(app).post(`/api/billing/payments/${paid.body.id}/cancel`).set(auth(organiser.token));
    expect(cancelled.body.status).toBe('CANCELLED');
    expect((await buy(id, 'TOURNAMENT_PLUS', 'EUR')).body).toMatchObject({ amount: 5900, currency: 'EUR' });
    expect((await confirm([paid.body.id])).body.skipped[0].code).toBe('NOT_PENDING');
  });
});

describe('the Organizer year', () => {
  it('runs a year from confirmation and lifts the limit of every tournament of the payer', async () => {
    // Its own account: the year would lift every other test's tournaments too.
    const holder = await account('holder');
    const id = await tournament('organizer', 6, holder.token);
    const paid = await buy(id, 'ORGANIZER', 'CZK', holder.token);
    expect(paid.status).toBe(201);
    const before = Date.now();
    await confirm([paid.body.id]);

    const year = await prisma.organizerPlan.findFirstOrThrow({ where: { paymentId: paid.body.id } });
    expect(year.userId).toBe(holder.id);
    expect(year.validFrom.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(year.validUntil.getUTCFullYear() - year.validFrom.getUTCFullYear()).toBe(1);

    expect((await statusAs(id, holder.token)).body).toMatchObject({ plan: 'ORGANIZER', limit: null });
    const other = await tournament('organizer-other', 6, holder.token);
    expect((await statusAs(other, holder.token)).body).toMatchObject({ plan: 'ORGANIZER' });
    expect((await offers(id, holder.token)).body.offers).toEqual([]);
  });
});

describe('renewing the Organizer year', () => {
  it('is offered only in the last 30 days, and the new year follows on from the old one', async () => {
    const holder = await account('renewer');
    const id = await tournament('renewal', 0, holder.token);
    const day = 24 * 60 * 60 * 1000;
    const running = await prisma.organizerPlan.create({
      data: { userId: holder.id, validFrom: new Date(Date.now() - 300 * day), validUntil: new Date(Date.now() + 60 * day) },
    });
    expect((await offers(id, holder.token)).body.offers).toEqual([]);

    const ends = new Date(Date.now() + 10 * day);
    await prisma.organizerPlan.update({ where: { id: running.id }, data: { validUntil: ends } });
    const listed = await offers(id, holder.token);
    expect(listed.body.offers.map((offer: { plan: string }) => offer.plan)).toEqual(['ORGANIZER']);
    expect(new Date(listed.body.offers[0].startsAt).getTime()).toBe(ends.getTime());

    const paid = await buy(id, 'ORGANIZER', 'CZK', holder.token);
    expect(paid.status).toBe(201);
    await confirm([paid.body.id]);
    const next = await prisma.organizerPlan.findFirstOrThrow({ where: { paymentId: paid.body.id } });
    expect(next.validFrom.getTime()).toBe(ends.getTime());
    expect(new Date((await statusAs(id, holder.token)).body.organizerUntil).getTime()).toBe(next.validUntil.getTime());
  });
});

describe('the public price list', () => {
  it('shows every tournament plan with its price and limits, without an account', async () => {
    const res = await request(app).get('/api/billing/prices');
    expect(res.status).toBe(200);
    expect(res.body.plans).toEqual([
      { plan: 'FREE', prices: { CZK: 0, EUR: 0 }, limits: { teams: 6, sponsorLogos: 0, documents: 0 } },
      { plan: 'TOURNAMENT', prices: { CZK: 69000, EUR: 2900 }, limits: { teams: 32, sponsorLogos: 0, documents: 0 } },
      { plan: 'TOURNAMENT_PLUS', prices: { CZK: 149000, EUR: 5900 }, limits: { teams: null, sponsorLogos: 10, documents: 5 } },
      { plan: 'ORGANIZER', prices: { CZK: 499000, EUR: 19900 }, limits: { teams: null, sponsorLogos: 10, documents: 5 } },
    ]);
  });
});

describe('the admin list', () => {
  it('filters waiting payments and finds one by its variable symbol; only admins confirm', async () => {
    const id = await tournament('list');
    const paid = await buy(id, 'TOURNAMENT');
    expect(paid.status).toBe(201);
    const found = await request(app).get('/api/admin/payments')
      .query({ status: 'PENDING', q: String(paid.body.variableSymbol) }).set(auth(admin.token));
    expect(found.body.rows.map((row: { id: string }) => row.id)).toStrictEqual([paid.body.id]);
    expect((await confirm([paid.body.id], organiser.token)).status).toBe(403);

    const overview = await request(app).get('/api/admin/overview').set(auth(admin.token));
    expect(overview.body.queues.payments).toBeGreaterThanOrEqual(1);
  });
});
