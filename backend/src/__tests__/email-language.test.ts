import request from 'supertest';
import bcrypt from 'bcryptjs';
import { jest } from '@jest/globals';
import app from '../app.js';
import prisma from '../config/database.js';
import { emailService } from '../services/emailService.js';
import { LOCALES, emailTexts, fill, localeOf } from '../i18n/index.js';

const stamp = Date.now();
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

// Whatever a method builds ends up here; nothing leaves the test.
const sent = jest.spyOn(emailService, 'sendEmail').mockResolvedValue(true);
const lastMail = () => sent.mock.calls[sent.mock.calls.length - 1][0];

async function account(label: string, locale = 'cs') {
  const email = `${label}-lang-${stamp}@test.com`;
  await prisma.user.create({
    data: { email, password: await bcrypt.hash('password123', 10), name: label, active: true, emailVerified: true, locale },
  });
  const login = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
  return { email, token: login.body.token as string };
}

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: `-lang-${stamp}@` } } });
  sent.mockRestore();
});

describe('the language of an e-mail', () => {
  it('reads a language from a browser tag and falls back to Czech', () => {
    expect(localeOf('sk-SK')).toBe('sk');
    expect(localeOf('EN')).toBe('en');
    expect(localeOf('pl')).toBe('cs');
    expect(localeOf(undefined)).toBe('cs');
    expect(localeOf(42)).toBe('cs');
  });

  it('escapes what people typed but keeps the markup of the text', () => {
    expect(fill('<strong>{{team}}</strong>', { team: '<b>A&B</b>' })).toBe('<strong>&lt;b&gt;A&amp;B&lt;/b&gt;</strong>');
  });

  it('has every text in every language', () => {
    const shape = (value: unknown): unknown =>
      Array.isArray(value) ? 'list'
        : value && typeof value === 'object'
          ? Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, shape(inner)]))
          : typeof value;
    for (const locale of LOCALES) expect(shape(emailTexts(locale))).toStrictEqual(shape(emailTexts('cs')));
  });

  it('remembers the language an account was registered in', async () => {
    const email = `register-lang-${stamp}@test.com`;
    const res = await request(app).post('/api/auth/register')
      .send({ email, password: 'password123', name: 'Jana', locale: 'sk-SK' });
    expect(res.status).toBe(201);
    expect((await prisma.user.findUniqueOrThrow({ where: { email } })).locale).toBe('sk');
    expect(lastMail()).toMatchObject({ to: email, subject: emailTexts('sk').activation.subject });
  });

  it('keeps Czech for a language the server does not write', async () => {
    const email = `register-pl-lang-${stamp}@test.com`;
    await request(app).post('/api/auth/register').send({ email, password: 'password123', name: 'Ola', locale: 'pl' });
    expect((await prisma.user.findUniqueOrThrow({ where: { email } })).locale).toBe('cs');
  });

  it('follows the language picked in the app and ignores an unknown one', async () => {
    const user = await account('switch');
    const switched = await request(app).put('/api/auth/profile').set(auth(user.token)).send({ locale: 'sk' });
    expect(switched.status).toBe(200);
    expect(switched.body.user.locale).toBe('sk');

    await request(app).put('/api/auth/profile').set(auth(user.token)).send({ locale: 'xx' });
    const me = await request(app).get('/api/auth/me').set(auth(user.token));
    expect(me.body.user.locale).toBe('sk');
  });

  it('writes a password reset in the language on screen, else the account\'s', async () => {
    const user = await account('reset', 'sk');
    await request(app).post('/api/auth/forgot-password').send({ email: user.email });
    expect(lastMail()).toMatchObject({ to: user.email, subject: emailTexts('sk').passwordReset.subject });

    await request(app).post('/api/auth/forgot-password').send({ email: user.email, locale: 'en' });
    expect(lastMail()).toMatchObject({ to: user.email, subject: emailTexts('en').passwordReset.subject });
  });

  it('writes the organiser notice in Slovak with escaped names', async () => {
    await emailService.sendRegistrationNoticeEmail({
      to: 'organiser@test.com',
      teamName: 'HC <Sokol>',
      contactName: 'Ján',
      contactEmail: 'jan@test.com',
      competitionName: 'Jarný turnaj',
      waitlisted: true,
      capacity: { approved: 6, pending: 2, waitlisted: 3, max: 8 },
      link: 'https://example.com',
      locale: 'sk',
    });
    const mail = lastMail();
    expect(mail.subject).toBe('Nová prihláška: HC <Sokol> – Jarný turnaj');
    expect(mail.html).toContain('<strong>HC &lt;Sokol&gt;</strong>');
    expect(mail.html).toContain('6 v súťaži · 2 čaká na rozhodnutie · 3 na čakacej listine · 8 miest');
  });
});
