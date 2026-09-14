import request from 'supertest';
import bcrypt from 'bcryptjs';
import { Visibility } from '@prisma/client';
import app from '../app.js';
import prisma from '../config/database.js';

const stamp = Date.now();

let adminToken: string;
let managerToken: string;
let strangerToken: string;
let managerId: string;

// A league with everything a public page can show under it.
let leagueId: string;
let seasonId: string;
let archivedSeasonId: string;
let teamId: string;
let otherTeamId: string;
let playerId: string;
let gameId: string;
let statisticId: string;

// A tournament series with the same.
let seriesId: string;
let tournamentId: string;
let tournamentTeamId: string;
let tournamentGroupId: string;
let tournamentGameId: string;

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function account(label: string, role: 'ADMIN' | 'USER' = 'USER') {
  const email = `${label}-${stamp}@test.com`;
  const user = await prisma.user.create({
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
  return { id: user.id, token: res.body.token as string };
}

const setLeague = (visibility: Visibility) =>
  prisma.league.update({ where: { id: leagueId }, data: { visibility } });
const setSeason = (visibility: Visibility) =>
  prisma.season.update({ where: { id: seasonId }, data: { visibility } });
const setSeries = (visibility: Visibility) =>
  prisma.tournamentSeries.update({ where: { id: seriesId }, data: { visibility } });

beforeAll(async () => {
  ({ token: adminToken } = await account('admin-visibility', 'ADMIN'));
  ({ id: managerId, token: managerToken } = await account('manager-visibility'));
  ({ token: strangerToken } = await account('stranger-visibility'));

  const league = await request(app).post('/api/leagues').set(auth(adminToken))
    .send({ name: `Hidden League ${stamp}`, sportType: 'HOCKEY', managerId });
  leagueId = league.body.id;

  const season = await request(app).post('/api/seasons').set(auth(managerToken))
    .send({ name: `Hidden Season ${stamp}`, leagueId, startDate: '2026-01-01', endDate: '2027-12-31' });
  seasonId = season.body.id;

  const team = await request(app).post(`/api/teams/season/${seasonId}`).set(auth(managerToken))
    .send({ name: `Hidden Team ${stamp}` });
  teamId = team.body.id;
  const other = await request(app).post(`/api/teams/season/${seasonId}`).set(auth(managerToken))
    .send({ name: `Hidden Rival ${stamp}` });
  otherTeamId = other.body.id;

  const player = await request(app).post(`/api/players/team/${teamId}`).set(auth(managerToken))
    .send({ name: `Hidden Player ${stamp}`, number: 9 });
  playerId = player.body.id;

  const game = await request(app).post(`/api/games/season/${seasonId}`).set(auth(managerToken))
    .send({ homeTeamId: teamId, awayTeamId: otherTeamId, date: '2026-03-01T18:00:00Z' });
  gameId = game.body.id;

  const statistic = await request(app).post(`/api/game-statistics/game/${gameId}`).set(auth(managerToken))
    .send({ playerId, goals: 2, assists: 1 });
  statisticId = statistic.body.id;

  await request(app).post(`/api/seasons/${seasonId}/groups`).set(auth(managerToken))
    .send({ name: 'Group A' });

  // A finished season of the same league, archived, so the archive routes have
  // something to hide.
  const past = await request(app).post('/api/seasons').set(auth(managerToken))
    .send({ name: `Hidden Past ${stamp}`, leagueId, startDate: '2024-01-01', endDate: '2024-12-31', status: 'COMPLETED' });
  archivedSeasonId = past.body.id;
  await request(app).post(`/api/teams/${teamId}/seasons/${archivedSeasonId}`).set(auth(managerToken));
  await request(app).post(`/api/seasons/${archivedSeasonId}/archive`).set(auth(managerToken));

  const series = await request(app).post('/api/tournaments/series').set(auth(adminToken))
    .send({ name: `Hidden Cup ${stamp}`, sportType: 'HOCKEY', managerId });
  seriesId = series.body.id;
  const tournament = await request(app).post(`/api/tournaments/series/${seriesId}/tournaments`).set(auth(managerToken))
    .send({ name: `Hidden Cup ${stamp} 2026` });
  tournamentId = tournament.body.id;
  const tTeam = await request(app).post(`/api/tournaments/${tournamentId}/teams`).set(auth(managerToken))
    .send({ name: `Cup Team ${stamp}` });
  tournamentTeamId = tTeam.body.id;
  const tGroup = await request(app).post(`/api/tournaments/${tournamentId}/groups`).set(auth(managerToken))
    .send({ name: 'Cup Group' });
  tournamentGroupId = tGroup.body.id;
  const tGame = await request(app).post(`/api/tournaments/${tournamentId}/games`).set(auth(managerToken))
    .send({ phase: 'GROUP', homeTeamId: tournamentTeamId });
  tournamentGameId = tGame.body.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

/**
 * Every public route that opens one thing under a league or a series. When a
 * public route is added, it goes here - this list is the whole of the guarantee
 * that hiding a league hides everything under it.
 */
const leagueRoutes = () => [
  `/api/leagues/${leagueId}`,
  `/api/seasons/league/${leagueId}`,
  `/api/seasons/${seasonId}`,
  `/api/seasons/${seasonId}/standings`,
  `/api/seasons/${seasonId}/standings/by-group`,
  `/api/seasons/${seasonId}/standings/${teamId}`,
  `/api/seasons/${seasonId}/groups`,
  `/api/seasons/${archivedSeasonId}`,
  `/api/seasons/${archivedSeasonId}/archived-standings`,
  `/api/teams/season/${seasonId}`,
  `/api/games/season/${seasonId}`,
  `/api/games/${gameId}`,
  `/api/games/${gameId}/events`,
  `/api/game-statistics/season/${seasonId}/top`,
  `/api/game-statistics/season/${seasonId}/team/${teamId}`,
  `/api/game-statistics/season/${archivedSeasonId}/archived`,
  `/api/game-statistics/game/${gameId}`,
  `/api/game-statistics/${statisticId}`,
];

const seasonRoutes = () => leagueRoutes().filter(route =>
  !route.includes(leagueId) && !route.includes(archivedSeasonId)
);

const seriesRoutes = () => [
  `/api/tournaments/series/${seriesId}`,
  `/api/tournaments/series/${seriesId}/tournaments`,
  `/api/tournaments/${tournamentId}`,
  `/api/tournaments/${tournamentId}/standings`,
  `/api/tournaments/${tournamentId}/scorers`,
  `/api/tournaments/${tournamentId}/teams`,
  `/api/tournaments/${tournamentId}/groups`,
  `/api/tournaments/${tournamentId}/games`,
  `/api/tournaments/teams/${tournamentTeamId}`,
  `/api/tournaments/teams/${tournamentTeamId}/players`,
  `/api/tournaments/groups/${tournamentGroupId}`,
  `/api/tournaments/games/${tournamentGameId}`,
  `/api/tournaments/games/${tournamentGameId}/statistics`,
];

const statuses = async (routes: string[], token?: string) =>
  Promise.all(
    routes.map(async route => {
      const req = request(app).get(route);
      const res = token ? await req.set(auth(token)) : await req;
      return [route, res.status] as const;
    })
  );

const ids = (body: unknown): string[] => {
  const rows = Array.isArray(body) ? body : (body as { items: unknown[] }).items;
  return rows.map(row => {
    const r = row as { id?: string; player?: { id: string } };
    return r.id ?? r.player!.id;
  });
};

describe('a new season', () => {
  it('starts unlisted and waits to be published', async () => {
    const res = await request(app).get(`/api/seasons/${archivedSeasonId}`).set(auth(managerToken));
    expect(res.body.visibility).toBe('UNLISTED');
  });

  it('can be created already public', async () => {
    const res = await request(app).post('/api/seasons').set(auth(managerToken))
      .send({ name: `Open ${stamp}`, leagueId, startDate: '2026-01-01', endDate: '2026-12-31', visibility: 'PUBLIC' });
    expect(res.status).toBe(201);
    expect(res.body.visibility).toBe('PUBLIC');
    await prisma.season.delete({ where: { id: res.body.id } });
  });

  it('refuses a level that does not exist', async () => {
    const res = await request(app).put(`/api/seasons/${seasonId}`).set(auth(managerToken))
      .send({ visibility: 'SECRET' });
    expect(res.status).toBe(400);
  });

  it('cannot be published by someone who does not run it', async () => {
    const res = await request(app).put(`/api/seasons/${seasonId}`).set(auth(strangerToken))
      .send({ visibility: 'PUBLIC' });
    expect(res.status).toBe(403);
  });
});

describe('a private league', () => {
  beforeAll(async () => {
    await setLeague('PRIVATE');
    await setSeason('PUBLIC');
  });

  it('hides every page under it from a visitor, whatever the season says', async () => {
    for (const [route, status] of await statuses(leagueRoutes())) {
      expect({ route, status }).toEqual({ route, status: 404 });
    }
  });

  it('hides them from a signed-in stranger too', async () => {
    for (const [route, status] of await statuses(leagueRoutes(), strangerToken)) {
      expect({ route, status }).toEqual({ route, status: 404 });
    }
  });

  it('still opens every page for the league manager and an admin', async () => {
    for (const token of [managerToken, adminToken]) {
      for (const [route, status] of await statuses(leagueRoutes(), token)) {
        expect({ route, status }).toEqual({ route, status: 200 });
      }
    }
  });

  it('keeps the team page but drops what it did in the league', async () => {
    const res = await request(app).get(`/api/teams/${teamId}`);
    expect(res.status).toBe(200);
    expect(res.body.seasonTeams).toEqual([]);
    expect(res.body.games).toEqual([]);
    expect(res.body.season).toBeNull();

    const player = await request(app).get(`/api/players/${playerId}`);
    expect(player.status).toBe(200);
    expect(player.body.team.seasonTeams).toEqual([]);

    const stats = await request(app).get(`/api/game-statistics/player/${playerId}`);
    expect(stats.body).toEqual([]);
  });

  it('is left out of every list and search', async () => {
    expect(ids((await request(app).get('/api/leagues')).body)).not.toContain(leagueId);
    expect(ids((await request(app).get('/api/seasons')).body)).not.toContain(seasonId);
    expect(ids((await request(app).get('/api/games?scope=all&take=200')).body)).not.toContain(gameId);
    expect(ids((await request(app).get(`/api/teams?search=${stamp}`)).body)).not.toContain(teamId);
    expect(ids((await request(app).get(`/api/players?search=${stamp}`)).body)).not.toContain(playerId);
    expect(ids((await request(app).get('/api/game-statistics/top?limit=200')).body)).not.toContain(playerId);

    const search = await request(app).get(`/api/search?q=${stamp}`);
    expect(ids(search.body.leagues)).not.toContain(leagueId);
    expect(ids(search.body.seasons)).not.toContain(seasonId);
    expect(ids(search.body.teams)).not.toContain(teamId);
    expect(ids(search.body.players)).not.toContain(playerId);
  });

  it('shows up in the lists of the manager who runs it', async () => {
    expect(ids((await request(app).get('/api/leagues').set(auth(managerToken))).body)).toContain(leagueId);
    expect(ids((await request(app).get('/api/seasons').set(auth(managerToken))).body)).toContain(seasonId);
  });
});

describe('an unlisted league', () => {
  beforeAll(async () => {
    await setLeague('UNLISTED');
    await setSeason('PUBLIC');
  });

  it('opens by link', async () => {
    for (const [route, status] of await statuses(leagueRoutes())) {
      expect({ route, status }).toEqual({ route, status: 200 });
    }
  });

  it('lists its published seasons on its own page', async () => {
    const res = await request(app).get(`/api/leagues/${leagueId}`);
    expect(ids(res.body.seasons)).toContain(seasonId);
    // The archive is still unlisted, as every new season is.
    expect(ids(res.body.seasons)).not.toContain(archivedSeasonId);
  });

  it('keeps itself and its seasons out of the site-wide lists', async () => {
    expect(ids((await request(app).get('/api/leagues')).body)).not.toContain(leagueId);
    expect(ids((await request(app).get('/api/seasons')).body)).not.toContain(seasonId);
    expect(ids((await request(app).get('/api/games?scope=all&take=200')).body)).not.toContain(gameId);
  });
});

describe('a season inside a public league', () => {
  beforeAll(async () => {
    await setLeague('PUBLIC');
  });

  it('opens by link while unlisted, and stays out of every list', async () => {
    await setSeason('UNLISTED');
    for (const [route, status] of await statuses(seasonRoutes())) {
      expect({ route, status }).toEqual({ route, status: 200 });
    }
    expect(ids((await request(app).get('/api/seasons')).body)).not.toContain(seasonId);
    expect(ids((await request(app).get(`/api/seasons/league/${leagueId}`)).body)).not.toContain(seasonId);
    expect(ids((await request(app).get(`/api/leagues/${leagueId}`)).body.seasons)).not.toContain(seasonId);
    expect(ids((await request(app).get(`/api/teams?search=${stamp}`)).body)).not.toContain(otherTeamId);
  });

  it('is not even counted on the public league list', async () => {
    const res = await request(app).get('/api/leagues');
    const league = res.body.find((row: { id: string }) => row.id === leagueId);
    expect(league._count.seasons).toBe(0);
  });

  it('is gone for a visitor once private', async () => {
    await setSeason('PRIVATE');
    for (const [route, status] of await statuses(seasonRoutes())) {
      expect({ route, status }).toEqual({ route, status: 404 });
    }
    // The league itself is still there.
    expect((await request(app).get(`/api/leagues/${leagueId}`)).status).toBe(200);
  });

  it('appears everywhere once published', async () => {
    const res = await request(app).put(`/api/seasons/${seasonId}`).set(auth(managerToken))
      .send({ visibility: 'PUBLIC' });
    expect(res.status).toBe(200);
    expect(res.body.visibility).toBe('PUBLIC');

    expect(ids((await request(app).get('/api/seasons')).body)).toContain(seasonId);
    expect(ids((await request(app).get(`/api/leagues/${leagueId}`)).body.seasons)).toContain(seasonId);
    expect(ids((await request(app).get('/api/games?scope=all&take=200')).body)).toContain(gameId);
    expect(ids((await request(app).get(`/api/teams?search=${stamp}`)).body)).toContain(otherTeamId);
    expect(ids((await request(app).get(`/api/players?search=${stamp}`)).body)).toContain(playerId);
    expect((await request(app).get(`/api/teams/${teamId}`)).body.games.map((g: { id: string }) => g.id)).toContain(gameId);
  });
});

describe('a tournament series', () => {
  it('hides every tournament page under it when private', async () => {
    await setSeries('PRIVATE');
    for (const [route, status] of await statuses(seriesRoutes())) {
      expect({ route, status }).toEqual({ route, status: 404 });
    }
    for (const [route, status] of await statuses(seriesRoutes(), strangerToken)) {
      expect({ route, status }).toEqual({ route, status: 404 });
    }
    for (const [route, status] of await statuses(seriesRoutes(), managerToken)) {
      expect({ route, status }).toEqual({ route, status: 200 });
    }
  });

  it('opens by link when unlisted but stays out of the list', async () => {
    await setSeries('UNLISTED');
    for (const [route, status] of await statuses(seriesRoutes())) {
      expect({ route, status }).toEqual({ route, status: 200 });
    }
    expect(ids((await request(app).get('/api/tournaments/series')).body)).not.toContain(seriesId);
    expect(ids((await request(app).get('/api/tournaments/series').set(auth(managerToken))).body)).toContain(seriesId);
  });

  it('is listed when public', async () => {
    const res = await request(app).put(`/api/tournaments/series/${seriesId}`).set(auth(managerToken))
      .send({ visibility: 'PUBLIC' });
    expect(res.status).toBe(200);
    expect(ids((await request(app).get('/api/tournaments/series')).body)).toContain(seriesId);
  });
});

describe('a league', () => {
  it('takes a visibility from its manager', async () => {
    const res = await request(app).put(`/api/leagues/${leagueId}`).set(auth(managerToken))
      .send({ visibility: 'PRIVATE' });
    expect(res.status).toBe(200);
    expect(res.body.visibility).toBe('PRIVATE');
  });

  it('refuses a level that does not exist', async () => {
    const res = await request(app).put(`/api/leagues/${leagueId}`).set(auth(managerToken))
      .send({ visibility: 'HIDDEN' });
    expect(res.status).toBe(400);
  });
});
