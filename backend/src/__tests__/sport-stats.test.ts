import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import prisma from '../config/database.js';
import { checkParts, checkStats, decidedAfterRegulation, partsWon, profileFor } from '../services/sports/profile.js';

const stamp = Date.now();
let adminToken: string;

const auth = () => ({ Authorization: `Bearer ${adminToken}` });

interface Built {
  seasonId: string;
  teams: string[];
  players: string[];
  gameId: string;
}

/** A league of `sport` with two teams, one player each, and one game between them. */
async function build(sport: string, label: string): Promise<Built> {
  const league = await request(app).post('/api/leagues').set(auth())
    .send({ name: `${label} League ${stamp}`, sportType: sport });
  const season = await request(app).post('/api/seasons').set(auth())
    .send({ name: `${label} ${stamp}`, leagueId: league.body.id, startDate: '2027-04-01', endDate: '2027-08-31' });
  const seasonId = season.body.id as string;

  const teams: string[] = [];
  const players: string[] = [];
  for (const side of ['Home', 'Away']) {
    const team = await request(app).post(`/api/teams/season/${seasonId}`).set(auth())
      .send({ name: `${label} ${side} ${stamp}` });
    teams.push(team.body.id);
    const player = await request(app).post(`/api/players/team/${team.body.id}`).set(auth())
      .send({ name: `${label} ${side} Player`, number: 7 });
    players.push(player.body.id);
  }
  const game = await request(app).post(`/api/games/season/${seasonId}`).set(auth())
    .send({ homeTeamId: teams[0], awayTeamId: teams[1], round: 1, date: '2027-04-10T17:00:00Z' });
  return { seasonId, teams, players, gameId: game.body.id };
}

beforeAll(async () => {
  const email = `admin-sportstats-${stamp}@test.com`;
  await prisma.user.create({
    data: { email, password: await bcrypt.hash('password123', 10), name: 'Admin', role: 'ADMIN', active: true, emailVerified: true },
  });
  const res = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
  adminToken = res.body.token;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('sport profiles', () => {
  it('splits a game the way the sport does', () => {
    expect(profileFor('FOOTBALL').parts).toMatchObject({ kind: 'HALF', regulation: 2 });
    expect(profileFor('BASKETBALL').parts).toMatchObject({ kind: 'QUARTER', regulation: 4 });
    expect(profileFor('VOLLEYBALL').parts).toMatchObject({ kind: 'SET', max: 5 });
    expect(profileFor('FLOORBALL')).toBe(profileFor('HOCKEY'));
  });

  it('checks part scores', () => {
    const volleyball = profileFor('VOLLEYBALL');
    expect(checkParts(undefined, volleyball)).toEqual({ ok: true, value: undefined });
    expect(checkParts([], volleyball)).toEqual({ ok: true, value: null });
    expect(checkParts([{ home: 25, away: 20 }], volleyball)).toEqual({ ok: true, value: [{ home: 25, away: 20 }] });
    expect(checkParts(Array(6).fill({ home: 25, away: 20 }), volleyball).ok).toBe(false);
    expect(checkParts([{ home: -1, away: 2 }], volleyball).ok).toBe(false);
    expect(checkParts([{ home: '1', away: 2 }], volleyball).ok).toBe(false);
  });

  it('counts sets won and spots a fifth set', () => {
    const sets = [{ home: 25, away: 20 }, { home: 22, away: 25 }, { home: 25, away: 18 }, { home: 25, away: 23 }];
    expect(partsWon(sets)).toEqual({ home: 3, away: 1 });
    const volleyball = profileFor('VOLLEYBALL');
    expect(decidedAfterRegulation(sets, volleyball)).toBe(false);
    expect(decidedAfterRegulation([...sets, { home: 15, away: 12 }], volleyball)).toBe(true);
  });

  it('keeps only the numbers a sport records', () => {
    expect(checkStats({ yellowCards: 1, goals: 2 }, profileFor('FOOTBALL'))).toEqual({ ok: true, value: { yellowCards: 1, goals: 2 } });
    expect(checkStats({ yellowCards: 1 }, profileFor('HOCKEY')).ok).toBe(false);
    expect(checkStats({ points: 12, fouls: 3 }, profileFor('BASKETBALL')).ok).toBe(true);
    expect(checkStats({ goals: 1 }, profileFor('VOLLEYBALL')).ok).toBe(false);
    expect(checkStats({ points: -2 }, profileFor('BASKETBALL')).ok).toBe(false);
  });
});

describe('football', () => {
  let built: Built;
  beforeAll(async () => {
    built = await build('FOOTBALL', 'Football');
  });

  it('takes cards on a player line and refuses penalty minutes', async () => {
    const ok = await request(app).post(`/api/game-statistics/game/${built.gameId}`).set(auth())
      .send({ playerId: built.players[0], goals: 1, yellowCards: 1 });
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ goals: 1, yellowCards: 1, penaltyMinutes: null });

    const bad = await request(app).post(`/api/game-statistics/game/${built.gameId}`).set(auth())
      .send({ playerId: built.players[1], penaltyMinutes: 2 });
    expect(bad.status).toBe(400);

    await prisma.playerGameStatistic.deleteMany({ where: { gameId: built.gameId } });
  });

  it('records a card in the match report and halves in the score', async () => {
    const goal = await request(app).post(`/api/games/${built.gameId}/events`).set(auth())
      .send({ type: 'GOAL', teamId: built.teams[0], period: 2, playerId: built.players[0] });
    expect(goal.status).toBe(201);
    const card = await request(app).post(`/api/games/${built.gameId}/events`).set(auth())
      .send({ type: 'CARD', cardColor: 'RED', teamId: built.teams[1], period: 1, playerId: built.players[1] });
    expect(card.status).toBe(201);
    const penalty = await request(app).post(`/api/games/${built.gameId}/events`).set(auth())
      .send({ type: 'PENALTY', teamId: built.teams[1], period: 1, playerId: built.players[1], penaltyMinutes: 2 });
    expect(penalty.status).toBe(400);
    const colourless = await request(app).post(`/api/games/${built.gameId}/events`).set(auth())
      .send({ type: 'CARD', teamId: built.teams[1], period: 1 });
    expect(colourless.status).toBe(400);

    const game = await request(app).get(`/api/games/${built.gameId}`);
    expect(game.body.periodScores).toEqual([{ home: 0, away: 0 }, { home: 1, away: 0 }]);

    const line = await prisma.playerGameStatistic.findFirst({ where: { gameId: built.gameId, playerId: built.players[1] } });
    expect(line).toMatchObject({ redCards: 1, yellowCards: 0, penaltyMinutes: null });
  });

  it('ranks football scorers by goals', async () => {
    const top = await request(app).get(`/api/game-statistics/season/${built.seasonId}/top`);
    expect(top.status).toBe(200);
    expect(top.body[0]).toMatchObject({ goals: 1, rankTotal: 1 });
  });
});

describe('basketball', () => {
  it('keeps points and fouls, has no match report, ranks by points', async () => {
    const built = await build('BASKETBALL', 'Basket');
    const line = await request(app).post(`/api/game-statistics/game/${built.gameId}`).set(auth())
      .send({ playerId: built.players[0], points: 21, fouls: 3 });
    expect(line.status).toBe(201);
    await request(app).post(`/api/game-statistics/game/${built.gameId}`).set(auth())
      .send({ playerId: built.players[1], points: 9, fouls: 5 });

    const event = await request(app).post(`/api/games/${built.gameId}/events`).set(auth())
      .send({ type: 'GOAL', teamId: built.teams[0] });
    expect(event.status).toBe(409);

    const quarters = await request(app).put(`/api/games/${built.gameId}`).set(auth())
      .send({ homeScore: 80, awayScore: 72, status: 'COMPLETED', periodScores: [
        { home: 20, away: 18 }, { home: 20, away: 18 }, { home: 20, away: 18 }, { home: 20, away: 18 },
      ] });
    expect(quarters.status).toBe(200);
    expect(quarters.body.periodScores).toHaveLength(4);

    const top = await request(app).get(`/api/game-statistics/season/${built.seasonId}/top`);
    expect(top.body.map((row: { points: number; rankTotal: number }) => [row.points, row.rankTotal])).toEqual([[21, 21], [9, 9]]);
  });
});

describe('volleyball', () => {
  it('works the result out from the sets', async () => {
    const built = await build('VOLLEYBALL', 'Volley');
    const res = await request(app).put(`/api/games/${built.gameId}`).set(auth())
      .send({ status: 'COMPLETED', periodScores: [
        { home: 25, away: 20 }, { home: 22, away: 25 }, { home: 25, away: 18 }, { home: 25, away: 23 },
      ] });
    expect(res.status).toBe(200);
    expect([res.body.homeScore, res.body.awayScore]).toEqual([3, 1]);

    const tooMany = await request(app).put(`/api/games/${built.gameId}`).set(auth())
      .send({ periodScores: Array(6).fill({ home: 25, away: 20 }) });
    expect(tooMany.status).toBe(400);
  });

  it('scores a fifth-set result with the points the season manager chose', async () => {
    const built = await build('VOLLEYBALL', 'VolleyFive');
    const scoring = await request(app).put(`/api/seasons/${built.seasonId}`).set(auth())
      .send({ scoring: { winPoints: 3, lossPoints: 0, otWinPoints: 2, otLossPoints: 1, drawPoints: 0, allowDraws: false } });
    expect(scoring.status).toBe(200);
    expect(scoring.body.scoring).toMatchObject({ winPoints: 3, otWinPoints: 2, otLossPoints: 1 });

    await request(app).put(`/api/games/${built.gameId}`).set(auth())
      .send({ status: 'COMPLETED', periodScores: [
        { home: 25, away: 20 }, { home: 20, away: 25 }, { home: 25, away: 20 }, { home: 20, away: 25 }, { home: 15, away: 10 },
      ] });
    await request(app).post(`/api/games/${built.gameId}/confirm`).set(auth());

    const standings = await request(app).get(`/api/seasons/${built.seasonId}/standings`);
    const points = Object.fromEntries(standings.body.map((row: { team: { id: string }; points: number }) => [row.team.id, row.points]));
    expect(points[built.teams[0]]).toBe(2);
    expect(points[built.teams[1]]).toBe(1);

    const back = await request(app).put(`/api/seasons/${built.seasonId}`).set(auth()).send({ scoring: null });
    expect(back.body.scoring).toBeNull();
    const bad = await request(app).put(`/api/seasons/${built.seasonId}`).set(auth()).send({ scoring: { winPoints: -1 } });
    expect(bad.status).toBe(400);
  });

  it('runs a new league on the federation rules and counts the balls', async () => {
    const built = await build('VOLLEYBALL', 'VolleyRules');
    await request(app).put(`/api/games/${built.gameId}`).set(auth())
      .send({ status: 'COMPLETED', periodScores: [
        { home: 25, away: 20 }, { home: 20, away: 25 }, { home: 25, away: 20 }, { home: 20, away: 25 }, { home: 15, away: 13 },
      ] });
    await request(app).post(`/api/games/${built.gameId}/confirm`).set(auth());

    const standings = await request(app).get(`/api/seasons/${built.seasonId}/standings`);
    const row = (id: string) => standings.body.find((entry: { team: { id: string } }) => entry.team.id === id);
    expect(row(built.teams[0])).toMatchObject({ points: 2, wins: 1, otWins: 1, partPointsFor: 105, partPointsAgainst: 103 });
    expect(row(built.teams[1])).toMatchObject({ points: 1, losses: 1, otLosses: 1, partPointsFor: 103, partPointsAgainst: 105 });
  });

  it('keeps no player lines', async () => {
    const built = await build('VOLLEYBALL', 'VolleyLines');
    const res = await request(app).post(`/api/game-statistics/game/${built.gameId}`).set(auth())
      .send({ playerId: built.players[0], goals: 1 });
    expect(res.status).toBe(400);
  });
});
