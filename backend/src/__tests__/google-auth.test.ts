import request from 'supertest';
import bcrypt from 'bcryptjs';
import { jest } from '@jest/globals';
import { OAuth2Client, type LoginTicket } from 'google-auth-library';
import app from '../app.js';
import prisma from '../config/database.js';
import { emailService } from '../services/emailService.js';

const stamp = Date.now();
const CLIENT_ID = 'test-client.apps.googleusercontent.com';

// Nothing leaves the test: no mail, no call to Google. The credential string
// stands for the payload Google would have signed.
const sent = jest.spyOn(emailService, 'sendEmail').mockResolvedValue(true);
const payloads: Record<string, object> = {};
const verify = jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockImplementation((async (
  options: { idToken: string; audience?: string | string[] },
) => {
  const payload = payloads[options.idToken];
  if (!payload || options.audience !== CLIENT_ID) throw new Error('Invalid token');
  return { getPayload: () => payload } as unknown as LoginTicket;
}) as never);

const googleUser = (label: string, extra: object = {}) => {
  const credential = `cred-${label}-${stamp}`;
  payloads[credential] = {
    sub: `sub-${label}-${stamp}`,
    email: `${label}-google-${stamp}@test.com`,
    email_verified: true,
    name: `Google ${label}`,
    ...extra,
  };
  return { credential, email: `${label}-google-${stamp}@test.com`, googleId: `sub-${label}-${stamp}` };
};

const previousClientId = process.env.GOOGLE_CLIENT_ID;
beforeEach(() => {
  process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: `-google-${stamp}@` } } });
  if (previousClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
  else process.env.GOOGLE_CLIENT_ID = previousClientId;
  sent.mockRestore();
  verify.mockRestore();
});

describe('sign-in with Google', () => {
  it('tells the app the client id, or that there is none', async () => {
    expect((await request(app).get('/api/auth/google/config')).body).toEqual({ clientId: CLIENT_ID });
    delete process.env.GOOGLE_CLIENT_ID;
    expect((await request(app).get('/api/auth/google/config')).body).toEqual({ clientId: null });
    const { credential } = googleUser('off');
    expect((await request(app).post('/api/auth/google').send({ credential })).status).toBe(404);
  });

  it('needs a credential, and one Google signed for us', async () => {
    expect((await request(app).post('/api/auth/google').send({})).status).toBe(400);
    expect((await request(app).post('/api/auth/google').send({ credential: 'forged' })).status).toBe(401);
  });

  it('refuses an address Google has not verified', async () => {
    const { credential, email } = googleUser('unverified', { email_verified: false });
    expect((await request(app).post('/api/auth/google').send({ credential })).status).toBe(401);
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
  });

  it('creates an activated account and signs it in', async () => {
    const { credential, email, googleId } = googleUser('new');
    const res = await request(app).post('/api/auth/google').send({ credential, locale: 'en' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ created: true, user: { email, name: 'Google new', role: 'USER', locale: 'en' } });
    expect(res.body.token).toEqual(expect.any(String));
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user).toMatchObject({ googleId, emailVerified: true, activationToken: null });

    const again = await request(app).post('/api/auth/google').send({ credential });
    expect(again.status).toBe(200);
    expect(again.body).toMatchObject({ created: false, user: { id: user.id } });
  });

  it('links an existing account with the same address and activates it', async () => {
    const { credential, email, googleId } = googleUser('existing');
    const existing = await prisma.user.create({
      data: {
        email,
        password: await bcrypt.hash('password123', 10),
        name: 'Jana',
        emailVerified: false,
        activationToken: `token-${stamp}`,
      },
    });
    const res = await request(app).post('/api/auth/google').send({ credential });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ created: false, user: { id: existing.id, name: 'Jana' } });
    expect(await prisma.user.findUniqueOrThrow({ where: { id: existing.id } }))
      .toMatchObject({ googleId, emailVerified: true, activationToken: null });
    // The password still works alongside Google.
    expect((await request(app).post('/api/auth/login').send({ email, password: 'password123' })).status).toBe(200);
  });

  it('keeps a deactivated account out', async () => {
    const { credential, email } = googleUser('inactive');
    await prisma.user.create({
      data: { email, password: 'x', name: 'Off', active: false, emailVerified: true },
    });
    expect((await request(app).post('/api/auth/google').send({ credential })).status).toBe(403);
  });
});
