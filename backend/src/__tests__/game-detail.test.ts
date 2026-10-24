import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import prisma from '../config/database.js';

const stamp = Date.now();
let adminToken: string;
const auth = () => ({ Authorization: `Bearer ${adminToken}` });

let seasonId: string;
let teams: string[];
let players: string[];
let played: string;
let rematch: string;

beforeAll(async () => {
  const email = `admin-gamedetail-${stamp}@test.com`;
  await prisma.user.create({
    data: { email, password: await bcrypt.hash('password123', 10), name: 'Admin', role: 'ADMIN', active: true, emailVerified: true },
  });
  adminToken = (await request(app).post('/api/auth/login').send({ email, password: 'password123' })).body.token;

  const league = await request(app).post('/api/leagues').set(auth()).send({ name: `Detail League ${stamp}`, sportType: 'HOCKEY' });
  const season = await request(app).post('/api/seasons').set(auth())
    .send({ name: `Detail ${stamp}`, leagueId: league.body.id, startDate: '2026-09-01', endDate: '2027-04-30' });
  seasonId = season.body.id;
  await prisma.season.update({ where: { id: seasonId }, data: { visibility: 'PUBLIC' } });

  teams = [];
  players = [];
  for (const name of ['Home', 'Away', 'Other']) {
    const team = await request(app).post(`/api/teams/season/${seasonId}`).set(auth()).send({ name: `${name} ${stamp}` });
    teams.push(team.body.id);
    for (const n of [1, 2]) {
      const player = await request(app).post(`/api/players/team/${team.body.id}`).set(auth()).send({ name: `${name} Player ${n}`, number: n });
      players.push(player.body.id);
    }
  }
  const game = (home: number, away: number, date: string) => request(app).post(`/api/games/season/${seasonId}`).set(auth())
    .send({ homeTeamId: teams[home], awayTeamId: teams[away], round: 1, date });
  played = (await game(0, 1, '2026-10-01T18:00:00Z')).body.id;
  rematch = (await game(1, 0, '2026-11-01T18:00:00Z')).body.id;
  await game(0, 2, '2026-10-08T18:00:00Z');

  // The home side's first player scores, assisted by the second; the away side's second has an empty line.
  await request(app).post(`/api/games/${played}/events`).set(auth())
    .send({ type: 'GOAL', period: 1, minute: 7, teamId: teams[0], playerId: players[0], assistPlayerId: players[1] });
  await request(app).post(`/api/game-statistics/game/${played}`).set(auth()).send({ playerId: players[3] });
  await request(app).put(`/api/games/${played}`).set(auth()).send({ status: 'COMPLETED' });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('the match page', () => {
  it('brings the game, its report, the players and the meetings in one answer', async () => {
    const res = await request(app).get(`/api/games/${played}/detail`);
    expect(res.status).toBe(200);
    expect(res.body.game).toMatchObject({ homeScore: 1, awayScore: 0, status: 'COMPLETED', playoff: false });
    expect(res.body.game.homeTeam).toMatchObject({ id: teams[0] });
    expect(res.body.league.sportType).toBe('HOCKEY');
    expect(res.body.events).toHaveLength(1);
    expect(res.body.events[0]).toMatchObject({ type: 'GOAL', teamId: teams[0], player: { id: players[0] }, assistPlayer: { id: players[1] } });
    // Only lines with a number on them: the empty one stays the team's.
    expect(res.body.players.map((line: { player: { id: string } }) => line.player.id).sort()).toEqual([players[0], players[1]].sort());
    expect(res.body.headToHead.map((meeting: { id: string }) => meeting.id)).toEqual([rematch]);
  });

  it('shows a result waiting for confirmation, and keeps it out of the table', async () => {
    const res = await request(app).get(`/api/games/${played}/detail`);
    expect(res.body.game.confirmed).toBe(false);
    const home = res.body.table.rows.find((row: { team: { id: string } }) => row.team.id === teams[0]);
    expect(home).toMatchObject({ played: 0, awaitingConfirmation: true });

    await request(app).post(`/api/games/${played}/confirm`).set(auth());
    const after = await request(app).get(`/api/games/${played}/detail`);
    expect(after.body.game.confirmed).toBe(true);
    expect(after.body.table.rows[0]).toMatchObject({ team: { id: teams[0] }, played: 1, rank: 1 });
  });

  it('is not there for a visitor of a private season', async () => {
    await prisma.season.update({ where: { id: seasonId }, data: { visibility: 'PRIVATE' } });
    expect((await request(app).get(`/api/games/${played}/detail`)).status).toBe(404);
    expect((await request(app).get(`/api/games/${played}/detail`).set(auth())).status).toBe(200);
    await prisma.season.update({ where: { id: seasonId }, data: { visibility: 'PUBLIC' } });
  });

  it('answers 404 for a game that does not exist', async () => {
    expect((await request(app).get('/api/games/00000000-0000-0000-0000-000000000000/detail')).status).toBe(404);
  });
});
