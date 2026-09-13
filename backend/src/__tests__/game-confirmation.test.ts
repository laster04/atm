import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import prisma from '../config/database.js';

const stamp = Date.now();

let token: string;
let seasonId: string;
let homeTeamId: string;
let awayTeamId: string;
let playerId: string;
let gameId: string;

const auth = () => ({ Authorization: `Bearer ${token}` });

async function newGame(): Promise<string> {
  const res = await request(app).post(`/api/games/season/${seasonId}`).set(auth())
    .send({ homeTeamId, awayTeamId, date: '2026-04-01T18:00:00.000Z' });
  return res.body.id;
}

beforeAll(async () => {
  const email = `admin-confirm-${stamp}@test.com`;
  await prisma.user.create({
    data: {
      email,
      password: await bcrypt.hash('password123', 10),
      name: 'Confirm Admin',
      role: 'ADMIN',
      active: true,
      emailVerified: true,
    },
  });
  const login = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
  token = login.body.token;

  const league = await request(app).post('/api/leagues').set(auth())
    .send({ name: `Confirm League ${stamp}`, sportType: 'HOCKEY' });
  const season = await request(app).post('/api/seasons').set(auth())
    .send({ name: `Confirm Season ${stamp}`, leagueId: league.body.id, startDate: '2026-01-01', endDate: '2026-06-30' });
  seasonId = season.body.id;

  const home = await request(app).post(`/api/teams/season/${seasonId}`).set(auth())
    .send({ name: `Confirm Home ${stamp}` });
  homeTeamId = home.body.id;
  const away = await request(app).post(`/api/teams/season/${seasonId}`).set(auth())
    .send({ name: `Confirm Away ${stamp}` });
  awayTeamId = away.body.id;

  const player = await request(app).post(`/api/players/team/${homeTeamId}`).set(auth())
    .send({ name: 'Confirm Scorer', number: 11 });
  playerId = player.body.id;

  gameId = await newGame();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('confirming a match report', () => {
  it('refuses to confirm a game that has not been played', async () => {
    const res = await request(app).post(`/api/games/${gameId}/confirm`).set(auth());
    expect(res.status).toBe(400);
  });

  it('confirms a completed game and records who did it', async () => {
    await request(app).post(`/api/games/${gameId}/events`).set(auth())
      .send({ type: 'GOAL', teamId: homeTeamId, period: 1, playerId });
    await request(app).put(`/api/games/${gameId}`).set(auth()).send({ status: 'COMPLETED' });

    const res = await request(app).post(`/api/games/${gameId}/confirm`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.confirmedAt).toBeTruthy();
    expect(res.body.confirmedById).toBeTruthy();
  });

  it('refuses to confirm twice', async () => {
    const res = await request(app).post(`/api/games/${gameId}/confirm`).set(auth());
    expect(res.status).toBe(409);
  });
});

describe('a confirmed report is closed', () => {
  it('refuses a new event', async () => {
    const res = await request(app).post(`/api/games/${gameId}/events`).set(auth())
      .send({ type: 'GOAL', teamId: awayTeamId, period: 2 });
    expect(res.status).toBe(409);
  });

  it('refuses to change an existing event', async () => {
    const events = await request(app).get(`/api/games/${gameId}/events`);
    const res = await request(app).put(`/api/games/events/${events.body[0].id}`).set(auth())
      .send({ period: 3 });
    expect(res.status).toBe(409);
  });

  it('refuses to delete an event', async () => {
    const events = await request(app).get(`/api/games/${gameId}/events`);
    const res = await request(app).delete(`/api/games/events/${events.body[0].id}`).set(auth());
    expect(res.status).toBe(409);
    expect((await request(app).get(`/api/games/${gameId}/events`)).body).toHaveLength(1);
  });

  it('refuses to edit the game itself', async () => {
    const res = await request(app).put(`/api/games/${gameId}`).set(auth()).send({ location: 'Elsewhere' });
    expect(res.status).toBe(409);
  });
});

describe('reopening', () => {
  it('requires a reason', async () => {
    const res = await request(app).post(`/api/games/${gameId}/reopen`).set(auth()).send({});
    expect(res.status).toBe(400);

    const tooShort = await request(app).post(`/api/games/${gameId}/reopen`).set(auth()).send({ reason: 'x' });
    expect(tooShort.status).toBe(400);
  });

  it('reopens with a reason and lets the report be corrected again', async () => {
    const res = await request(app).post(`/api/games/${gameId}/reopen`).set(auth())
      .send({ reason: 'Scorer recorded against the wrong player' });
    expect(res.status).toBe(200);
    expect(res.body.confirmedAt).toBeNull();

    const added = await request(app).post(`/api/games/${gameId}/events`).set(auth())
      .send({ type: 'GOAL', teamId: awayTeamId, period: 2 });
    expect(added.status).toBe(201);
  });

  it('refuses to reopen a game that is not confirmed', async () => {
    const res = await request(app).post(`/api/games/${gameId}/reopen`).set(auth())
      .send({ reason: 'Nothing to reopen' });
    expect(res.status).toBe(409);
  });
});

describe('the audit trail', () => {
  it('records the confirmation, the reason for reopening, and every report change', async () => {
    const res = await request(app).get(`/api/games/${gameId}/audit`).set(auth());
    expect(res.status).toBe(200);

    const actions = res.body.map((entry: { action: string }) => entry.action);
    expect(actions).toContain('CONFIRM');
    expect(actions).toContain('REOPEN');
    expect(actions).toContain('CREATE');

    const reopen = res.body.find((entry: { action: string }) => entry.action === 'REOPEN');
    expect(reopen.reason).toBe('Scorer recorded against the wrong player');
    expect(reopen.actor).not.toBeNull();

    // Newest first, so the correction made after reopening leads the list.
    const times = res.body.map((entry: { createdAt: string }) => new Date(entry.createdAt).getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it('keeps the trail after the game it describes is deleted', async () => {
    const doomed = await newGame();
    await request(app).put(`/api/games/${doomed}`).set(auth()).send({ status: 'COMPLETED' });
    await request(app).post(`/api/games/${doomed}/confirm`).set(auth());
    await request(app).post(`/api/games/${doomed}/reopen`).set(auth()).send({ reason: 'Deleting this fixture' });
    await request(app).delete(`/api/games/${doomed}`).set(auth());

    const entries = await prisma.auditLog.findMany({ where: { entityType: 'Game', entityId: doomed } });
    expect(entries.length).toBeGreaterThanOrEqual(2);
  });

  it('is not readable without season access', async () => {
    const res = await request(app).get(`/api/games/${gameId}/audit`);
    expect(res.status).toBe(401);
  });
});
