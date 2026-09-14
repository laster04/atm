import { jest } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import prisma from '../config/database.js';
import { resetContactRateLimit } from '../controllers/contactController.js';
import emailService from '../services/emailService.js';

const stamp = Date.now();
let counter = 0;
const token = () => `test-${stamp}-${++counter}`;

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
  return { email, token: login.body.token as string, user: login.body.user };
}

const auth = (value: string) => ({ Authorization: `Bearer ${value}` });

const valid = () => ({
  category: 'PROBLEM',
  subject: 'Line-up will not save',
  message: 'I pick twelve players on my phone and nothing happens after Save.',
  clientToken: token(),
});

let admin: Awaited<ReturnType<typeof account>>;
let member: Awaited<ReturnType<typeof account>>;
const created: string[] = [];

// Never reach a real mailbox from a test; the notification is asserted instead.
const notified = jest.spyOn(emailService, 'sendSupportTicketEmail').mockResolvedValue(true);

beforeAll(async () => {
  process.env.SUPPORT_EMAIL = 'support@example.invalid';
  admin = await account('admin-contact', 'ADMIN');
  member = await account('member-contact');
});

beforeEach(() => resetContactRateLimit());

afterAll(async () => {
  notified.mockRestore();
  delete process.env.SUPPORT_EMAIL;
  await prisma.supportTicket.deleteMany({ where: { clientToken: { startsWith: `test-${stamp}-` } } });
  await prisma.auditLog.deleteMany({ where: { entityType: 'SupportTicket', entityId: { in: created } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: `-${stamp}@test.com` } } });
  await prisma.$disconnect();
});

describe('POST /api/contact', () => {
  it('accepts a message from a visitor', async () => {
    const res = await request(app).post('/api/contact').send({ ...valid(), email: 'Fan@Example.com' });
    expect(res.status).toBe(201);
    created.push(res.body.id);

    const ticket = await prisma.supportTicket.findUnique({ where: { id: res.body.id } });
    expect(ticket).toMatchObject({ status: 'NEW', email: 'fan@example.com', userId: null });
    expect(notified).toHaveBeenCalledWith('support@example.invalid', expect.objectContaining({ id: res.body.id }));
  });

  it('remembers a signed-in sender', async () => {
    const res = await request(app).post('/api/contact').set(auth(member.token)).send(valid());
    expect(res.status).toBe(201);
    created.push(res.body.id);
    const ticket = await prisma.supportTicket.findUnique({ where: { id: res.body.id } });
    expect(ticket?.userId).toBe(member.user.id);
  });

  it('rejects an invalid message field by field', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send({ category: 'SPAM', subject: 'x', message: 'short', email: 'nope', clientToken: token() });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.fields).sort()).toEqual(['category', 'email', 'message', 'subject']);
  });

  it('keeps only the allowed context and drops the query string', async () => {
    const res = await request(app).post('/api/contact').send({
      ...valid(),
      context: { page: '/team-management/abc?token=secret#x', viewport: '390x844', password: 'hunter2', signedIn: false },
    });
    expect(res.status).toBe(201);
    created.push(res.body.id);
    const ticket = await prisma.supportTicket.findUnique({ where: { id: res.body.id } });
    expect(ticket?.context).toEqual({ page: '/team-management/abc', viewport: '390x844', signedIn: false });
  });

  it('returns the first ticket when the same message is sent twice', async () => {
    const body = valid();
    const first = await request(app).post('/api/contact').send(body);
    const second = await request(app).post('/api/contact').send(body);
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);
    created.push(first.body.id);
    expect(await prisma.supportTicket.count({ where: { clientToken: body.clientToken } })).toBe(1);
  });

  it('answers a filled honeypot without storing anything', async () => {
    const body = { ...valid(), website: 'http://spam.example' };
    const callsBefore = notified.mock.calls.length;
    const res = await request(app).post('/api/contact').send(body);
    expect(res.status).toBe(202);
    expect(notified.mock.calls.length).toBe(callsBefore);
    expect(await prisma.supportTicket.count({ where: { clientToken: body.clientToken } })).toBe(0);
  });

  it('limits how many messages one address can send', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await request(app).post('/api/contact').send(valid());
      statuses.push(res.status);
      if (res.body.id) created.push(res.body.id);
    }
    expect(statuses.slice(0, 5)).toEqual([201, 201, 201, 201, 201]);
    expect(statuses[5]).toBe(429);
  });
});

describe('support tickets in admin', () => {
  it('lists tickets for an admin only', async () => {
    expect((await request(app).get('/api/contact')).status).toBe(401);
    expect((await request(app).get('/api/contact').set(auth(member.token))).status).toBe(403);

    const res = await request(app).get('/api/contact?status=NEW').set(auth(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.every((ticket: { status: string }) => ticket.status === 'NEW')).toBe(true);
  });

  it('changes status and records who did it', async () => {
    const sent = await request(app).post('/api/contact').send(valid());
    created.push(sent.body.id);

    expect((await request(app).put(`/api/contact/${sent.body.id}`).set(auth(member.token)).send({ status: 'RESOLVED' })).status).toBe(403);
    expect((await request(app).put(`/api/contact/${sent.body.id}`).set(auth(admin.token)).send({ status: 'DONE' })).status).toBe(400);

    const res = await request(app).put(`/api/contact/${sent.body.id}`).set(auth(admin.token)).send({ status: 'RESOLVED' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('RESOLVED');

    const trail = await prisma.auditLog.findFirst({ where: { entityType: 'SupportTicket', entityId: sent.body.id } });
    expect(trail).toMatchObject({ action: 'UPDATE', actorId: admin.user.id });
  });
});

describe('POST /api/auth/updates-seen', () => {
  it('stamps the signed-in user and shows up on /me', async () => {
    expect((await request(app).post('/api/auth/updates-seen')).status).toBe(401);

    const res = await request(app).post('/api/auth/updates-seen').set(auth(member.token));
    expect(res.status).toBe(200);
    expect(res.body.updatesSeenAt).toBeTruthy();

    const me = await request(app).get('/api/auth/me').set(auth(member.token));
    expect(me.body.user.updatesSeenAt).toBe(res.body.updatesSeenAt);
  });
});
