import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import prisma from '../config/database.js';
import { csvCell } from '../services/admin/list.js';

const stamp = Date.now();
const tag = `adm${stamp}`;

async function account(label: string, role: 'ADMIN' | 'USER' = 'USER', extra: { createdAt?: Date } = {}) {
  const email = `${label}-${tag}@test.com`;
  const user = await prisma.user.create({
    data: {
      email,
      password: await bcrypt.hash('password123', 10),
      name: `${label} ${tag}`,
      role,
      active: true,
      emailVerified: true,
      ...extra,
    },
  });
  const login = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
  return { id: user.id, email, token: login.body.token as string };
}

const auth = (value: string) => ({ Authorization: `Bearer ${value}` });

let admin: Awaited<ReturnType<typeof account>>;
let member: Awaited<ReturnType<typeof account>>;
let manager: Awaited<ReturnType<typeof account>>;
let leagueId: string;

beforeAll(async () => {
  admin = await account('admin', 'ADMIN');
  member = await account('member');
  manager = await account('manager', 'USER', { createdAt: new Date('2020-03-15T10:00:00Z') });
  const league = await prisma.league.create({
    data: { name: `League ${tag}`, sportType: 'FOOTBALL', managerId: manager.id },
  });
  leagueId = league.id;
});

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { email: { endsWith: `-${tag}@test.com` } }, select: { id: true } });
  const ids = users.map((user) => user.id);
  await prisma.auditLog.deleteMany({ where: { OR: [{ entityId: { in: ids } }, { actorId: { in: ids } }] } });
  await prisma.league.deleteMany({ where: { id: leagueId } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

describe('admin access', () => {
  it.each(['/api/admin/overview', '/api/admin/users', '/api/admin/audit'])('%s needs a sign-in', async (path) => {
    expect((await request(app).get(path)).status).toBe(401);
  });

  it.each(['/api/admin/overview', '/api/admin/users', '/api/admin/audit'])('%s refuses a season manager', async (path) => {
    expect((await request(app).get(path).set(auth(manager.token))).status).toBe(403);
  });

  it('refuses bulk changes from a non-admin', async () => {
    const res = await request(app).post('/api/admin/users/active').set(auth(member.token))
      .send({ ids: [manager.id], active: false, reason: 'x' });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/admin/users', () => {
  it('pages on the server', async () => {
    const first = await request(app).get('/api/admin/users').set(auth(admin.token))
      .query({ q: tag, sort: 'name', dir: 'asc', pageSize: 2 });
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ total: 3, estimated: false, page: 1, pageSize: 2 });
    expect(first.body.rows.map((row: { name: string }) => row.name)).toEqual([`admin ${tag}`, `manager ${tag}`]);
    expect(first.body.rows[0]).not.toHaveProperty('password');

    const second = await request(app).get('/api/admin/users').set(auth(admin.token))
      .query({ q: tag, sort: 'name', dir: 'asc', pageSize: 2, page: 2 });
    expect(second.body.rows.map((row: { name: string }) => row.name)).toEqual([`member ${tag}`]);
  });

  it('caps the page size and ignores an unknown sort', async () => {
    const res = await request(app).get('/api/admin/users').set(auth(admin.token))
      .query({ q: tag, pageSize: 10_000, sort: 'password' });
    expect(res.status).toBe(200);
    expect(res.body.pageSize).toBe(100);
  });

  it('filters by what a user runs and by registration date', async () => {
    const leagues = await request(app).get('/api/admin/users').set(auth(admin.token)).query({ q: tag, manages: 'league' });
    expect(leagues.body.rows.map((row: { id: string }) => row.id)).toEqual([manager.id]);
    expect(leagues.body.rows[0]._count.managedLeagues).toBe(1);

    const none = await request(app).get('/api/admin/users').set(auth(admin.token)).query({ q: tag, manages: 'none' });
    expect(none.body.total).toBe(2);

    const registered = await request(app).get('/api/admin/users').set(auth(admin.token))
      .query({ q: tag, registeredFrom: '2020-03-15', registeredTo: '2020-03-15' });
    expect(registered.body.rows.map((row: { id: string }) => row.id)).toEqual([manager.id]);

    const admins = await request(app).get('/api/admin/users').set(auth(admin.token)).query({ q: tag, role: 'ADMIN' });
    expect(admins.body.total).toBe(1);
  });

  it('exports the filtered result as CSV', async () => {
    const res = await request(app).get('/api/admin/users').set(auth(admin.token))
      .query({ q: tag, sort: 'name', dir: 'asc', format: 'csv' });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="atm-users-\d{4}-\d{2}-\d{2}\.csv"/);
    const lines = res.text.replace(/^﻿/, '').trim().split('\r\n');
    expect(lines[0].split(';').slice(0, 3)).toEqual(['id', 'name', 'email']);
    expect(lines).toHaveLength(4);
    expect(lines[2]).toContain(manager.email);
  });

  it('returns the detail with what the user runs', async () => {
    const res = await request(app).get(`/api/admin/users/${manager.id}`).set(auth(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.managedLeagues).toEqual([expect.objectContaining({ id: leagueId, seasons: [] })]);
    expect(res.body).not.toHaveProperty('password');
    expect((await request(app).get('/api/admin/users/00000000-0000-0000-0000-000000000000').set(auth(admin.token))).status).toBe(404);
  });
});

describe('csvCell', () => {
  it('quotes separators and defuses formulas', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('-1')).toBe("'-1");
    expect(csvCell(null)).toBe('');
    expect(csvCell(new Date('2026-10-21T08:00:00Z'))).toBe('2026-10-21T08:00:00.000Z');
  });
});

describe('POST /api/admin/users/active', () => {
  it('needs a reason to deactivate and never locks out the caller', async () => {
    const noReason = await request(app).post('/api/admin/users/active').set(auth(admin.token))
      .send({ ids: [member.id], active: false });
    expect(noReason.status).toBe(400);

    const self = await request(app).post('/api/admin/users/active').set(auth(admin.token))
      .send({ ids: [admin.id], active: false, reason: 'test' });
    expect(self.status).toBe(400);
  });

  it('deactivates, cuts off the session and records the reason', async () => {
    const res = await request(app).post('/api/admin/users/active').set(auth(admin.token))
      .send({ ids: [member.id], active: false, reason: 'Spam account' });
    expect(res.body).toEqual({ updated: 1 });

    // The token the member already holds stops working.
    expect((await request(app).get('/api/auth/me').set(auth(member.token))).status).toBe(401);

    const history = await request(app).get('/api/admin/audit').set(auth(admin.token))
      .query({ entityType: 'User', entityId: member.id });
    expect(history.body.rows).toEqual([
      expect.objectContaining({
        action: 'UPDATE',
        reason: 'Spam account',
        before: expect.objectContaining({ active: true }),
        after: expect.objectContaining({ active: false }),
        actor: expect.objectContaining({ id: admin.id }),
      }),
    ]);

    // Already inactive: nothing to change, nothing logged twice.
    const again = await request(app).post('/api/admin/users/active').set(auth(admin.token))
      .send({ ids: [member.id], active: false, reason: 'Spam account' });
    expect(again.body).toEqual({ updated: 0 });

    const back = await request(app).post('/api/admin/users/active').set(auth(admin.token))
      .send({ ids: [member.id], active: true });
    expect(back.body).toEqual({ updated: 1 });
    expect((await request(app).get('/api/auth/me').set(auth(member.token))).status).toBe(200);
  });
});

describe('audit of account changes', () => {
  it('records an edit without the password hash', async () => {
    const res = await request(app).put(`/api/auth/users/${manager.id}`).set(auth(admin.token))
      .send({ name: `renamed ${tag}`, password: 'another-password' });
    expect(res.status).toBe(200);

    const history = await request(app).get('/api/admin/audit').set(auth(admin.token))
      .query({ entityType: 'User', entityId: manager.id });
    const entry = history.body.rows[0];
    expect(entry.before).toMatchObject({ name: `manager ${tag}` });
    expect(entry.after).toMatchObject({ name: `renamed ${tag}`, passwordChanged: true });
    expect(JSON.stringify(entry)).not.toMatch(/\$2[aby]\$/);
  });

  it('filters by actor and period, and exports', async () => {
    const byActor = await request(app).get('/api/admin/audit').set(auth(admin.token))
      .query({ actor: `admin-${tag}`, createdFrom: '2000-01-01' });
    expect(byActor.body.total).toBeGreaterThanOrEqual(2);
    expect(byActor.body.rows.every((row: { actor: { id: string } }) => row.actor.id === admin.id)).toBe(true);

    const past = await request(app).get('/api/admin/audit').set(auth(admin.token))
      .query({ actor: `admin-${tag}`, createdTo: '2000-01-01' });
    expect(past.body.total).toBe(0);

    const csv = await request(app).get('/api/admin/audit').set(auth(admin.token))
      .query({ actor: `admin-${tag}`, format: 'csv' });
    expect(csv.text).toContain(admin.email);

    const types = await request(app).get('/api/admin/audit/types').set(auth(admin.token));
    expect(types.body).toContain('User');
  });
});

describe('GET /api/admin/overview', () => {
  // Other suites write tickets and users in parallel, so only lower bounds hold.
  it('counts open tickets and new users', async () => {
    const ticket = await prisma.supportTicket.create({
      data: { category: 'QUESTION', subject: 's', message: 'm', clientToken: `${tag}-ticket` },
    });
    const res = await request(app).get('/api/admin/overview').set(auth(admin.token));
    await prisma.supportTicket.delete({ where: { id: ticket.id } });

    expect(res.status).toBe(200);
    expect(res.body.queues.payments).toEqual(expect.any(Number));
    expect(res.body.queues.openTickets).toBeGreaterThanOrEqual(1);
    expect(res.body.queues.staleRegistrations).toEqual(expect.any(Number));
    // admin and member signed up just now; manager's date is in 2020.
    expect(res.body.last30Days.newUsers).toBeGreaterThanOrEqual(2);
    expect(res.body.last30Days).toEqual(expect.objectContaining({
      activeLeagues: expect.any(Number),
      activeTournaments: expect.any(Number),
    }));
  });
});

describe('admin search', () => {
  it('finds accounts for an admin only', async () => {
    const asAdmin = await request(app).get('/api/search').set(auth(admin.token)).query({ q: `manager-${tag}` });
    expect(asAdmin.body.users.map((row: { id: string }) => row.id)).toEqual([manager.id]);

    const asMember = await request(app).get('/api/search').set(auth(manager.token)).query({ q: `manager-${tag}` });
    expect(asMember.body.users).toEqual([]);
    expect(asMember.body.tournaments).toEqual([]);
  });
});
