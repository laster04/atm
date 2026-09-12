import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import prisma from '../config/database.js';

const stamp = Date.now();

async function adminToken(): Promise<string> {
  const email = `admin-event-${stamp}@test.com`;
  await prisma.user.create({
    data: {
      email,
      password: await bcrypt.hash('password123', 10),
      name: 'Event Admin',
      role: 'ADMIN',
      active: true,
      emailVerified: true,
    },
  });
  const login = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
  return login.body.token;
}

let token: string;
let seasonId: string;
let homeTeamId: string;
let awayTeamId: string;
let gameId: string;
let homePlayerId: string;
let homePlayer2Id: string;
let awayPlayerId: string;

const auth = () => ({ Authorization: `Bearer ${token}` });

beforeAll(async () => {
  token = await adminToken();

  const league = await request(app).post('/api/leagues').set(auth())
    .send({ name: `Event League ${stamp}`, sportType: 'HOCKEY' });
  const season = await request(app).post('/api/seasons').set(auth())
    .send({ name: `Event Season ${stamp}`, leagueId: league.body.id, startDate: '2026-01-01', endDate: '2026-06-30' });
  seasonId = season.body.id;

  const home = await request(app).post(`/api/teams/season/${seasonId}`).set(auth())
    .send({ name: `Event Home ${stamp}` });
  homeTeamId = home.body.id;
  const away = await request(app).post(`/api/teams/season/${seasonId}`).set(auth())
    .send({ name: `Event Away ${stamp}` });
  awayTeamId = away.body.id;

  const game = await request(app).post(`/api/games/season/${seasonId}`).set(auth())
    .send({ homeTeamId, awayTeamId, date: '2026-02-01T18:00:00.000Z', status: 'SCHEDULED' });
  gameId = game.body.id;

  const p1 = await request(app).post(`/api/players/team/${homeTeamId}`).set(auth())
    .send({ name: 'Home Scorer', number: 9 });
  homePlayerId = p1.body.id;
  const p2 = await request(app).post(`/api/players/team/${homeTeamId}`).set(auth())
    .send({ name: 'Home Assist', number: 10 });
  homePlayer2Id = p2.body.id;
  const p3 = await request(app).post(`/api/players/team/${awayTeamId}`).set(auth())
    .send({ name: 'Away Scorer', number: 7 });
  awayPlayerId = p3.body.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

const postEvent = (body: Record<string, unknown>) =>
  request(app).post(`/api/games/${gameId}/events`).set(auth()).send(body);

describe('match event validation', () => {
  it('rejects an unauthenticated caller', async () => {
    const res = await request(app).post(`/api/games/${gameId}/events`)
      .send({ type: 'GOAL', teamId: homeTeamId });
    expect(res.status).toBe(401);
  });

  it('rejects an unknown event type', async () => {
    const res = await postEvent({ type: 'DANCE', teamId: homeTeamId });
    expect(res.status).toBe(400);
  });

  it('rejects a team that is not playing this game', async () => {
    const other = await request(app).post(`/api/teams/season/${seasonId}`).set(auth())
      .send({ name: `Event Bystander ${stamp}` });
    const res = await postEvent({ type: 'GOAL', teamId: other.body.id });
    expect(res.status).toBe(400);
  });

  it('rejects crediting a player from the other team', async () => {
    const res = await postEvent({ type: 'GOAL', teamId: homeTeamId, playerId: awayPlayerId });
    expect(res.status).toBe(400);
  });

  it('rejects a player assisting their own goal', async () => {
    const res = await postEvent({
      type: 'GOAL', teamId: homeTeamId, playerId: homePlayerId, assistPlayerId: homePlayerId,
    });
    expect(res.status).toBe(400);
  });

  it('rejects penalty minutes on a goal', async () => {
    const res = await postEvent({ type: 'GOAL', teamId: homeTeamId, penaltyMinutes: 2 });
    expect(res.status).toBe(400);
  });

  it('rejects assists on a penalty', async () => {
    const res = await postEvent({
      type: 'PENALTY', teamId: homeTeamId, playerId: homePlayerId, assistPlayerId: homePlayer2Id,
    });
    expect(res.status).toBe(400);
  });

  it('rejects a period below one', async () => {
    const res = await postEvent({ type: 'GOAL', teamId: homeTeamId, period: 0 });
    expect(res.status).toBe(400);
  });
});

describe('derivation from the event log', () => {
  let goalId: string;

  it('derives score, period scores and player lines from recorded events', async () => {
    const goal = await postEvent({
      type: 'GOAL', teamId: homeTeamId, period: 1, minute: 4,
      playerId: homePlayerId, assistPlayerId: homePlayer2Id,
    });
    expect(goal.status).toBe(201);
    goalId = goal.body.id;

    await postEvent({ type: 'GOAL', teamId: homeTeamId, period: 2, playerId: homePlayerId });
    await postEvent({ type: 'GOAL', teamId: awayTeamId, period: 3, playerId: awayPlayerId });
    await postEvent({
      type: 'PENALTY', teamId: homeTeamId, period: 2, playerId: homePlayer2Id, penaltyMinutes: 4,
    });

    const game = await request(app).get(`/api/games/${gameId}`);
    expect(game.body.eventsAuthoritative).toBe(true);
    expect(game.body.homeScore).toBe(2);
    expect(game.body.awayScore).toBe(1);
    expect(game.body.period1HomeScore).toBe(1);
    expect(game.body.period2HomeScore).toBe(1);
    expect(game.body.period3AwayScore).toBe(1);

    const stats = await request(app).get(`/api/game-statistics/game/${gameId}`);
    const scorer = stats.body.find((s: { playerId: string }) => s.playerId === homePlayerId);
    const assistant = stats.body.find((s: { playerId: string }) => s.playerId === homePlayer2Id);
    expect(scorer.goals).toBe(2);
    expect(scorer.assists).toBe(0);
    expect(assistant.goals).toBe(0);
    expect(assistant.assists).toBe(1);
    expect(assistant.penaltyMinutes).toBe(4);
  });

  it('returns the log ordered by period and clock', async () => {
    const res = await request(app).get(`/api/games/${gameId}/events`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(4);
    expect(res.body.map((e: { period: number }) => e.period)).toEqual([1, 2, 2, 3]);
  });

  it('refuses a hand-edited score once the log is authoritative', async () => {
    const res = await request(app).put(`/api/games/${gameId}`).set(auth()).send({ homeScore: 99 });
    expect(res.status).toBe(409);
    const game = await request(app).get(`/api/games/${gameId}`);
    expect(game.body.homeScore).toBe(2);
  });

  it('refuses a hand-entered statistic once the log is authoritative', async () => {
    const res = await request(app).post(`/api/game-statistics/game/${gameId}`).set(auth())
      .send({ playerId: homePlayerId, goals: 50 });
    expect(res.status).toBe(409);
  });

  it('still accepts an edit that does not touch the derived score', async () => {
    const res = await request(app).put(`/api/games/${gameId}`).set(auth())
      .send({ location: 'Zimni stadion' });
    expect(res.status).toBe(200);
    expect(res.body.location).toBe('Zimni stadion');
  });

  it('recomputes when an event is corrected', async () => {
    const res = await request(app).put(`/api/games/events/${goalId}`).set(auth())
      .send({ teamId: awayTeamId, playerId: awayPlayerId, assistPlayerId: null });
    expect(res.status).toBe(200);

    const game = await request(app).get(`/api/games/${gameId}`);
    expect(game.body.homeScore).toBe(1);
    expect(game.body.awayScore).toBe(2);

    const stats = await request(app).get(`/api/game-statistics/game/${gameId}`);
    const assistant = stats.body.find((s: { playerId: string }) => s.playerId === homePlayer2Id);
    // The assist moved away with the goal; only the penalty keeps this line alive.
    expect(assistant.assists).toBe(0);
    expect(assistant.penaltyMinutes).toBe(4);
  });

  it('hands the game back to manual entry when the last event is removed', async () => {
    const events = await request(app).get(`/api/games/${gameId}/events`);
    for (const event of events.body) {
      const res = await request(app).delete(`/api/games/events/${event.id}`).set(auth());
      expect(res.status).toBe(200);
    }

    const game = await request(app).get(`/api/games/${gameId}`);
    expect(game.body.eventsAuthoritative).toBe(false);

    const stats = await request(app).get(`/api/game-statistics/game/${gameId}`);
    expect(stats.body).toEqual([]);

    const edit = await request(app).put(`/api/games/${gameId}`).set(auth()).send({ homeScore: 3 });
    expect(edit.status).toBe(200);
  });
});

describe('taking over a game that already has hand-entered statistics', () => {
  it('refuses rather than silently replacing them', async () => {
    const game = await request(app).post(`/api/games/season/${seasonId}`).set(auth())
      .send({ homeTeamId, awayTeamId, date: '2026-03-01T18:00:00.000Z' });

    await request(app).post(`/api/game-statistics/game/${game.body.id}`).set(auth())
      .send({ playerId: homePlayerId, goals: 1, assists: 0 });

    const res = await request(app).post(`/api/games/${game.body.id}/events`).set(auth())
      .send({ type: 'GOAL', teamId: homeTeamId, playerId: homePlayerId });
    expect(res.status).toBe(409);

    const stats = await request(app).get(`/api/game-statistics/game/${game.body.id}`);
    expect(stats.body).toHaveLength(1);
    expect(stats.body[0].goals).toBe(1);
  });
});
