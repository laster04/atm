import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import prisma from '../config/database.js';

const stamp = Date.now();
let adminToken: string;
let strangerToken: string;

const auth = (token = adminToken) => ({ Authorization: `Bearer ${token}` });

async function account(label: string, role: 'ADMIN' | 'USER') {
  const email = `${label}-${stamp}@test.com`;
  await prisma.user.create({
    data: { email, password: await bcrypt.hash('password123', 10), name: label, role, active: true, emailVerified: true },
  });
  const res = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
  return res.body.token as string;
}

interface Built {
  seasonId: string;
  /** Strongest first: team 0 beats everyone, so the table order is the team order. */
  teams: string[];
  /** Regular-season games left unplayed, in creation order. */
  open: string[];
}

/** A season of `count` teams, everyone meeting once; `leaveOpen` games stay unplayed. */
async function buildSeason(label: string, count: number, leaveOpen = 0): Promise<Built> {
  const league = await request(app).post('/api/leagues').set(auth())
    .send({ name: `Playoff League ${label} ${stamp}`, sportType: 'HOCKEY' });
  const season = await request(app).post('/api/seasons').set(auth())
    .send({ name: `Playoff Season ${label} ${stamp}`, leagueId: league.body.id, startDate: '2026-09-01', endDate: '2027-04-30' });
  const seasonId = season.body.id as string;

  const teams: string[] = [];
  for (let i = 0; i < count; i++) {
    const team = await request(app).post(`/api/teams/season/${seasonId}`).set(auth())
      .send({ name: `T${i + 1} ${label} ${stamp}` });
    teams.push(team.body.id);
  }

  const fixtures: string[] = [];
  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      const game = await request(app).post(`/api/games/season/${seasonId}`).set(auth())
        .send({ homeTeamId: teams[i], awayTeamId: teams[j], round: 1 });
      fixtures.push(game.body.id);
    }
  }
  const open = fixtures.slice(fixtures.length - leaveOpen);
  for (const id of fixtures.slice(0, fixtures.length - leaveOpen)) await result(id, 3, 1);
  return { seasonId, teams, open };
}

/** Records a final score and confirms it. */
async function result(gameId: string, homeScore: number, awayScore: number) {
  const saved = await request(app).put(`/api/games/${gameId}`).set(auth())
    .send({ homeScore, awayScore, status: 'COMPLETED' });
  expect(saved.status).toBe(200);
  return request(app).post(`/api/games/${gameId}/confirm`).set(auth());
}

const createPlayoff = (seasonId: string, body: object, token = adminToken) =>
  request(app).post(`/api/seasons/${seasonId}/playoff`).set(auth(token)).send(body);

const seriesOf = (seasonId: string) =>
  prisma.playoffSeries.findMany({
    where: { seasonId },
    include: { games: { orderBy: { createdAt: 'asc' } } },
    orderBy: [{ round: 'asc' }, { slot: 'asc' }],
  });

const find = async (seasonId: string, round: string, slot: number) =>
  (await seriesOf(seasonId)).find(s => s.round === round && s.slot === slot)!;

/** Plays a game of a series so that `winnerId` takes it. */
async function win(game: { id: string; homeTeamId: string }, winnerId: string) {
  const res = game.homeTeamId === winnerId ? await result(game.id, 4, 2) : await result(game.id, 2, 4);
  expect(res.status).toBe(200);
}

const SERIES = { QUARTER_FINAL: 3, SEMI_FINAL: 3, FINAL: 3, BRONZE: 1 };

beforeAll(async () => {
  adminToken = await account('admin-splayoff', 'ADMIN');
  strangerToken = await account('stranger-splayoff', 'USER');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('a season play-off', () => {
  let built: Built;

  beforeAll(async () => {
    built = await buildSeason('main', 6, 1);
  });

  it('is drawn mid-season as seeds, with byes for the top two', async () => {
    const res = await createPlayoff(built.seasonId, { qualifiers: 6, bestOf: SERIES, bronze: true });
    expect(res.status).toBe(201);
    expect(res.body.seedsResolved).toBe(false);
    expect(res.body.bracketSize).toBe(8);

    const series = await seriesOf(built.seasonId);
    const quarters = series.filter(s => s.round === 'QUARTER_FINAL');
    expect(quarters.map(s => [s.homeSeed, s.awaySeed])).toEqual([[4, 5], [3, 6]]);
    expect(series.filter(s => s.round === 'SEMI_FINAL').map(s => [s.homeSeed, s.awaySeed])).toEqual([[1, null], [2, null]]);
    expect(series.some(s => s.round === 'BRONZE')).toBe(true);
    expect(series.every(s => s.homeTeamId === null && s.games.length === 0)).toBe(true);
  });

  it('fills in the teams and the first games once the regular season is settled', async () => {
    const res = await result(built.open[0], 3, 1);
    expect(res.status).toBe(200);

    const [t1, t2, t3, t4, t5, t6] = built.teams;
    const q0 = await find(built.seasonId, 'QUARTER_FINAL', 1);
    expect([q0.homeTeamId, q0.awayTeamId]).toEqual([t4, t5]);
    // Best of three: two games straight away, the third only if needed.
    expect(q0.games).toHaveLength(2);
    expect(q0.games.map(g => g.homeTeamId)).toEqual([t4, t5]);

    const q1 = await find(built.seasonId, 'QUARTER_FINAL', 3);
    expect([q1.homeTeamId, q1.awayTeamId]).toEqual([t3, t6]);

    const s0 = await find(built.seasonId, 'SEMI_FINAL', 0);
    const s1 = await find(built.seasonId, 'SEMI_FINAL', 1);
    expect([s0.homeTeamId, s0.awayTeamId]).toEqual([t1, null]);
    expect([s1.homeTeamId, s1.awayTeamId]).toEqual([t2, null]);
  });

  it('keeps play-off games out of the table', async () => {
    const standings = await request(app).get(`/api/seasons/${built.seasonId}/standings`);
    expect(standings.status).toBe(200);
    expect(standings.body.every((row: { played: number }) => row.played === 5)).toBe(true);
  });

  it('refuses to confirm a drawn play-off game', async () => {
    const q0 = await find(built.seasonId, 'QUARTER_FINAL', 1);
    const res = await result(q0.games[0].id, 2, 2);
    expect(res.status).toBe(400);
    // Put it back to unplayed for the next steps.
    await request(app).put(`/api/games/${q0.games[0].id}`).set(auth())
      .send({ homeScore: null, awayScore: null, status: 'SCHEDULED' });
  });

  it('adds a deciding game at 1-1 and moves the winner on', async () => {
    const [, , , t4, t5] = built.teams;
    let q0 = await find(built.seasonId, 'QUARTER_FINAL', 1);
    await win(q0.games[0], t4);
    await win(q0.games[1], t5);

    q0 = await find(built.seasonId, 'QUARTER_FINAL', 1);
    expect(q0.games).toHaveLength(3);
    expect(q0.games[2].homeTeamId).toBe(t4);

    await win(q0.games[2], t5);
    q0 = await find(built.seasonId, 'QUARTER_FINAL', 1);
    expect(q0.winnerTeamId).toBe(t5);

    const s0 = await find(built.seasonId, 'SEMI_FINAL', 0);
    expect(s0.awayTeamId).toBe(t5);
    expect(s0.games).toHaveLength(2);
  });

  it('settles a 2-0 series in two games', async () => {
    const [, , t3] = built.teams;
    let q1 = await find(built.seasonId, 'QUARTER_FINAL', 3);
    await win(q1.games[0], t3);
    await win(q1.games[1], t3);

    q1 = await find(built.seasonId, 'QUARTER_FINAL', 3);
    expect(q1.winnerTeamId).toBe(t3);
    expect(q1.games).toHaveLength(2);
    expect((await find(built.seasonId, 'SEMI_FINAL', 1)).awayTeamId).toBe(t3);
  });

  it('will not reopen a game once the next round has a confirmed result', async () => {
    const [, t2] = built.teams;
    const s1 = await find(built.seasonId, 'SEMI_FINAL', 1);
    await win(s1.games[0], t2);

    const q1 = await find(built.seasonId, 'QUARTER_FINAL', 3);
    const res = await request(app).post(`/api/games/${q1.games[0].id}/reopen`).set(auth())
      .send({ reason: 'Wrong score entered' });
    expect(res.status).toBe(409);
  });

  it('sends the semi-final loser to the bronze game', async () => {
    const [t1, t2, t3, , t5] = built.teams;
    let s1 = await find(built.seasonId, 'SEMI_FINAL', 1);
    await win(s1.games[1], t2);
    const s0 = await find(built.seasonId, 'SEMI_FINAL', 0);
    await win(s0.games[0], t1);
    await win(s0.games[1], t1);

    s1 = await find(built.seasonId, 'SEMI_FINAL', 1);
    const final = await find(built.seasonId, 'FINAL', 0);
    const bronze = await find(built.seasonId, 'BRONZE', 0);
    expect(s1.winnerTeamId).toBe(t2);
    expect([final.homeTeamId, final.awayTeamId]).toEqual([t1, t2]);
    expect([bronze.homeTeamId, bronze.awayTeamId]).toEqual([t5, t3]);
    expect(bronze.games).toHaveLength(1);
  });

  it('serves the bracket publicly with series scores', async () => {
    const res = await request(app).get(`/api/seasons/${built.seasonId}/playoff`);
    expect(res.status).toBe(200);
    const quarter = res.body.series.find((s: { round: string; slot: number }) => s.round === 'QUARTER_FINAL' && s.slot === 1);
    expect([quarter.homeWins, quarter.awayWins]).toEqual([1, 2]);
    expect(quarter.homeTeam.name).toMatch(/^T4 /);
  });

  it('stops a new schedule and a delete once results are in', async () => {
    const schedule = await request(app).post(`/api/games/season/${built.seasonId}/generate`).set(auth()).send({ rounds: 1 });
    expect(schedule.status).toBe(409);
    const del = await request(app).delete(`/api/seasons/${built.seasonId}/playoff`).set(auth());
    expect(del.status).toBe(409);
  });

  it('cannot be drawn twice', async () => {
    expect((await createPlayoff(built.seasonId, { qualifiers: 4 })).status).toBe(409);
  });
});

describe('creating and removing a play-off', () => {
  it('starts at once when the regular season is over, and can be deleted before a result', async () => {
    const built = await buildSeason('done', 4);
    const res = await createPlayoff(built.seasonId, { qualifiers: 4, bronze: false });
    expect(res.status).toBe(201);
    expect(res.body.seedsResolved).toBe(true);

    const semis = (await seriesOf(built.seasonId)).filter(s => s.round === 'SEMI_FINAL');
    expect(semis.map(s => [s.homeTeamId, s.awayTeamId])).toEqual([
      [built.teams[0], built.teams[3]],
      [built.teams[1], built.teams[2]],
    ]);
    // Best of one by default.
    expect(semis.every(s => s.bestOf === 1 && s.games.length === 1)).toBe(true);

    const del = await request(app).delete(`/api/seasons/${built.seasonId}/playoff`).set(auth());
    expect(del.status).toBe(200);
    expect(await prisma.game.count({ where: { seasonId: built.seasonId, playoffSeriesId: { not: null } } })).toBe(0);
    expect(await prisma.playoffSeries.count({ where: { seasonId: built.seasonId } })).toBe(0);
  });

  it('rejects a bad request and an outsider', async () => {
    const built = await buildSeason('bad', 3);
    expect((await createPlayoff(built.seasonId, { qualifiers: 4 })).status).toBe(400);
    expect((await createPlayoff(built.seasonId, { qualifiers: 1 })).status).toBe(400);
    expect((await createPlayoff(built.seasonId, { qualifiers: 2, bestOf: { FINAL: 2 } })).status).toBe(400);
    expect((await createPlayoff(built.seasonId, { qualifiers: 2 }, strangerToken)).status).toBe(403);
  });
});
