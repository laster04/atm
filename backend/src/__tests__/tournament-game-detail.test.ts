import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import prisma from '../config/database.js';

const stamp = Date.now();
let token: string;
const auth = () => ({ Authorization: `Bearer ${token}` });

let tournamentId: string;
let seriesId: string;
let teams: string[];
let groupGame: string;
let semi: string;

beforeAll(async () => {
  const email = `organiser-tgdetail-${stamp}@test.com`;
  await prisma.user.create({ data: { email, password: await bcrypt.hash('password123', 10), name: 'Organiser', active: true, emailVerified: true } });
  token = (await request(app).post('/api/auth/login').send({ email, password: 'password123' })).body.token;

  const series = await request(app).post('/api/tournaments/series').set(auth()).send({ name: `Detail Series ${stamp}`, sportType: 'FLOORBALL' });
  seriesId = series.body.id;
  const tournament = await request(app).post(`/api/tournaments/series/${seriesId}/tournaments`).set(auth()).send({ name: `Detail Cup ${stamp}` });
  tournamentId = tournament.body.id;
  const group = await request(app).post(`/api/tournaments/${tournamentId}/groups`).set(auth()).send({ name: 'A' });
  teams = [];
  for (const name of ['Lvi', 'Vlci', 'Medvedi']) {
    const team = await request(app).post(`/api/tournaments/${tournamentId}/teams`).set(auth()).send({ name: `${name} ${stamp}` });
    await request(app).post(`/api/tournaments/groups/${group.body.id}/teams`).set(auth()).send({ teamId: team.body.id });
    teams.push(team.body.id);
  }
  const create = async (body: Record<string, unknown>) => (await request(app).post(`/api/tournaments/${tournamentId}/games`).set(auth()).send(body)).body.id as string;
  groupGame = await create({ phase: 'GROUP', groupId: group.body.id, homeTeamId: teams[0], awayTeamId: teams[1] });
  await request(app).put(`/api/tournaments/games/${groupGame}`).set(auth()).send({ homeScore: 3, awayScore: 1, status: 'COMPLETED' });

  const player = await prisma.tournamentPlayer.create({ data: { name: 'Jan Lev', number: 9, teamId: teams[0] } });
  const bench = await prisma.tournamentPlayer.create({ data: { name: 'Petr Vlk', teamId: teams[1] } });
  await prisma.tournamentGameStatistic.createMany({
    data: [{ gameId: groupGame, playerId: player.id, goals: 2, assists: 1 }, { gameId: groupGame, playerId: bench.id, goals: 0, assists: 0 }],
  });

  semi = await create({ phase: 'SEMI_FINAL', bracketSlot: 0, homeTeamId: teams[0], awayTeamId: teams[1] });
  await create({ phase: 'FINAL', bracketSlot: 0, awayTeamId: teams[2] });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('the tournament match page', () => {
  it('shows a group game with its players and the group table', async () => {
    const res = await request(app).get(`/api/tournaments/games/${groupGame}/detail`);
    expect(res.status).toBe(200);
    expect(res.body.game).toMatchObject({ phase: 'GROUP', homeScore: 3, awayScore: 1, group: { name: 'A' } });
    expect(res.body.series.sportType).toBe('FLOORBALL');
    expect(res.body.players).toEqual([expect.objectContaining({ teamId: teams[0], goals: 2, assists: 1 })]);
    expect(res.body.table.rows[0]).toMatchObject({ teamId: teams[0], points: expect.any(Number) });
    expect(res.body.next).toBeNull();
    expect(res.body.meetings.map((m: { id: string }) => m.id)).toEqual([semi]);
    expect(res.body.branding).toBe('FULL');
  });

  it('tells where a play-off winner goes and who waits there', async () => {
    const res = await request(app).get(`/api/tournaments/games/${semi}/detail`);
    expect(res.body.table).toBeNull();
    expect(res.body.next).toMatchObject({ phase: 'FINAL', opponent: { id: teams[2] } });
  });

  it('is hidden with a private series', async () => {
    await prisma.tournamentSeries.update({ where: { id: seriesId }, data: { visibility: 'PRIVATE' } });
    expect((await request(app).get(`/api/tournaments/games/${groupGame}/detail`)).status).toBe(404);
    expect((await request(app).get(`/api/tournaments/games/${groupGame}/detail`).set(auth())).status).toBe(200);
  });
});
