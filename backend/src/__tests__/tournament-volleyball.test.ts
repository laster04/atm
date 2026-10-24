import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import prisma from '../config/database.js';

const stamp = Date.now();
let adminToken: string;
const auth = () => ({ Authorization: `Bearer ${adminToken}` });

const sets = (...scores: [number, number][]) => scores.map(([home, away]) => ({ home, away }));

/** A volleyball tournament with one group of three, every game scheduled. */
async function build(label: string) {
  const series = await request(app).post('/api/tournaments/series').set(auth())
    .send({ name: `Volley Series ${label} ${stamp}`, sportType: 'VOLLEYBALL' });
  const tournament = await request(app).post(`/api/tournaments/series/${series.body.id}/tournaments`).set(auth())
    .send({ name: `Volley Cup ${label} ${stamp}` });
  const tournamentId = tournament.body.id as string;
  const group = await request(app).post(`/api/tournaments/${tournamentId}/groups`).set(auth()).send({ name: 'A' });
  const teams: string[] = [];
  for (const name of ['One', 'Two', 'Three']) {
    const team = await request(app).post(`/api/tournaments/${tournamentId}/teams`).set(auth()).send({ name: `${name} ${label}` });
    await request(app).post(`/api/tournaments/groups/${group.body.id}/teams`).set(auth()).send({ teamId: team.body.id });
    teams.push(team.body.id);
  }
  const game = async (home: number, away: number) => (await request(app).post(`/api/tournaments/${tournamentId}/games`).set(auth())
    .send({ phase: 'GROUP', groupId: group.body.id, homeTeamId: teams[home], awayTeamId: teams[away] })).body.id as string;
  return { tournamentId, teams, game };
}

const record = (gameId: string, periodScores: { home: number; away: number }[], extra: Record<string, unknown> = {}) =>
  request(app).put(`/api/tournaments/games/${gameId}`).set(auth()).send({ status: 'COMPLETED', periodScores, ...extra });

const table = async (tournamentId: string) => {
  const res = await request(app).get(`/api/tournaments/${tournamentId}/standings`);
  const rows: { teamId: string; points: number; otWins: number; otLosses: number; drawn: number; partPointsFor: number }[] =
    Array.isArray(res.body) ? res.body : res.body.flatMap((group: { standings: unknown[] }) => group.standings);
  return Object.fromEntries(rows.map((row) => [row.teamId, row]));
};

beforeAll(async () => {
  const email = `admin-tvolley-${stamp}@test.com`;
  await prisma.user.create({
    data: { email, password: await bcrypt.hash('password123', 10), name: 'Admin', role: 'ADMIN', active: true, emailVerified: true },
  });
  adminToken = (await request(app).post('/api/auth/login').send({ email, password: 'password123' })).body.token;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('volleyball tournaments', () => {
  it('work the score out from the sets and play to two won sets by default', async () => {
    const built = await build('BestOf3');
    const first = await record(await built.game(0, 1), sets([25, 20], [20, 25], [15, 10]));
    expect(first.status).toBe(200);
    expect([first.body.homeScore, first.body.awayScore]).toEqual([2, 1]);
    expect(first.body.periodScores).toHaveLength(3);
    await record(await built.game(1, 2), sets([25, 20], [25, 20]));

    const rows = await table(built.tournamentId);
    // 2:1 is decided in the third set: two points and one, as 3:2 in a league.
    expect(rows[built.teams[0]]).toMatchObject({ points: 2, otWins: 1, partPointsFor: 60 });
    expect(rows[built.teams[1]]).toMatchObject({ points: 4, otLosses: 1 });
    expect(rows[built.teams[2]]).toMatchObject({ points: 0 });
  });

  it('counts 1:1 as a draw when the tournament plays two fixed sets', async () => {
    const built = await build('TwoSets');
    const format = await request(app).put(`/api/tournaments/${built.tournamentId}`).set(auth())
      .send({ scoring: { setFormat: 'TWO_SETS' } });
    expect(format.status).toBe(200);
    expect(format.body.scoring).toEqual({ setFormat: 'TWO_SETS' });

    await record(await built.game(0, 1), sets([25, 20], [20, 25]));
    const rows = await table(built.tournamentId);
    expect(rows[built.teams[0]]).toMatchObject({ drawn: 1, points: 1, otWins: 0 });
    expect(rows[built.teams[1]]).toMatchObject({ drawn: 1, points: 1 });
  });

  it('refuses a set format it does not know', async () => {
    const built = await build('BadFormat');
    const res = await request(app).put(`/api/tournaments/${built.tournamentId}`).set(auth())
      .send({ scoring: { setFormat: 'BEST_OF_7' } });
    expect(res.status).toBe(400);
  });

  it('wants a winner in a play-off game', async () => {
    const built = await build('Playoff');
    const final = await request(app).post(`/api/tournaments/${built.tournamentId}/games`).set(auth())
      .send({ phase: 'FINAL', homeTeamId: built.teams[0], awayTeamId: built.teams[1] });
    const level = await record(final.body.id, sets([25, 20], [20, 25]));
    expect(level.status).toBe(400);
    expect(level.body.code).toBe('PLAYOFF_NEEDS_WINNER');
    const decided = await record(final.body.id, sets([25, 20], [20, 25], [15, 13]));
    expect(decided.status).toBe(200);
  });
});
