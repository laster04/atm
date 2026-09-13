import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import prisma from '../config/database.js';
import { Standing } from '../types/index.js';

const stamp = Date.now();

let token: string;
let seasonId: string;
const teams: Record<string, string> = {};

const auth = () => ({ Authorization: `Bearer ${token}` });

const table = async (): Promise<Standing[]> =>
  (await request(app).get(`/api/seasons/${seasonId}/standings`)).body;

const rowFor = (rows: Standing[], name: string) => rows.find((row) => row.team.name === name)!;

async function playGame(home: string, away: string, homeScore: number, awayScore: number) {
  const game = await request(app).post(`/api/games/season/${seasonId}`).set(auth())
    .send({ homeTeamId: teams[home], awayTeamId: teams[away] });
  await request(app).put(`/api/games/${game.body.id}`).set(auth())
    .send({ homeScore, awayScore, status: 'COMPLETED' });
  return game.body.id as string;
}

beforeAll(async () => {
  const email = `admin-live-${stamp}@test.com`;
  await prisma.user.create({
    data: {
      email,
      password: await bcrypt.hash('password123', 10),
      name: 'Live Admin',
      role: 'ADMIN',
      active: true,
      emailVerified: true,
    },
  });
  token = (await request(app).post('/api/auth/login').send({ email, password: 'password123' })).body.token;

  const league = await request(app).post('/api/leagues').set(auth())
    .send({ name: `Live League ${stamp}`, sportType: 'HOCKEY' });
  const season = await request(app).post('/api/seasons').set(auth())
    .send({ name: `Live Season ${stamp}`, leagueId: league.body.id, startDate: '2026-01-01', endDate: '2027-12-31' });
  seasonId = season.body.id;

  for (const name of ['Alpha', 'Bravo', 'Charlie', 'Delta']) {
    const res = await request(app).post(`/api/teams/season/${seasonId}`).set(auth())
      .send({ name: `${name} ${stamp}` });
    teams[name] = res.body.id;
  }

  // Settled table, on the league default of 2 points a win:
  //   Alpha 4, Bravo 2, Charlie 2, Delta 0
  await playGame('Alpha', 'Delta', 3, 0);
  await playGame('Alpha', 'Charlie', 1, 0);
  await playGame('Bravo', 'Delta', 2, 1);
  await playGame('Charlie', 'Bravo', 5, 4);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('a settled table', () => {
  it('ranks every team and projects nothing', async () => {
    const rows = await table();
    expect(rows.map((row) => row.rank)).toEqual([1, 2, 3, 4]);
    expect(rows.every((row) => row.live === null)).toBe(true);
    expect(rows.every((row) => row.inPlay === false)).toBe(true);
  });
});

describe('while a game is being played', () => {
  let liveGameId: string;

  beforeAll(async () => {
    // Official table: Alpha 4, Bravo 2 (GF 6), Charlie 2 (GF 5), Delta 0.
    // Charlie is third only on goals scored, so beating Delta takes them to 4
    // points and past Bravo, who are not playing.
    const game = await request(app).post(`/api/games/season/${seasonId}`).set(auth())
      .send({ homeTeamId: teams.Charlie, awayTeamId: teams.Delta });
    liveGameId = game.body.id;
    await request(app).put(`/api/games/${liveGameId}`).set(auth())
      .send({ homeScore: 3, awayScore: 0, status: 'IN_PROGRESS' });
  });

  it('leaves the official table untouched', async () => {
    const rows = await table();
    const charlie = rowFor(rows, `Charlie ${stamp}`);
    expect(charlie.points).toBe(2);
    expect(charlie.played).toBe(2);
    expect(charlie.rank).toBe(3);
  });

  it('marks the teams that are playing', async () => {
    const rows = await table();
    expect(rowFor(rows, `Charlie ${stamp}`).inPlay).toBe(true);
    expect(rowFor(rows, `Delta ${stamp}`).inPlay).toBe(true);
    expect(rowFor(rows, `Bravo ${stamp}`).inPlay).toBe(false);
  });

  it('projects where the winner would climb to', async () => {
    const rows = await table();
    const charlie = rowFor(rows, `Charlie ${stamp}`);
    expect(charlie.live).not.toBeNull();
    expect(charlie.live!.points).toBe(4);
    expect(charlie.live!.rank).toBe(2);
    expect(charlie.live!.movement).toBe(1);
  });

  it('projects a team being overtaken without playing at all', async () => {
    const rows = await table();
    const bravo = rowFor(rows, `Bravo ${stamp}`);
    // Bravo are not on the ice, but Charlie passing them pushes them down.
    expect(bravo.inPlay).toBe(false);
    expect(bravo.live!.movement).toBe(-1);
    expect(bravo.live!.points).toBe(bravo.points);
  });

  it('follows the score as it changes', async () => {
    await request(app).put(`/api/games/${liveGameId}`).set(auth())
      .send({ homeScore: 0, awayScore: 3 });

    const rows = await table();
    // Delta in front now: they climb off the bottom and Charlie drop instead.
    expect(rowFor(rows, `Delta ${stamp}`).live!.movement).toBeGreaterThan(0);
    expect(rowFor(rows, `Charlie ${stamp}`).live!.movement).toBeLessThan(0);
  });

  it('ignores a game in progress with nothing on the scoreboard', async () => {
    await request(app).put(`/api/games/${liveGameId}`).set(auth())
      .send({ homeScore: null, awayScore: null });

    const rows = await table();
    // Nothing scored says nothing about the finish, so it must not be counted
    // as a goalless draw that hands both sides a point.
    expect(rows.every((row) => row.live === null)).toBe(true);
    expect(rows.every((row) => row.inPlay === false)).toBe(true);
  });

  it('stops projecting once the game is finished', async () => {
    await request(app).put(`/api/games/${liveGameId}`).set(auth())
      .send({ homeScore: 3, awayScore: 0, status: 'COMPLETED' });

    const rows = await table();
    expect(rows.every((row) => row.live === null)).toBe(true);
    // ...and the result it was projecting is now simply the table.
    expect(rowFor(rows, `Charlie ${stamp}`).points).toBe(4);
    expect(rowFor(rows, `Charlie ${stamp}`).rank).toBe(2);
  });
});
