import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';
import { jest } from '@jest/globals';
import app from '../app.js';
import prisma from '../config/database.js';
import { emailService } from '../services/emailService.js';

const stamp = Date.now();
const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-plus-'));
process.env.STORAGE_DRIVER = 'local';
process.env.STORAGE_LOCAL_DIR = storageDir;
process.env.STORAGE_PUBLIC_URL = '/api/uploads';

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
let organiser: { id: string; token: string };
let stranger: { id: string; token: string };

async function account(label: string) {
  const email = `${label}-plus-${stamp}@test.com`;
  const user = await prisma.user.create({
    data: { email, password: await bcrypt.hash('password123', 10), name: label, active: true, emailVerified: true },
  });
  const res = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
  return { id: user.id, token: res.body.token as string };
}

const pdf = (text = 'rules') => Buffer.from(`%PDF-1.4\n% ${text}\n%%EOF\n`);

async function tournament(label: string, plan: 'FREE' | 'TOURNAMENT_PLUS' = 'TOURNAMENT_PLUS') {
  const series = await request(app).post('/api/tournaments/series').set(auth(organiser.token))
    .send({ name: `Plus Series ${label} ${stamp}`, sportType: 'FLOORBALL' });
  const created = await request(app).post(`/api/tournaments/series/${series.body.id}/tournaments`).set(auth(organiser.token))
    .send({ name: `Plus Cup ${label} ${stamp}` });
  await prisma.tournament.update({ where: { id: created.body.id }, data: { plan } });
  return { id: created.body.id as string, seriesId: series.body.id as string };
}

async function logo(): Promise<string> {
  const png = await sharp({ create: { width: 300, height: 100, channels: 3, background: '#0f172a' } }).png().toBuffer();
  const res = await request(app).post('/api/files/logo').set(auth(organiser.token)).attach('file', png, 'sponsor.png');
  expect(res.status).toBe(201);
  return res.body.url as string;
}

const addSponsor = async (id: string, name = 'Pivovar', url?: string) =>
  request(app).post(`/api/tournaments/${id}/sponsors`).set(auth(organiser.token)).send({ name, url, logo: await logo() });

const addDocument = (id: string, body: Buffer = pdf(), filename = 'propozice_2026.pdf', title?: string) => {
  const req = request(app).post(`/api/tournaments/${id}/documents`).set(auth(organiser.token)).attach('file', body, filename);
  return title ? req.field('title', title) : req;
};

beforeAll(async () => {
  organiser = await account('organiser');
  stranger = await account('stranger');
});

afterAll(async () => {
  fs.rmSync(storageDir, { recursive: true, force: true });
  await prisma.$disconnect();
});

describe('sponsors', () => {
  it('are a paid feature: a free tournament gets the upgrade answer', async () => {
    const { id } = await tournament('FreeSponsor', 'FREE');
    const res = await addSponsor(id);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'PLAN_FEATURE', feature: 'SPONSOR_LOGOS', plan: 'FREE', limit: 0 });
  });

  it('show on the public page in the chosen order, up to the plan limit', async () => {
    const { id } = await tournament('Sponsors');
    const first = await addSponsor(id, 'Pivovar', 'https://pivovar.example');
    const second = await addSponsor(id, 'Pekárna');
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect((await addSponsor(id, 'Bad', 'javascript:alert(1)')).status).toBe(400);

    const order = await request(app).put(`/api/tournaments/${id}/sponsors/order`).set(auth(organiser.token))
      .send({ ids: [second.body.id, first.body.id] });
    expect(order.status).toBe(200);
    const page = await request(app).get(`/api/tournaments/${id}`);
    expect(page.body.branding).toBe('LIGHT');
    expect(page.body.sponsors.map((s: { name: string }) => s.name)).toEqual(['Pekárna', 'Pivovar']);
    expect(page.body.sponsors[1].url).toBe('https://pivovar.example/');

    for (let i = 0; i < 8; i++) expect((await addSponsor(id, `Partner ${i}`)).status).toBe(201);
    expect((await addSponsor(id, 'Eleventh')).body).toMatchObject({ code: 'PLAN_FEATURE', limit: 10 });
  });

  it('only the organiser changes them, and removing one frees its logo', async () => {
    const { id } = await tournament('SponsorEdit');
    const sponsor = await addSponsor(id);
    expect((await request(app).delete(`/api/tournaments/${id}/sponsors/${sponsor.body.id}`).set(auth(stranger.token))).status).toBe(403);
    const removed = await request(app).delete(`/api/tournaments/${id}/sponsors/${sponsor.body.id}`).set(auth(organiser.token));
    expect(removed.status).toBe(200);
    expect(await prisma.storedFile.count({ where: { url: sponsor.body.logo } })).toBe(0);
  });
});

describe('documents', () => {
  it('take PDFs only, titled from the file name when no title is given', async () => {
    const { id } = await tournament('Docs');
    expect((await addDocument(id, Buffer.from('not a pdf'), 'fake.pdf')).body.code).toBe('NOT_PDF');
    const res = await addDocument(id);
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('propozice 2026');
    const titled = await addDocument(id, pdf('b'), 'b.pdf', 'Pravidla');
    expect(titled.body.title).toBe('Pravidla');
    const page = await request(app).get(`/api/tournaments/${id}`);
    expect(page.body.documents.map((d: { title: string }) => d.title)).toEqual(['propozice 2026', 'Pravidla']);
  });

  it('download through a short-lived link, only for those who may see the tournament', async () => {
    const { id, seriesId } = await tournament('DocsPrivate');
    const doc = await addDocument(id);
    const link = await request(app).get(`/api/tournaments/${id}/documents/${doc.body.id}/download`);
    expect(link.status).toBe(302);
    const file = await request(app).get(link.headers.location).buffer(true);
    expect(file.status).toBe(200);
    expect(Buffer.from(file.body).subarray(0, 5).toString()).toBe('%PDF-');

    await prisma.tournamentSeries.update({ where: { id: seriesId }, data: { visibility: 'PRIVATE' } });
    expect((await request(app).get(`/api/tournaments/${id}/documents/${doc.body.id}/download`)).status).toBe(404);
  });

  it('stop at the plan limit and go from storage with their tournament', async () => {
    const { id } = await tournament('DocsLimit');
    for (let i = 0; i < 5; i++) expect((await addDocument(id, pdf(String(i)), `${i}.pdf`)).status).toBe(201);
    expect((await addDocument(id)).body).toMatchObject({ code: 'PLAN_FEATURE', feature: 'DOCUMENTS', limit: 5 });

    const files = await prisma.storedFile.findMany({ where: { kind: 'DOCUMENT', ownerId: id } });
    expect(files).toHaveLength(5);
    expect((await request(app).delete(`/api/tournaments/${id}`).set(auth(organiser.token))).status).toBe(200);
    expect(await prisma.storedFile.count({ where: { kind: 'DOCUMENT', ownerId: id } })).toBe(0);
    for (const file of files) expect(fs.existsSync(path.join(storageDir, 'private', file.key))).toBe(false);
  });

  it('stay when the plan ends, but no more can be added', async () => {
    const { id } = await tournament('DocsLapsed');
    await addDocument(id);
    await addSponsor(id);
    await prisma.tournament.update({ where: { id }, data: { plan: 'FREE' } });
    const page = await request(app).get(`/api/tournaments/${id}`);
    expect(page.body.documents).toHaveLength(1);
    expect(page.body.sponsors).toHaveLength(1);
    expect(page.body.branding).toBe('FULL');
    expect((await addDocument(id)).status).toBe(409);
  });
});

describe('branding', () => {
  it('tells the sign-up form how much ATM to show', async () => {
    const plus = await tournament('BrandPlus');
    const free = await tournament('BrandFree', 'FREE');
    expect((await request(app).get(`/api/registrations/tournament/${plus.id}`)).body.branding).toBe('LIGHT');
    expect((await request(app).get(`/api/registrations/tournament/${free.id}`)).body.branding).toBe('FULL');
  });

  it('puts the series mark and a small credit on a Turnaj Plus e-mail', async () => {
    const send = jest.spyOn(emailService, 'sendEmail').mockResolvedValue(true);
    await emailService.sendRegistrationDecisionEmail({
      to: 'team@test.com', contactName: 'Jana', teamName: 'Sokol', competitionName: 'Cup',
      decision: 'APPROVED', reason: null, link: 'https://example.com', locale: 'cs',
      brand: { name: 'Jarní pohár', logo: null },
    });
    const html = send.mock.calls[0][0].html;
    send.mockRestore();
    expect(html).toContain('Jarní pohár');
    expect(html).toContain('Běží na ATM');
    expect(html).not.toContain('ATM &ndash; Amateur Team Management');
  });
});
