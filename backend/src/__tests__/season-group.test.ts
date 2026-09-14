import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import prisma from '../config/database.js';
import { Standing } from '../types/index.js';

interface GroupTable {
  group: { id: string; name: string; position: number } | null;
  standings: Standing[];
}

const stamp = Date.now();

let token: string;
let strangerToken: string;
let seasonId: string;
let otherSeasonId: string;
const teams: Record<string, string> = {};
let groupA: string;
let groupB: string;

const auth = (value = token) => ({ Authorization: `Bearer ${value}` });

async function login(label: string, role: 'ADMIN' | 'USER' = 'USER'): Promise<string> {
  const email = `${label}-${stamp}@test.com`;
  await prisma.user.create({
    data: {
      email,
      password: await bcrypt.hash('password123', 10),
      name: label,
      role,
      active: true,
      emailVerified: true,
    },
  });
  const res = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
  return res.body.token;
}

beforeAll(async () => {
  token = await login('admin-group', 'ADMIN');
  strangerToken = await login('stranger-group');

  const league = await request(app).post('/api/leagues').set(auth())
    .send({ name: `Group League ${stamp}`, sportType: 'HOCKEY' });
  const season = await request(app).post('/api/seasons').set(auth())
    .send({ name: `Group Season ${stamp}`, leagueId: league.body.id, startDate: '2026-01-01', endDate: '2027-12-31' });
  seasonId = season.body.id;

  const other = await request(app).post('/api/seasons').set(auth())
    .send({ name: `Other Season ${stamp}`, leagueId: league.body.id, startDate: '2026-01-01', endDate: '2027-12-31' });
  otherSeasonId = other.body.id;

  for (const name of ['Alpha', 'Bravo', 'Charlie', 'Delta']) {
    const res = await request(app).post(`/api/teams/season/${seasonId}`).set(auth())
      .send({ name: `${name} ${stamp}` });
    teams[name] = res.body.id;
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('divisions', () => {
  it('refuses a group from someone without season access', async () => {
    const res = await request(app).post(`/api/seasons/${seasonId}/groups`).set(auth(strangerToken))
      .send({ name: 'Sneaky' });
    expect(res.status).toBe(403);
  });

  it('requires a name', async () => {
    const res = await request(app).post(`/api/seasons/${seasonId}/groups`).set(auth()).send({});
    expect(res.status).toBe(400);
  });

  it('creates divisions and appends them in order', async () => {
    const a = await request(app).post(`/api/seasons/${seasonId}/groups`).set(auth())
      .send({ name: 'Group A' });
    const b = await request(app).post(`/api/seasons/${seasonId}/groups`).set(auth())
      .send({ name: 'Group B' });
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    groupA = a.body.id;
    groupB = b.body.id;
    expect(a.body.position).toBe(0);
    expect(b.body.position).toBe(1);
  });

  it('refuses two divisions with the same name in one season', async () => {
    const res = await request(app).post(`/api/seasons/${seasonId}/groups`).set(auth())
      .send({ name: 'Group A' });
    expect(res.status).toBe(409);
  });

  it('allows the same name in a different season', async () => {
    const res = await request(app).post(`/api/seasons/${otherSeasonId}/groups`).set(auth())
      .send({ name: 'Group A' });
    expect(res.status).toBe(201);
  });
});

describe('placing teams', () => {
  it('places teams in their divisions', async () => {
    for (const [name, groupId] of [['Alpha', groupA], ['Bravo', groupA], ['Charlie', groupB]] as const) {
      const res = await request(app).put(`/api/seasons/${seasonId}/teams/${teams[name]}/group`)
        .set(auth()).send({ groupId });
      expect(res.status).toBe(200);
      expect(res.body.groupId).toBe(groupId);
    }
  });

  it('takes a team back out of its division', async () => {
    await request(app).put(`/api/seasons/${seasonId}/teams/${teams.Charlie}/group`)
      .set(auth()).send({ groupId: groupB });
    const res = await request(app).put(`/api/seasons/${seasonId}/teams/${teams.Charlie}/group`)
      .set(auth()).send({ groupId: null });
    expect(res.status).toBe(200);
    expect(res.body.groupId).toBeNull();

    await request(app).put(`/api/seasons/${seasonId}/teams/${teams.Charlie}/group`)
      .set(auth()).send({ groupId: groupB });
  });

  it('refuses a team that does not play in the season', async () => {
    const outside = await request(app).post(`/api/teams/season/${otherSeasonId}`).set(auth())
      .send({ name: `Outsider ${stamp}` });
    const res = await request(app).put(`/api/seasons/${seasonId}/teams/${outside.body.id}/group`)
      .set(auth()).send({ groupId: groupA });
    expect(res.status).toBe(404);
  });

  it('refuses a division belonging to another season', async () => {
    const foreign = await request(app).post(`/api/seasons/${otherSeasonId}/groups`).set(auth())
      .send({ name: 'Foreign' });
    const res = await request(app).put(`/api/seasons/${seasonId}/teams/${teams.Alpha}/group`)
      .set(auth()).send({ groupId: foreign.body.id });
    expect(res.status).toBe(400);
  });
});

describe('generating fixtures within divisions', () => {
  it('pairs teams only against others in their own division', async () => {
    const res = await request(app).post(`/api/games/season/${seasonId}/generate`).set(auth())
      .send({ rounds: 1, withinGroups: true });
    expect(res.status).toBe(201);

    const games = await prisma.game.findMany({ where: { seasonId } });
    // Group A: Alpha v Bravo. Group B: Charlie alone, so no pairing. Delta is
    // unplaced and alone, so no pairing either.
    expect(games).toHaveLength(1);
    const pair = [games[0].homeTeamId, games[0].awayTeamId].sort();
    expect(pair).toEqual([teams.Alpha, teams.Bravo].sort());
  });

  it('pairs everyone when divisions are not asked for', async () => {
    const res = await request(app).post(`/api/games/season/${seasonId}/generate`).set(auth())
      .send({ rounds: 1 });
    expect(res.status).toBe(201);
    // Four teams, single round robin.
    expect(await prisma.game.count({ where: { seasonId } })).toBe(6);
  });

  it('groups unplaced teams together rather than with everyone', async () => {
    await request(app).put(`/api/seasons/${seasonId}/teams/${teams.Delta}/group`)
      .set(auth()).send({ groupId: groupB });

    const res = await request(app).post(`/api/games/season/${seasonId}/generate`).set(auth())
      .send({ rounds: 1, withinGroups: true });
    expect(res.status).toBe(201);

    const games = await prisma.game.findMany({ where: { seasonId } });
    // Alpha v Bravo in A, Charlie v Delta in B. No fixture crosses divisions.
    expect(games).toHaveLength(2);
  });
});

describe('a table per division', () => {
  it('counts only games between teams in the same division', async () => {
    const games = await prisma.game.findMany({ where: { seasonId } });
    for (const game of games) {
      await request(app).put(`/api/games/${game.id}`).set(auth())
        .send({ homeScore: 3, awayScore: 1, status: 'COMPLETED' });
      // Tables count confirmed results only.
      await request(app).post(`/api/games/${game.id}/confirm`).set(auth());
    }

    const res = await request(app).get(`/api/seasons/${seasonId}/standings/by-group`);
    expect(res.status).toBe(200);

    const tables: GroupTable[] = res.body;
    expect(tables).toHaveLength(2);
    expect(tables.map((table) => table.group?.name)).toEqual(['Group A', 'Group B']);
    // Two teams each, one game each: nobody has played a team from the other
    // division, so nobody shows more than one game.
    expect(tables.every((table) => table.standings.length === 2)).toBe(true);
    expect(tables.every((table) => table.standings.every((row) => row.played === 1))).toBe(true);
  });

  it('returns one table for a season with no divisions', async () => {
    // A season of its own: the other one has picked up groups from the tests
    // above, and an undivided season is the case being checked here.
    const league = await request(app).post('/api/leagues').set(auth())
      .send({ name: `Flat League ${stamp}`, sportType: 'HOCKEY' });
    const flat = await request(app).post('/api/seasons').set(auth())
      .send({ name: `Flat Season ${stamp}`, leagueId: league.body.id, startDate: '2026-01-01', endDate: '2027-12-31' });

    const res = await request(app).get(`/api/seasons/${flat.body.id}/standings/by-group`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].group).toBeNull();
  });

  it('shows teams still waiting to be placed apart from the divisions', async () => {
    const extra = await request(app).post(`/api/teams/season/${seasonId}`).set(auth())
      .send({ name: `Unplaced ${stamp}` });

    const res = await request(app).get(`/api/seasons/${seasonId}/standings/by-group`);
    const tables: GroupTable[] = res.body;
    const unplaced = tables.find((table) => table.group === null);
    expect(unplaced).toBeDefined();
    expect(unplaced!.standings.map((row) => row.team.id)).toEqual([extra.body.id]);
  });
});

describe('removing a division', () => {
  it('leaves its teams in the season, unplaced', async () => {
    const res = await request(app).delete(`/api/seasons/${seasonId}/groups/${groupB}`).set(auth());
    expect(res.status).toBe(200);

    const stillIn = await prisma.seasonTeam.findMany({
      where: { seasonId, teamId: { in: [teams.Charlie, teams.Delta] } },
    });
    expect(stillIn).toHaveLength(2);
    expect(stillIn.every((entry) => entry.groupId === null)).toBe(true);
  });
});
