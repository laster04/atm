import { jest } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import prisma from '../config/database.js';
import emailService from '../services/emailService.js';
import { overrideLeaguePlansForTests } from '../services/pricing/catalog.js';
import { useTestBankAccounts } from './helpers/bankAccounts.js';

// Confirming a payment renders its tax document; keep those out of the project's uploads.
process.env.STORAGE_LOCAL_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-league-plan-'));

const stamp = Date.now();
const auth = (value: string) => ({ Authorization: `Bearer ${value}` });
const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number) => new Date(Date.now() + days * DAY).toISOString();

async function account(label: string, role: 'ADMIN' | 'USER' = 'USER') {
  const email = `${label}-lp-${stamp}@test.com`;
  const user = await prisma.user.create({
    data: { email, password: await bcrypt.hash('password123', 10), name: label, role, active: true, emailVerified: true },
  });
  const res = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
  return { id: user.id, email, token: res.body.token as string };
}

let admin: Awaited<ReturnType<typeof account>>;

jest.spyOn(emailService, 'sendPaymentInstructionsEmail').mockResolvedValue(true);
jest.spyOn(emailService, 'sendPaymentNoticeEmail').mockResolvedValue(true);
jest.spyOn(emailService, 'sendTaxDocumentEmail').mockResolvedValue(true);

beforeAll(async () => {
  await useTestBankAccounts();
  admin = await account('admin', 'ADMIN');
  overrideLeaguePlansForTests(true);
});

afterAll(async () => {
  overrideLeaguePlansForTests(null);
  await prisma.$disconnect();
});

const league = async (token: string, label: string) =>
  (await request(app).post('/api/leagues').set(auth(token)).send({ name: `LP ${label} ${stamp}`, sportType: 'HOCKEY' })).body.id as string;

const season = (token: string, leagueId: string, label: string, endInDays = 200) =>
  request(app).post('/api/seasons').set(auth(token))
    .send({ name: `LP ${label}`, leagueId, startDate: inDays(1), endDate: inDays(endInDays), visibility: 'PUBLIC' });

const addTeams = (seasonId: string, count: number) => prisma.$transaction(async (tx) => {
  for (let i = 0; i < count; i++) {
    const team = await tx.team.create({ data: { name: `LP team ${seasonId.slice(0, 4)} ${i}` } });
    await tx.seasonTeam.create({ data: { seasonId, teamId: team.id } });
  }
});

describe('how a new season is covered', () => {
  it('is free while the switch is off', async () => {
    const owner = await account('off');
    const leagueId = await league(owner.token, 'off');
    overrideLeaguePlansForTests(false);
    try {
      const first = await season(owner.token, leagueId, 'off 1');
      const second = await season(owner.token, leagueId, 'off 2');
      expect([first.body.plan, second.body.plan]).toEqual(['FREE', 'FREE']);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: owner.id } })).leagueTrialUsedAt).toBeNull();
    } finally {
      overrideLeaguePlansForTests(true);
    }
  });

  it('gives an organiser one free season, then asks for the plan', async () => {
    const owner = await account('trial');
    const first = await league(owner.token, 'trial');
    const trial = await season(owner.token, first, 'trial 1');
    expect(trial.status).toBe(201);
    expect(trial.body.plan).toBe('TRIAL');

    const secondSeason = await season(owner.token, first, 'trial 2');
    expect(secondSeason.body.plan).toBe('UNPAID');

    const secondLeague = await league(owner.token, 'trial second');
    expect((await season(owner.token, secondLeague, 'second league')).body.plan).toBe('UNPAID');
  });

  it('keeps the free season to 12 months', async () => {
    const owner = await account('long');
    const leagueId = await league(owner.token, 'long');
    const res = await season(owner.token, leagueId, 'too long', 400);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('TRIAL_TOO_LONG');
    // The refused season did not use the trial up.
    expect((await season(owner.token, leagueId, 'fits')).body.plan).toBe('TRIAL');

    const trial = await prisma.season.findFirstOrThrow({ where: { leagueId, plan: 'TRIAL' } });
    const stretched = await request(app).put(`/api/seasons/${trial.id}`).set(auth(owner.token)).send({ endDate: inDays(500) });
    expect(stretched.status).toBe(400);
    expect(stretched.body.code).toBe('TRIAL_TOO_LONG');
  });

  it('is free in a league that is free until a later date', async () => {
    const owner = await account('legacy');
    const leagueId = await league(owner.token, 'legacy');
    await prisma.user.update({ where: { id: owner.id }, data: { leagueTrialUsedAt: new Date() } });
    await prisma.league.update({ where: { id: leagueId }, data: { freeUntil: new Date(inDays(30)) } });
    expect((await season(owner.token, leagueId, 'legacy')).body.plan).toBe('FREE');

    await prisma.league.update({ where: { id: leagueId }, data: { freeUntil: new Date(inDays(-1)) } });
    expect((await season(owner.token, leagueId, 'legacy after')).body.plan).toBe('UNPAID');
  });
});

describe('a season waiting for its plan', () => {
  let owner: Awaited<ReturnType<typeof account>>;
  let leagueId: string;
  let seasonId: string;
  let gameId: string;

  beforeAll(async () => {
    owner = await account('waiting');
    await prisma.user.update({ where: { id: owner.id }, data: { leagueTrialUsedAt: new Date() } });
    leagueId = await league(owner.token, 'waiting');
    seasonId = (await season(owner.token, leagueId, 'waiting')).body.id;
    await addTeams(seasonId, 2);
    const teams = await prisma.seasonTeam.findMany({ where: { seasonId } });
    const game = await prisma.game.create({
      data: { seasonId, homeTeamId: teams[0].teamId, awayTeamId: teams[1].teamId, status: 'COMPLETED', homeScore: 3, awayScore: 1, round: 1 },
    });
    gameId = game.id;
  });

  it('can be prepared but not seen from outside', async () => {
    expect((await request(app).get(`/api/seasons/${seasonId}`)).status).toBe(404);
    expect((await request(app).get(`/api/seasons/${seasonId}`).set(auth(owner.token))).status).toBe(200);
    const team = await request(app).post(`/api/teams/season/${seasonId}`).set(auth(owner.token)).send({ name: `LP prep ${stamp}` });
    expect(team.status).toBe(201);
  });

  it('confirms no result and sends no results e-mail', async () => {
    const confirm = await request(app).post(`/api/games/${gameId}/confirm`).set(auth(owner.token));
    expect(confirm.status).toBe(409);
    expect(confirm.body.code).toBe('PLAN_REQUIRED');

    const saved = await request(app).put(`/api/games/${gameId}`).set(auth(owner.token)).send({ status: 'COMPLETED', confirm: true });
    expect(saved.body.code).toBe('PLAN_REQUIRED');

    const mail = await request(app).post(`/api/seasons/${seasonId}/results-email`).set(auth(owner.token)).send({ gameIds: [gameId] });
    expect(mail.status).toBe(409);
    expect(mail.body.code).toBe('PLAN_REQUIRED');
  });

  it('offers the plan that fits its teams, to its manager only', async () => {
    const stranger = await account('stranger');
    expect((await request(app).get(`/api/leagues/${leagueId}/plan`).set(auth(stranger.token))).status).toBe(403);

    const res = await request(app).get(`/api/leagues/${leagueId}/plan`).set(auth(owner.token));
    expect(res.status).toBe(200);
    expect(res.body.waitingSeasons.map((s: { id: string }) => s.id)).toEqual([seasonId]);
    expect(res.body.offers.map((o: { band: string; kind: string }) => `${o.band}/${o.kind}`)).toEqual(['SMALL/NEW', 'LARGE/NEW']);
    expect(res.body.offers[0].limit).toBe(12);
  });

  it('is covered once the paid plan is confirmed, with a tax document', async () => {
    const bought = await request(app).post(`/api/leagues/${leagueId}/payments`).set(auth(owner.token))
      .send({ band: 'SMALL', kind: 'NEW', currency: 'CZK', immediateStart: true });
    expect(bought.status).toBe(201);
    expect(bought.body.league.id).toBe(leagueId);
    expect(bought.body.qr.SPD).toContain('SPD*1.0');

    const again = await request(app).post(`/api/leagues/${leagueId}/payments`).set(auth(owner.token))
      .send({ band: 'SMALL', kind: 'NEW', currency: 'CZK', immediateStart: true });
    expect(again.body.code).toBe('PAYMENT_PENDING');

    const confirmed = await request(app).post('/api/admin/payments/confirm').set(auth(admin.token)).send({ ids: [bought.body.id] });
    expect(confirmed.status).toBe(200);

    expect((await prisma.season.findUniqueOrThrow({ where: { id: seasonId } })).plan).toBe('LEAGUE');
    const plan = await prisma.leaguePlan.findFirstOrThrow({ where: { leagueId } });
    expect(plan.band).toBe('SMALL');
    expect(plan.validUntil.getTime() - plan.validFrom.getTime()).toBeGreaterThan(364 * DAY);
    const document = await prisma.taxDocument.findUniqueOrThrow({ where: { paymentId: bought.body.id } });
    expect(JSON.stringify(document.content)).toContain(`LP waiting ${stamp}`);

    expect((await request(app).get(`/api/seasons/${seasonId}`)).status).toBe(200);
    expect((await request(app).post(`/api/games/${gameId}/confirm`).set(auth(owner.token))).status).toBe(200);
  });

  it('covers a new season while the plan runs, and caps a small one at 12 teams', async () => {
    const next = await season(owner.token, leagueId, 'covered');
    expect(next.body.plan).toBe('LEAGUE');
    await addTeams(next.body.id, 12);
    const thirteenth = await request(app).post(`/api/teams/season/${next.body.id}`).set(auth(owner.token)).send({ name: `LP 13 ${stamp}` });
    expect(thirteenth.status).toBe(409);
    expect(thirteenth.body.code).toBe('PLAN_LIMIT');

    const offers = (await request(app).get(`/api/leagues/${leagueId}/plan`).set(auth(owner.token))).body.offers;
    expect(offers.map((o: { band: string; kind: string }) => `${o.band}/${o.kind}`)).toEqual(['LARGE/UPGRADE']);
    expect(offers[0].prices.CZK).toBe(100000);
  });

  it('offers a renewal only in the last 30 days', async () => {
    await prisma.leaguePlan.updateMany({ where: { leagueId }, data: { band: 'LARGE', validUntil: new Date(inDays(20)) } });
    const offers = (await request(app).get(`/api/leagues/${leagueId}/plan`).set(auth(owner.token))).body.offers;
    // 12 teams fit the small band again, so the next year may be either.
    expect(offers.map((o: { band: string; kind: string }) => `${o.band}/${o.kind}`)).toEqual(['SMALL/RENEWAL', 'LARGE/RENEWAL']);
    const running = await prisma.leaguePlan.findFirstOrThrow({ where: { leagueId } });
    expect(new Date(offers[0].startsAt).getTime()).toBe(running.validUntil.getTime());
  });
});

describe('the admin', () => {
  it('grants a plan by hand, covering the waiting seasons', async () => {
    const owner = await account('granted');
    await prisma.user.update({ where: { id: owner.id }, data: { leagueTrialUsedAt: new Date() } });
    const leagueId = await league(owner.token, 'granted');
    const waiting = (await season(owner.token, leagueId, 'granted')).body.id;

    const refused = await request(app).put(`/api/admin/leagues/${leagueId}/plan`).set(auth(owner.token))
      .send({ grant: { band: 'LARGE', until: inDays(365) } });
    expect(refused.status).toBe(403);

    const res = await request(app).put(`/api/admin/leagues/${leagueId}/plan`).set(auth(admin.token))
      .send({ grant: { band: 'LARGE', until: inDays(365) }, reason: 'Founding league' });
    expect(res.status).toBe(200);
    expect(res.body.plan.band).toBe('LARGE');
    expect((await prisma.season.findUniqueOrThrow({ where: { id: waiting } })).plan).toBe('LEAGUE');
    expect(await prisma.auditLog.count({ where: { entityType: 'League', entityId: leagueId, reason: 'Founding league' } })).toBe(1);
  });

  it('leaves the switch to the pricing manager', async () => {
    // Only refused or no-op calls here: the real switch is shared by every test file.
    const plainAdmin = await request(app).put('/api/admin/pricing/league-plans').set(auth(admin.token)).send({ enabled: true });
    expect(plainAdmin.status).toBe(403);
    await prisma.user.update({ where: { id: admin.id }, data: { canManagePricing: true } });
    const same = await request(app).put('/api/admin/pricing/league-plans').set(auth(admin.token)).send({ enabled: false });
    expect(same.status).toBe(200);
    expect(same.body).toEqual({ enabled: false });
    await prisma.user.update({ where: { id: admin.id }, data: { canManagePricing: false } });
  });

  it('sets a free-until date', async () => {
    const owner = await account('waiver');
    const leagueId = await league(owner.token, 'waiver');
    const res = await request(app).put(`/api/admin/leagues/${leagueId}/plan`).set(auth(admin.token))
      .send({ freeUntil: inDays(90), reason: 'Waiver' });
    expect(res.status).toBe(200);
    expect(res.body.freeUntil).toBeTruthy();
  });
});
