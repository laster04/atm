import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import prisma from '../config/database.js';

const stamp = Date.now();

let adminToken: string;
let homeToken: string;
let awayToken: string;
let seasonId: string;
let homeTeamId: string;
let awayTeamId: string;

const as = (token: string) => ({ Authorization: `Bearer ${token}` });

async function userToken(label: string, role: 'ADMIN' | 'USER' = 'USER'): Promise<{ id: string; token: string }> {
  const email = `claims-${label}-${stamp}@test.com`;
  const user = await prisma.user.create({
    data: {
      email,
      password: await bcrypt.hash('password123', 10),
      name: `Claims ${label}`,
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

const claim = (gameId: string, teamId: string, token: string, homeScore: number, awayScore: number) =>
  request(app).put(`/api/games/${gameId}/result-claims/${teamId}`).set(as(token)).send({ homeScore, awayScore });

beforeAll(async () => {
  adminToken = (await userToken('admin', 'ADMIN')).token;
  const homeManager = await userToken('home');
  const awayManager = await userToken('away');
  homeToken = homeManager.token;
  awayToken = awayManager.token;

  const league = await request(app).post('/api/leagues').set(as(adminToken))
    .send({ name: `Claims League ${stamp}`, sportType: 'HOCKEY' });
  const season = await request(app).post('/api/seasons').set(as(adminToken))
    .send({ name: `Claims Season ${stamp}`, leagueId: league.body.id, startDate: '2026-01-01', endDate: '2026-06-30' });
  seasonId = season.body.id;

  const home = await request(app).post(`/api/teams/season/${seasonId}`).set(as(adminToken))
    .send({ name: `Claims Home ${stamp}` });
  homeTeamId = home.body.id;
  const away = await request(app).post(`/api/teams/season/${seasonId}`).set(as(adminToken))
    .send({ name: `Claims Away ${stamp}` });
  awayTeamId = away.body.id;

  await prisma.team.update({ where: { id: homeTeamId }, data: { managerId: homeManager.id } });
  await prisma.team.update({ where: { id: awayTeamId }, data: { managerId: awayManager.id } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('teams reporting the result of a game', () => {
  it('confirms the game once both teams report the same score', async () => {
    const gameId = await newGame();

    const first = await claim(gameId, homeTeamId, homeToken, 4, 2);
    expect(first.status).toBe(200);
    expect(first.body.outcome).toBe('WAITING');

    // The other side learns that a score is in, but not what it is.
    const peek = await request(app).get(`/api/games/${gameId}/result-claims`).set(as(awayToken));
    expect(peek.status).toBe(200);
    expect(peek.body.claims).toEqual([
      expect.objectContaining({ teamId: homeTeamId, submitted: true, homeScore: null, awayScore: null }),
    ]);

    const second = await claim(gameId, awayTeamId, awayToken, 4, 2);
    expect(second.status).toBe(200);
    expect(second.body.outcome).toBe('CONFIRMED');

    const game = await prisma.game.findUniqueOrThrow({ where: { id: gameId } });
    expect(game.status).toBe('COMPLETED');
    expect(game.homeScore).toBe(4);
    expect(game.awayScore).toBe(2);
    expect(game.confirmedAt).not.toBeNull();

    const trail = await prisma.auditLog.findMany({ where: { entityType: 'Game', entityId: gameId } });
    expect(trail.map(entry => entry.action)).toContain('AUTO_CONFIRM');

    // A confirmed game takes no more claims until it is reopened.
    const late = await claim(gameId, homeTeamId, homeToken, 5, 2);
    expect(late.status).toBe(409);
    expect(late.body.block).toBe('CONFIRMED');
  });

  it('leaves the game open when the scores differ, until one side corrects it', async () => {
    const gameId = await newGame();

    await claim(gameId, homeTeamId, homeToken, 3, 1);
    const differ = await claim(gameId, awayTeamId, awayToken, 3, 2);
    expect(differ.body.outcome).toBe('DISAGREE');
    // Both scores are now shown to both sides, so a typo can be spotted.
    expect(differ.body.claims).toHaveLength(2);
    expect(differ.body.claims.every((c: { homeScore: number | null }) => c.homeScore !== null)).toBe(true);

    let game = await prisma.game.findUniqueOrThrow({ where: { id: gameId } });
    expect(game.confirmedAt).toBeNull();
    expect(game.homeScore).toBeNull();

    const fixed = await claim(gameId, awayTeamId, awayToken, 3, 1);
    expect(fixed.body.outcome).toBe('CONFIRMED');
    game = await prisma.game.findUniqueOrThrow({ where: { id: gameId } });
    expect(game.confirmedAt).not.toBeNull();
  });

  it('lets a team report only for itself', async () => {
    const gameId = await newGame();
    const res = await claim(gameId, awayTeamId, homeToken, 1, 0);
    expect(res.status).toBe(403);
  });

  it('refuses a result for a game that has not started', async () => {
    const gameId = await newGame('2099-01-01T18:00:00.000Z');
    const res = await claim(gameId, homeTeamId, homeToken, 1, 0);
    expect(res.status).toBe(409);
    expect(res.body.block).toBe('NOT_PLAYED_YET');
  });

  it('refuses a score that is not a whole number from 0', async () => {
    const gameId = await newGame();
    const res = await claim(gameId, homeTeamId, homeToken, -1, 0);
    expect(res.status).toBe(400);
  });

  it('does not overwrite a different score already on the game', async () => {
    const gameId = await newGame();
    await request(app).put(`/api/games/${gameId}`).set(as(adminToken))
      .send({ homeScore: 2, awayScore: 2, status: 'COMPLETED' });

    await claim(gameId, homeTeamId, homeToken, 3, 2);
    const res = await claim(gameId, awayTeamId, awayToken, 3, 2);
    expect(res.body.outcome).toBe('CONFLICTS_WITH_GAME');

    const game = await prisma.game.findUniqueOrThrow({ where: { id: gameId } });
    expect(game.homeScore).toBe(2);
    expect(game.confirmedAt).toBeNull();
  });

  it('only records agreement when the season leaves confirming to its manager', async () => {
    const off = await request(app).put(`/api/seasons/${seasonId}`).set(as(adminToken))
      .send({ autoConfirmAgreed: false });
    expect(off.status).toBe(200);
    expect(off.body.autoConfirmAgreed).toBe(false);

    try {
      const gameId = await newGame();
      await claim(gameId, homeTeamId, homeToken, 1, 0);
      const res = await claim(gameId, awayTeamId, awayToken, 1, 0);
      expect(res.body.outcome).toBe('AGREED');

      const game = await prisma.game.findUniqueOrThrow({ where: { id: gameId } });
      expect(game.confirmedAt).toBeNull();

      // The season manager sees the agreement in the season's list.
      const list = await request(app).get(`/api/games/season/${seasonId}/result-claims`).set(as(adminToken));
      expect(list.status).toBe(200);
      expect(list.body).toEqual(expect.arrayContaining([
        expect.objectContaining({ gameId, state: 'AGREED' }),
      ]));
    } finally {
      await request(app).put(`/api/seasons/${seasonId}`).set(as(adminToken)).send({ autoConfirmAgreed: true });
    }
  });

  it('keeps the season list to the season manager', async () => {
    const res = await request(app).get(`/api/games/season/${seasonId}/result-claims`).set(as(homeToken));
    expect(res.status).toBe(403);
  });

  it('does not take claims in volleyball, whose table needs sets', async () => {
    const league = await request(app).post('/api/leagues').set(as(adminToken))
      .send({ name: `Claims Volley ${stamp}`, sportType: 'VOLLEYBALL' });
    const season = await request(app).post('/api/seasons').set(as(adminToken))
      .send({ name: `Claims Volley Season ${stamp}`, leagueId: league.body.id, startDate: '2026-01-01', endDate: '2026-06-30' });
    await prisma.seasonTeam.createMany({
      data: [{ seasonId: season.body.id, teamId: homeTeamId }, { seasonId: season.body.id, teamId: awayTeamId }],
    });
    const gameId = await newGame('2026-04-01T18:00:00.000Z', season.body.id);

    const res = await claim(gameId, homeTeamId, homeToken, 3, 1);
    expect(res.status).toBe(409);
    expect(res.body.block).toBe('SPORT');
  });
});
