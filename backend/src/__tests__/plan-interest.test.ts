import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import prisma from '../config/database.js';
import { resetPlanInterestRateLimit } from '../controllers/planInterestController.js';

const stamp = Date.now();
let counter = 0;
const token = () => `interest-${stamp}-${++counter}`;

async function account(label: string, role: 'ADMIN' | 'USER' = 'USER') {
  const email = `${label}-${stamp}@test.com`;
  await prisma.user.create({
    data: {
      email,
      password: await bcrypt.hash('password123', 10),
      name: label,
      role,
      active: true,
      emailVerified: true,
    },
  });
  const login = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
  return { email, token: login.body.token as string, user: login.body.user as { id: string } };
}

const auth = (value: string) => ({ Authorization: `Bearer ${value}` });

let admin: Awaited<ReturnType<typeof account>>;
let member: Awaited<ReturnType<typeof account>>;
const tokens: string[] = [];
const next = () => {
  const value = token();
  tokens.push(value);
  return value;
};

beforeAll(async () => {
  admin = await account('admin-interest', 'ADMIN');
  member = await account('member-interest');
});

beforeEach(() => resetPlanInterestRateLimit());

afterAll(async () => {
  await prisma.planInterest.deleteMany({ where: { clientToken: { in: tokens } } });
  await prisma.$disconnect();
});

describe('registering interest', () => {
  it('records a bare click without an account', async () => {
    const clientToken = next();
    const res = await request(app).post('/api/billing/interest').send({ plan: 'LEAGUE', clientToken });
    expect(res.status).toBe(201);

    const row = await prisma.planInterest.findUnique({ where: { clientToken } });
    expect(row).toMatchObject({ plan: 'LEAGUE', email: null, leagueName: null, teamCount: null, userId: null });
  });

  it('fills in the click\'s row with the contact form, never adding a second', async () => {
    const clientToken = next();
    await request(app).post('/api/billing/interest').send({ plan: 'LEAGUE', clientToken });
    const res = await request(app).post('/api/billing/interest')
      .send({ plan: 'LEAGUE', clientToken, email: ' Liga@Example.com ', leagueName: 'Hobby liga JH', teamCount: '8' });
    expect(res.status).toBe(200);

    const rows = await prisma.planInterest.findMany({ where: { clientToken } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ email: 'liga@example.com', leagueName: 'Hobby liga JH', teamCount: 8 });
  });

  it('keeps a contact already left when a late click arrives', async () => {
    const clientToken = next();
    await request(app).post('/api/billing/interest').send({ plan: 'LEAGUE', clientToken, email: 'first@example.com' });
    await request(app).post('/api/billing/interest').send({ plan: 'LEAGUE', clientToken });

    const row = await prisma.planInterest.findUnique({ where: { clientToken } });
    expect(row?.email).toBe('first@example.com');
  });

  it('remembers a signed-in sender', async () => {
    const clientToken = next();
    await request(app).post('/api/billing/interest').set(auth(member.token)).send({ plan: 'LEAGUE', clientToken });

    const row = await prisma.planInterest.findUnique({ where: { clientToken } });
    expect(row?.userId).toBe(member.user.id);
  });

  it('rejects an unknown plan, a bad email and a bad team count', async () => {
    const res = await request(app).post('/api/billing/interest')
      .send({ plan: 'GOLD', clientToken: next(), email: 'not-an-email', teamCount: 0 });
    expect(res.status).toBe(400);
    expect(res.body.fields).toEqual({ plan: 'invalid', email: 'invalid', teamCount: 'invalid' });
  });

  it('answers a bot in the honeypot without storing anything', async () => {
    const clientToken = next();
    const res = await request(app).post('/api/billing/interest').send({ plan: 'LEAGUE', clientToken, website: 'spam.example' });
    expect(res.status).toBe(202);
    expect(await prisma.planInterest.findUnique({ where: { clientToken } })).toBeNull();
  });

  it('stops one address after too many new clicks', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      const res = await request(app).post('/api/billing/interest').send({ plan: 'LEAGUE', clientToken: next() });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 10).every((status) => status === 201)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});

describe('the admin overview', () => {
  it('counts clicks and lists the ones with a contact', async () => {
    const clientToken = next();
    await request(app).post('/api/billing/interest').send({ plan: 'LEAGUE', clientToken, email: 'lead@example.com', teamCount: 10 });

    const res = await request(app).get('/api/admin/plan-interest').set(auth(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(res.body.contacts);
    expect(res.body.last30Days).toBeGreaterThan(0);
    expect(res.body.leads.map((lead: { email: string | null }) => lead.email)).toContain('lead@example.com');
  });

  it('is for admins only', async () => {
    const res = await request(app).get('/api/admin/plan-interest').set(auth(member.token));
    expect(res.status).toBe(403);
  });
});
