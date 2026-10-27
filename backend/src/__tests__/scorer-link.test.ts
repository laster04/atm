import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import prisma from '../config/database.js';

const stamp = Date.now();

let adminToken: string;
let leagueManagerToken: string;
let teamManagerToken: string;
let seasonId: string;
let homeTeamId: string;
let awayTeamId: string;
let homePlayerId: string;
let awayPlayerId: string;

const as = (token: string) => ({ Authorization: `Bearer ${token}` });

async function userToken(label: string, role: 'ADMIN' | 'USER' = 'USER'): Promise<{ id: string; token: string }> {
  const email = `scorer-${label}-${stamp}@test.com`;
  const user = await prisma.user.create({
    data: {
      email,
      password: await bcrypt.hash('password123', 10),
      name: `Scorer ${label}`,
      role,
      active: true,
      emailVerified: true,
    },
  });
  const login = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
  return { id: user.id, token: login.body.token };
}

async function newGame(date = '2026-04-01T18:00:00.000Z', inSeason = seasonId): Promise<string> {
  const res = await request(app).post(`/api/games/season/${inSeason}`).set(as(adminToken))
    .send({ homeTeamId, awayTeamId, date });
  return res.body.id;
}

/** A fresh link for the game, as the season manager hands it out; returns its token. */
async function linkFor(gameId: string, label = 'Table'): Promise<string> {
  const res = await request(app).post(`/api/games/${gameId}/scorer-link`).set(as(leagueManagerToken)).send({ label });
  expect(res.status).toBe(201);
  return (res.body.url as string).split('/zapis/')[1];
}

const goal = (token: string, teamId: string, extra: Record<string, unknown> = {}) =>
  request(app).post(`/api/scorer/${token}/goals`).send({ teamId, period: 1, ...extra });

beforeAll(async () => {
  adminToken = (await userToken('admin', 'ADMIN')).token;
  const leagueManager = await userToken('league');
  const teamManager = await userToken('team');
  leagueManagerToken = leagueManager.token;
  teamManagerToken = teamManager.token;

  const league = await request(app).post('/api/leagues').set(as(adminToken))
    .send({ name: `Scorer League ${stamp}`, sportType: 'HOCKEY' });
  await prisma.league.update({ where: { id: league.body.id }, data: { managerId: leagueManager.id } });
  const season = await request(app).post('/api/seasons').set(as(adminToken))
    .send({ name: `Scorer Season ${stamp}`, leagueId: league.body.id, startDate: '2026-01-01', endDate: '2026-06-30' });
  seasonId = season.body.id;

  const home = await request(app).post(`/api/teams/season/${seasonId}`).set(as(adminToken)).send({ name: `Scorer Home ${stamp}` });
  homeTeamId = home.body.id;
  const away = await request(app).post(`/api/teams/season/${seasonId}`).set(as(adminToken)).send({ name: `Scorer Away ${stamp}` });
  awayTeamId = away.body.id;
  await prisma.team.update({ where: { id: homeTeamId }, data: { managerId: teamManager.id } });

  homePlayerId = (await prisma.player.create({ data: { name: 'Home Nine', number: 9, teamId: homeTeamId } })).id;
  awayPlayerId = (await prisma.player.create({ data: { name: 'Away Ten', number: 10, teamId: awayTeamId } })).id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('scorer links: the season manager side', () => {
  it('lets only the season manager hand out a link', async () => {
    const gameId = await newGame();
    const res = await request(app).post(`/api/games/${gameId}/scorer-link`).set(as(teamManagerToken)).send({});
    expect(res.status).toBe(403);
  });

  it('stores only a hash of the token and never shows the address again', async () => {
    const gameId = await newGame();
    const token = await linkFor(gameId, 'Pavel');

    const stored = await prisma.scorerLink.findFirstOrThrow({ where: { gameId } });
    expect(stored.tokenHash).not.toBe(token);
    expect(stored.label).toBe('Pavel');

    const read = await request(app).get(`/api/games/${gameId}/scorer-link`).set(as(leagueManagerToken));
    expect(read.status).toBe(200);
    expect(read.body.supported).toBe(true);
    expect(read.body.link).toEqual(expect.objectContaining({ label: 'Pavel', status: 'ACTIVE' }));
    expect(JSON.stringify(read.body)).not.toContain(token);
  });

  it('cancels the old link when a new one is made, and on request', async () => {
    const gameId = await newGame();
    const first = await linkFor(gameId);
    const second = await linkFor(gameId);

    expect((await goal(first, homeTeamId)).status).toBe(410);
    expect((await goal(second, homeTeamId)).status).toBe(201);

    const revoke = await request(app).delete(`/api/games/${gameId}/scorer-link`).set(as(leagueManagerToken));
    expect(revoke.status).toBe(200);
    const dead = await goal(second, homeTeamId);
    expect(dead.status).toBe(410);
    expect(dead.body.code).toBe('REVOKED');

    const page = await request(app).get(`/api/scorer/${second}`);
    expect(page.status).toBe(200);
    expect(page.body.status).toBe('REVOKED');
    // A dead link names the game, but no longer shows its report or rosters.
    expect(page.body.events).toEqual([]);
    expect(page.body.rosters).toEqual({});
  });

  it('expires two days after the game starts', async () => {
    const gameId = await newGame('2026-04-01T18:00:00.000Z');
    const token = await linkFor(gameId);
    const stored = await prisma.scorerLink.findFirstOrThrow({ where: { gameId, revokedAt: null } });
    // The game is in the past, so the link runs from now.
    expect(stored.expiresAt.getTime()).toBeGreaterThan(Date.now() + 47 * 60 * 60 * 1000);

    await prisma.scorerLink.update({ where: { id: stored.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const res = await goal(token, homeTeamId);
    expect(res.status).toBe(410);
    expect(res.body.code).toBe('EXPIRED');
  });

  it('refuses a sport without a goal report', async () => {
    const league = await request(app).post('/api/leagues').set(as(adminToken))
      .send({ name: `Scorer Volley ${stamp}`, sportType: 'VOLLEYBALL' });
    const season = await request(app).post('/api/seasons').set(as(adminToken))
      .send({ name: `Scorer Volley Season ${stamp}`, leagueId: league.body.id, startDate: '2026-01-01', endDate: '2026-06-30' });
    await prisma.seasonTeam.createMany({
      data: [{ seasonId: season.body.id, teamId: homeTeamId }, { seasonId: season.body.id, teamId: awayTeamId }],
    });
    const gameId = await newGame('2026-04-01T18:00:00.000Z', season.body.id);

    const res = await request(app).post(`/api/games/${gameId}/scorer-link`).set(as(adminToken)).send({});
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SPORT');
  });
});

describe('scorer links: the scorer side', () => {
  it('answers 404 for a token that was never issued', async () => {
    expect((await request(app).get('/api/scorer/not-a-real-token')).status).toBe(404);
    expect((await goal('not-a-real-token', homeTeamId)).status).toBe(404);
  });

  it('records goals for both teams, derives the score and shows the game as live', async () => {
    const gameId = await newGame();
    const token = await linkFor(gameId, 'Rink table');

    const page = await request(app).get(`/api/scorer/${token}`);
    expect(page.status).toBe(200);
    expect(page.body.status).toBe('ACTIVE');
    expect(page.body.block).toBeNull();
    expect(page.body.rosters[homeTeamId]).toEqual([expect.objectContaining({ id: homePlayerId, number: 9 })]);

    const first = await goal(token, homeTeamId, { playerId: homePlayerId, minute: 7 });
    expect(first.status).toBe(201);
    expect(first.body.game).toEqual(expect.objectContaining({ homeScore: 1, awayScore: 0, status: 'IN_PROGRESS' }));
    await goal(token, awayTeamId, { playerId: awayPlayerId, period: 2 });
    const third = await goal(token, homeTeamId);
    expect(third.body.game).toEqual(expect.objectContaining({ homeScore: 2, awayScore: 1 }));
    expect(third.body.events).toHaveLength(3);
    expect(third.body.events.every((e: { mine: boolean }) => e.mine)).toBe(true);

    const stats = await prisma.playerGameStatistic.findMany({ where: { gameId } });
    expect(stats.find(s => s.playerId === homePlayerId)?.goals).toBe(1);

    // The trail names the link, since no account recorded the goal.
    const trail = await prisma.auditLog.findMany({ where: { entityType: 'Game', entityId: gameId, action: 'CREATE' } });
    expect(trail).toHaveLength(3);
    expect(trail[0].actorId).toBeNull();
    expect(trail[0].after).toEqual(expect.objectContaining({ via: 'SCORER_LINK', scorer: 'Rink table' }));
  });

  it('refuses a scorer from the wrong team and a team outside the game', async () => {
    const gameId = await newGame();
    const token = await linkFor(gameId);
    expect((await goal(token, homeTeamId, { playerId: awayPlayerId })).status).toBe(400);

    const other = await request(app).post(`/api/teams/season/${seasonId}`).set(as(adminToken)).send({ name: `Scorer Other ${stamp}` });
    expect((await goal(token, other.body.id)).status).toBe(400);
  });

  it('removes only the goals the link recorded', async () => {
    const gameId = await newGame();
    const token = await linkFor(gameId);

    const managerGoal = await request(app).post(`/api/games/${gameId}/events`).set(as(leagueManagerToken))
      .send({ type: 'GOAL', teamId: awayTeamId, period: 1 });
    expect(managerGoal.status).toBe(201);
    const scored = await goal(token, homeTeamId);
    const mine = scored.body.events.find((e: { mine: boolean }) => e.mine);

    const refused = await request(app).delete(`/api/scorer/${token}/goals/${managerGoal.body.id}`);
    expect(refused.status).toBe(403);

    const removed = await request(app).delete(`/api/scorer/${token}/goals/${mine.id}`);
    expect(removed.status).toBe(200);
    expect(removed.body.game).toEqual(expect.objectContaining({ homeScore: 0, awayScore: 1 }));
  });

  it('reads 0:0 once the last goal is removed', async () => {
    const gameId = await newGame();
    const token = await linkFor(gameId);
    const scored = await goal(token, homeTeamId);
    const removed = await request(app).delete(`/api/scorer/${token}/goals/${scored.body.events[0].id}`);
    expect(removed.body.game).toEqual(expect.objectContaining({ homeScore: 0, awayScore: 0 }));
  });

  it('finishes the game without confirming it, and keeps corrections open', async () => {
    const gameId = await newGame();
    const token = await linkFor(gameId);
    await goal(token, homeTeamId);

    const done = await request(app).post(`/api/scorer/${token}/finish`);
    expect(done.status).toBe(200);
    expect(done.body.game).toEqual(expect.objectContaining({ status: 'COMPLETED', confirmed: false, homeScore: 1 }));

    expect((await goal(token, awayTeamId)).status).toBe(201);

    // Once the season manager confirms, the link writes nothing more.
    await request(app).post(`/api/games/${gameId}/confirm`).set(as(leagueManagerToken));
    const late = await goal(token, awayTeamId);
    expect(late.status).toBe(409);
    expect(late.body.code).toBe('CONFIRMED');
  });

  it('ends a game without goals 0:0', async () => {
    const gameId = await newGame();
    const token = await linkFor(gameId);
    const done = await request(app).post(`/api/scorer/${token}/finish`);
    expect(done.body.game).toEqual(expect.objectContaining({ status: 'COMPLETED', homeScore: 0, awayScore: 0 }));
  });

  it('confirms the game when both teams already reported the score the scorer ends on', async () => {
    const gameId = await newGame();
    await prisma.gameResultClaim.createMany({
      data: [
        { gameId, teamId: homeTeamId, homeScore: 1, awayScore: 0 },
        { gameId, teamId: awayTeamId, homeScore: 1, awayScore: 0 },
      ],
    });
    const token = await linkFor(gameId);
    await goal(token, homeTeamId);

    const done = await request(app).post(`/api/scorer/${token}/finish`);
    expect(done.body.outcome).toBe('CONFIRMED');
    expect(done.body.game.confirmed).toBe(true);
  });

  it('leaves alone a game whose statistics were entered by hand', async () => {
    const gameId = await newGame();
    await prisma.playerGameStatistic.create({ data: { gameId, playerId: homePlayerId, goals: 2 } });
    const token = await linkFor(gameId);

    const page = await request(app).get(`/api/scorer/${token}`);
    expect(page.body.block).toBe('HAND_STATS');
    const res = await goal(token, homeTeamId);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('HAND_STATS');
  });
});
