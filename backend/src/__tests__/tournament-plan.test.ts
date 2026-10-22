import { jest } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import prisma from '../config/database.js';
import emailService from '../services/emailService.js';
import { resetRegistrationRateLimit } from '../controllers/registrationController.js';

const stamp = Date.now();
const auth = (value: string) => ({ Authorization: `Bearer ${value}` });
let token = 0;

async function account(label: string, role: 'ADMIN' | 'USER' = 'USER') {
  const email = `${label}-plan-${stamp}@test.com`;
  const user = await prisma.user.create({
    data: { email, password: await bcrypt.hash('password123', 10), name: label, role, active: true, emailVerified: true },
  });
  const res = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
  return { id: user.id, token: res.body.token as string };
}

let admin: Awaited<ReturnType<typeof account>>;
let organiser: Awaited<ReturnType<typeof account>>;
let stranger: Awaited<ReturnType<typeof account>>;

beforeAll(async () => {
  admin = await account('admin', 'ADMIN');
  organiser = await account('organiser');
  stranger = await account('stranger');
});

beforeEach(() => resetRegistrationRateLimit());

jest.spyOn(emailService, 'sendRegistrationDecisionEmail').mockResolvedValue(true);
jest.spyOn(emailService, 'sendRegistrationReceivedEmail').mockResolvedValue(true);
jest.spyOn(emailService, 'sendRegistrationNoticeEmail').mockResolvedValue(true);

afterAll(async () => {
  await prisma.$disconnect();
});

/** A tournament in a series the organiser created, so it is theirs. */
async function tournament(label: string, teams = 0) {
  const series = await request(app).post('/api/tournaments/series').set(auth(organiser.token))
    .send({ name: `Plan Series ${label} ${stamp}`, sportType: 'FLOORBALL' });
  const created = await request(app).post(`/api/tournaments/series/${series.body.id}/tournaments`).set(auth(organiser.token))
    .send({ name: `Plan Cup ${label} ${stamp}` });
  const id = created.body.id as string;
  if (teams > 0) {
    await prisma.tournamentTeam.createMany({
      data: Array.from({ length: teams }, (_, i) => ({ tournamentId: id, name: `Team ${i + 1}` })),
    });
  }
  return id;
}

const addTeam = (id: string, name: string, as = organiser.token) =>
  request(app).post(`/api/tournaments/${id}/teams`).set(auth(as)).send({ name });

const plan = (id: string, as = organiser.token) => request(app).get(`/api/tournaments/${id}/plan`).set(auth(as));

/** Pending applications put straight into the inbox, as if submitted. */
async function pendingApplications(id: string, count: number) {
  await request(app).put(`/api/registrations/tournament/${id}/settings`).set(auth(organiser.token)).send({ open: true });
  const window = await prisma.registrationWindow.findUniqueOrThrow({ where: { tournamentId: id } });
  return Promise.all(Array.from({ length: count }, () => prisma.registration.create({
    data: {
      windowId: window.id,
      contactName: 'Coach',
      email: `coach-${token}-${stamp}@test.com`,
      teamName: `Applicant ${token}`,
      clientToken: `plan-${stamp}-${token++}`,
    },
  })));
}

const approve = (registrationId: string) =>
  request(app).post(`/api/registrations/${registrationId}/approve`).set(auth(organiser.token));

describe('team limits', () => {
  it('lets a free tournament take six teams and refuses the seventh', async () => {
    const id = await tournament('free', 5);
    expect((await addTeam(id, 'Sixth')).status).toBe(201);

    const seventh = await addTeam(id, 'Seventh');
    expect(seventh.status).toBe(409);
    expect(seventh.body).toMatchObject({ code: 'PLAN_LIMIT', plan: 'FREE', limit: 6, teams: 6 });
    expect(await prisma.tournamentTeam.count({ where: { tournamentId: id } })).toBe(6);
  });

  it('refuses the 33rd team on the Tournament plan', async () => {
    const id = await tournament('paid', 32);
    await prisma.tournament.update({ where: { id }, data: { plan: 'TOURNAMENT' } });
    const res = await addTeam(id, 'Thirty-third');
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ plan: 'TOURNAMENT', limit: 32 });
  });

  it('has no limit on Tournament Plus', async () => {
    const id = await tournament('plus', 40);
    await prisma.tournament.update({ where: { id }, data: { plan: 'TOURNAMENT_PLUS' } });
    expect((await addTeam(id, 'Forty-first')).status).toBe(201);
    expect((await plan(id)).body).toMatchObject({ plan: 'TOURNAMENT_PLUS', limit: null, teams: 41 });
  });

  it('keeps the teams of a tournament already over the limit, and only stops new ones', async () => {
    const id = await tournament('grandfathered', 8);
    expect((await plan(id)).body).toMatchObject({ plan: 'FREE', ownPlan: 'FREE', limit: 6, teams: 8 });
    expect((await addTeam(id, 'Ninth')).status).toBe(409);
    expect(await prisma.tournamentTeam.count({ where: { tournamentId: id } })).toBe(8);
  });

  it('lets only one of two simultaneous additions take the last place', async () => {
    const id = await tournament('race-add', 5);
    const results = await Promise.all([addTeam(id, 'Left'), addTeam(id, 'Right')]);
    expect(results.map((res) => res.status).sort()).toEqual([201, 409]);
    expect(await prisma.tournamentTeam.count({ where: { tournamentId: id } })).toBe(6);
  });
});

describe('approving applications', () => {
  it('lets only one of two simultaneous approvals take the last place', async () => {
    const id = await tournament('race-approve', 5);
    const [first, second] = await pendingApplications(id, 2);
    const results = await Promise.all([approve(first.id), approve(second.id)]);
    expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
    expect(results.find((res) => res.status === 409)!.body.code).toBe('PLAN_LIMIT');
    expect(await prisma.tournamentTeam.count({ where: { tournamentId: id } })).toBe(6);
  });

  it('waitlists applications once the plan is full, without a maximum set', async () => {
    const id = await tournament('form', 6);
    await request(app).put(`/api/registrations/tournament/${id}/settings`).set(auth(organiser.token)).send({ open: true });
    const form = await request(app).get(`/api/registrations/tournament/${id}`);
    expect(form.body.capacity).toMatchObject({ max: 6, free: 0 });

    const applied = await request(app).post(`/api/registrations/tournament/${id}`)
      .send({ clientToken: `plan-${stamp}-${token++}`, contactName: 'Coach', email: `late-${stamp}@test.com`, teamName: 'Late' });
    expect(applied.status).toBe(201);
    expect(applied.body.status).toBe('WAITLISTED');
  });

  it('refuses a maximum above the plan, and takes one within it', async () => {
    const id = await tournament('settings');
    const settings = (body: object) =>
      request(app).put(`/api/registrations/tournament/${id}/settings`).set(auth(organiser.token)).send(body);

    const over = await settings({ maxTeams: 10 });
    expect(over.status).toBe(409);
    expect(over.body).toMatchObject({ code: 'PLAN_LIMIT', plan: 'FREE', limit: 6 });

    const within = await settings({ maxTeams: 6 });
    expect(within.status).toBe(200);
    expect(within.body.plan).toMatchObject({ plan: 'FREE', limit: 6 });
  });
});

describe('the Organizer plan', () => {
  it('lifts the limit of every tournament in the holder’s series while it runs', async () => {
    const id = await tournament('organizer', 6);
    const day = 24 * 60 * 60 * 1000;
    const running = await prisma.organizerPlan.create({
      data: { userId: organiser.id, validFrom: new Date(Date.now() - day), validUntil: new Date(Date.now() + 365 * day) },
    });

    expect((await plan(id)).body).toMatchObject({ plan: 'ORGANIZER', ownPlan: 'FREE', limit: null });
    expect((await addTeam(id, 'Seventh')).status).toBe(201);

    // Expired (B5): nothing is removed and the tournament still opens, but an
    // eighth team and a maximum over the free limit are refused.
    await prisma.organizerPlan.update({ where: { id: running.id }, data: { validUntil: new Date(Date.now() - 1000) } });
    expect((await plan(id)).body).toMatchObject({ plan: 'FREE', limit: 6, teams: 7, organizerUntil: null });
    const publicView = await request(app).get(`/api/tournaments/${id}`);
    expect(publicView.status).toBe(200);
    expect(publicView.body.teams).toHaveLength(7);
    expect((await addTeam(id, 'Eighth')).status).toBe(409);
    const settings = await request(app).put(`/api/registrations/tournament/${id}/settings`).set(auth(organiser.token)).send({ maxTeams: 10 });
    expect(settings.body).toMatchObject({ code: 'PLAN_LIMIT', plan: 'FREE' });
  });
});

describe('setting a plan by hand', () => {
  it('is for admins only, records why, and lifts the limit', async () => {
    const id = await tournament('manual', 6);
    const set = (body: object, as = admin.token) =>
      request(app).put(`/api/admin/tournaments/${id}/plan`).set(auth(as)).send(body);

    expect((await set({ plan: 'TOURNAMENT' }, organiser.token)).status).toBe(403);
    expect((await set({ plan: 'GOLD' })).status).toBe(400);

    const changed = await set({ plan: 'TOURNAMENT', reason: 'Paid by bank transfer before B3' });
    expect(changed.status).toBe(200);
    expect(changed.body).toMatchObject({ plan: 'TOURNAMENT', limit: 32, teams: 6 });
    expect((await addTeam(id, 'Seventh')).status).toBe(201);

    const trail = await prisma.auditLog.findFirst({ where: { entityType: 'Tournament', entityId: id } });
    expect(trail).toMatchObject({
      action: 'UPDATE',
      actorId: admin.id,
      reason: 'Paid by bank transfer before B3',
      before: expect.objectContaining({ plan: 'FREE' }),
      after: expect.objectContaining({ plan: 'TOURNAMENT' }),
    });
  });

  it('shows the plan only to whoever manages the tournament', async () => {
    const id = await tournament('privacy');
    expect((await plan(id, stranger.token)).status).toBe(403);
    expect((await plan(id, admin.token)).status).toBe(200);
  });
});
