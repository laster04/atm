import { jest } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import prisma from '../config/database.js';
import emailService from '../services/emailService.js';
import { zonedParts } from '../utils/time.js';
import { documentNumber } from '../services/invoices/documents.js';

// Rendered documents land in a throwaway folder, not the project's uploads.
process.env.STORAGE_LOCAL_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-tax-'));

const stamp = Date.now();
const auth = (value: string) => ({ Authorization: `Bearer ${value}` });

async function account(label: string, role: 'ADMIN' | 'USER' = 'USER') {
  const email = `${label}-tax-${stamp}@test.com`;
  const user = await prisma.user.create({
    data: { email, password: await bcrypt.hash('password123', 10), name: label, role, active: true, emailVerified: true },
  });
  const res = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
  return { id: user.id, email, token: res.body.token as string };
}

let admin: Awaited<ReturnType<typeof account>>;
let organiser: Awaited<ReturnType<typeof account>>;

beforeAll(async () => {
  admin = await account('admin', 'ADMIN');
  organiser = await account('organiser');
});

jest.spyOn(emailService, 'sendPaymentNoticeEmail').mockResolvedValue(true);
const documents = jest.spyOn(emailService, 'sendTaxDocumentEmail').mockResolvedValue(true);

afterAll(async () => {
  await prisma.$disconnect();
});

async function paidFor(label: string, plan: 'TOURNAMENT' | 'TOURNAMENT_PLUS' | 'ORGANIZER' = 'TOURNAMENT', currency = 'CZK') {
  const owner = plan === 'ORGANIZER' ? await account(`holder-${label}`) : organiser;
  const series = await request(app).post('/api/tournaments/series').set(auth(owner.token))
    .send({ name: `Tax Series ${label} ${stamp}`, sportType: 'FLOORBALL' });
  const tournament = await request(app).post(`/api/tournaments/series/${series.body.id}/tournaments`).set(auth(owner.token))
    .send({ name: `Tax Cup ${label} ${stamp}` });
  const payment = await request(app).post(`/api/tournaments/${tournament.body.id}/payments`).set(auth(owner.token))
    .send({ plan, currency });
  expect(payment.status).toBe(201);
  return { id: payment.body.id as string, owner };
}

const confirm = (ids: string[]) => request(app).post('/api/admin/payments/confirm').set(auth(admin.token)).send({ ids });

const documentOf = (paymentId: string) => prisma.taxDocument.findUniqueOrThrow({ where: { paymentId } });

/** Waits for the delivery that runs after the confirmation is answered. */
async function delivered(paymentId: string) {
  const until = Date.now() + 5000;
  for (;;) {
    const document = await documentOf(paymentId);
    if (document.fileKey && document.emailedAt) return document;
    if (Date.now() > until) throw new Error('The document was not delivered');
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

describe('the document number', () => {
  it('reads ATM, the year and a four-digit sequence that grows past 9999', () => {
    expect(documentNumber(2026, 1)).toBe('ATM26-0001');
    expect(documentNumber(2027, 345)).toBe('ATM27-0345');
    expect(documentNumber(2026, 12345)).toBe('ATM26-12345');
  });
});

describe('issuing a tax document on confirmation', () => {
  it('numbers it by year, stores what it says, and e-mails the PDF to the payer', async () => {
    const { id } = await paidFor('issue');
    documents.mockClear();
    expect((await confirm([id])).body.done).toEqual([id]);

    const year = zonedParts(new Date()).year;
    const document = await delivered(id);
    expect(document.number).toBe(`ATM${String(year).slice(-2)}-${String(document.sequence).padStart(4, '0')}`);
    expect(document.kind).toBe('SIMPLIFIED');
    expect(document.content).toMatchObject({
      issuer: { name: 'Conesoft s.r.o.', ico: '24359114', dic: 'CZ24359114' },
      customer: null,
      currency: 'CZK',
      totals: { gross: 69000, base: 57025, vat: 11975 },
      lines: [{ description: { cs: expect.stringContaining('Turnaj – Tax Cup issue'), en: expect.stringContaining('Tournament – Tax Cup issue') } }],
    });

    expect(documents).toHaveBeenCalledWith(expect.objectContaining({ to: organiser.email, number: document.number, locale: 'cs' }));
    const pdf = documents.mock.calls[0][0].pdf;
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('lets the admin download it through a short-lived link', async () => {
    const { id } = await paidFor('download');
    await confirm([id]);
    await delivered(id);

    const link = await request(app).get(`/api/admin/payments/${id}/document`).set(auth(admin.token));
    expect(link.status).toBe(200);
    const file = await request(app).get(link.body.url).buffer(true);
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toContain('application/pdf');
    expect(Buffer.from(file.body).subarray(0, 5).toString()).toBe('%PDF-');

    expect((await request(app).get(`/api/admin/payments/${id}/document`).set(auth(organiser.token))).status).toBe(403);
    const found = await request(app).get('/api/admin/payments').query({ q: link.body.number }).set(auth(admin.token));
    expect(found.body.rows.map((row: { id: string }) => row.id)).toStrictEqual([id]);
    expect(found.body.rows[0].document).toMatchObject({ number: link.body.number, kind: 'SIMPLIFIED' });
  });

  it('writes the year an Organizer plan covers, and English for a payment in euros', async () => {
    const { id, owner } = await paidFor('organizer', 'ORGANIZER', 'EUR');
    documents.mockClear();
    await confirm([id]);
    const document = await delivered(id);
    const line = (document.content as { lines: { description: { cs: string } }[] }).lines[0];
    expect(line.description.cs).toMatch(/^Organizátor \(rok\), \d+\. \d+\. \d{4} – \d+\. \d+\. \d{4}/);
    expect(documents).toHaveBeenCalledWith(expect.objectContaining({ to: owner.email, locale: 'en', amount: expect.stringContaining('€') }));
  });

  it('never skips a number, also when confirmations run at the same time or are refused', async () => {
    const first = await paidFor('race-1');
    const second = await paidFor('race-2');
    const results = await Promise.all([confirm([first.id]), confirm([second.id]), confirm([first.id])]);
    expect(results.flatMap((res) => res.body.done).sort()).toEqual([first.id, second.id].sort());
    expect(results.flatMap((res) => res.body.skipped)).toEqual([{ id: first.id, code: 'NOT_PENDING' }]);

    const year = zonedParts(new Date()).year;
    const [{ count, max }] = await prisma.$queryRaw<{ count: bigint; max: number }[]>`
      SELECT count(*) AS count, max(sequence) AS max FROM tax_documents WHERE year = ${year}`;
    const counter = await prisma.documentCounter.findUniqueOrThrow({ where: { year } });
    expect(Number(count)).toBe(max);
    expect(counter.last).toBe(max);
  });
});
