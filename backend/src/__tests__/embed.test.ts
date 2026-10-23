import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import prisma from '../config/database.js';
import { resetEmbedState, siteOf } from '../controllers/embedController.js';

const stamp = Date.now();
const auth = (value: string) => ({ Authorization: `Bearer ${value}` });
let adminToken: string;

beforeAll(async () => {
  const email = `admin-embed-${stamp}@test.com`;
  await prisma.user.create({
    data: { email, password: await bcrypt.hash('password123', 10), name: 'Admin', role: 'ADMIN', active: true, emailVerified: true },
  });
  adminToken = (await request(app).post('/api/auth/login').send({ email, password: 'password123' })).body.token;
});

beforeEach(() => resetEmbedState());

afterAll(async () => {
  await prisma.$disconnect();
});

const day = (offset: number) => new Date(Date.now() + offset * 24 * 60 * 60 * 1000);

/** A season with four teams, two played games (one confirmed) and two to come. */
async function season(label: string, visibility: 'PUBLIC' | 'UNLISTED' | 'PRIVATE' = 'PUBLIC', divisions = false) {
  const league = await prisma.league.create({ data: { name: `Embed League ${label} ${stamp}`, sportType: 'HOCKEY' } });
  const created = await prisma.season.create({
    data: { name: `Embed ${label}`, leagueId: league.id, startDate: day(-30), endDate: day(60), visibility },
  });
  const teams = await Promise.all(['Alfa', 'Beta', 'Gama', 'Delta'].map((name) =>
    prisma.team.create({ data: { name: `${name} ${label}`, primaryColor: '#112233' } })));
  const groups = divisions
    ? await Promise.all(['Sever', 'Jih'].map((name, position) => prisma.seasonGroup.create({ data: { name, position, seasonId: created.id } })))
    : [];
  await prisma.seasonTeam.createMany({
    data: teams.map((team, i) => ({ seasonId: created.id, teamId: team.id, groupId: groups.length ? groups[i % 2].id : null })),
  });
  const [a, b, c, d] = teams;
  await prisma.game.createMany({
    data: [
      { seasonId: created.id, homeTeamId: a.id, awayTeamId: c.id, date: day(-7), round: 1, status: 'COMPLETED', homeScore: 4, awayScore: 1, confirmedAt: day(-6) },
      { seasonId: created.id, homeTeamId: b.id, awayTeamId: d.id, date: day(-6), round: 1, status: 'COMPLETED', homeScore: 2, awayScore: 2 },
      { seasonId: created.id, homeTeamId: c.id, awayTeamId: b.id, date: day(3), round: 2, location: 'Zimní stadion' },
      { seasonId: created.id, homeTeamId: a.id, awayTeamId: d.id, date: day(2), round: 2 },
    ],
  });
  return { id: created.id, teams, groups };
}

describe('the embedded standings', () => {
  it('shows a public season table, ranked, with nothing about people', async () => {
    const { id, teams } = await season('table');
    const res = await request(app).get(`/api/embed/season/${id}/standings`);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=60');
    expect(res.body.competition).toMatchObject({ kind: 'season', name: 'Embed table', parentName: expect.stringContaining('Embed League'), canHideBrand: false });
    const [table] = res.body.tables;
    expect(table.group).toBeNull();
    expect(table.rows).toHaveLength(4);
    expect(table.rows[0]).toMatchObject({ rank: 1, team: { id: teams[0].id, color: '#112233' }, played: 1, wins: 1, goalsFor: 4 });
    // The unconfirmed 2:2 does not count yet.
    expect(table.rows.find((row: { team: { id: string } }) => row.team.id === teams[1].id).played).toBe(0);
    expect(JSON.stringify(res.body)).not.toMatch(/@|email|password|phone/i);
  });

  it('answers the same for a private season as for a missing one, and works for an unlisted one', async () => {
    const hidden = await season('private', 'PRIVATE');
    const unlisted = await season('unlisted', 'UNLISTED');
    const missing = await request(app).get('/api/embed/season/00000000-0000-0000-0000-000000000000/standings');
    const privateOne = await request(app).get(`/api/embed/season/${hidden.id}/standings`);
    expect(privateOne.status).toBe(404);
    expect(privateOne.body).toEqual(missing.body);
    expect(privateOne.body.code).toBe('UNAVAILABLE');
    // Even to its own admin: the widget is for anonymous visitors on other sites.
    expect((await request(app).get(`/api/embed/season/${hidden.id}/standings`).set(auth(adminToken))).status).toBe(404);
    expect((await request(app).get(`/api/embed/season/${unlisted.id}/standings`)).status).toBe(200);
    expect((await request(app).get(`/api/embed/league/${unlisted.id}/standings`)).status).toBe(404);
  });

  it('gives a table per division, one division, or the whole season', async () => {
    const { id, groups } = await season('divisions', 'PUBLIC', true);
    const all = await request(app).get(`/api/embed/season/${id}/standings`);
    expect(all.body.tables.map((t: { group: { name: string } }) => t.group.name)).toEqual(['Sever', 'Jih']);
    expect(all.body.tables[0].rows).toHaveLength(2);
    const one = await request(app).get(`/api/embed/season/${id}/standings`).query({ group: groups[1].id });
    expect(one.body.tables.map((t: { group: { name: string } }) => t.group.name)).toEqual(['Jih']);
    const total = await request(app).get(`/api/embed/season/${id}/standings`).query({ group: 'total' });
    expect(total.body.tables).toHaveLength(1);
    expect(total.body.tables[0]).toMatchObject({ group: null });
    expect(total.body.tables[0].rows).toHaveLength(4);
  });

  it('shows an empty season without failing', async () => {
    const league = await prisma.league.create({ data: { name: `Empty ${stamp}` } });
    const empty = await prisma.season.create({ data: { name: 'Empty', leagueId: league.id, startDate: day(1), endDate: day(90), visibility: 'PUBLIC' } });
    expect((await request(app).get(`/api/embed/season/${empty.id}/standings`)).body.tables).toEqual([{ group: null, rows: [] }]);
    expect((await request(app).get(`/api/embed/season/${empty.id}/games`).query({ results: '1' })).body).toMatchObject({ upcoming: [], recent: [] });
  });
});

describe('the embedded games', () => {
  it('lists what is coming soonest first, and only confirmed results', async () => {
    const { id, teams } = await season('games');
    const res = await request(app).get(`/api/embed/season/${id}/games`).query({ results: '1', rows: '5' });
    expect(res.body.upcoming.map((g: { home: { id: string } }) => g.home.id)).toEqual([teams[0].id, teams[2].id]);
    expect(res.body.upcoming[0]).toMatchObject({ homeScore: null, awayScore: null, round: 2 });
    expect(res.body.upcoming[1].location).toBe('Zimní stadion');
    expect(res.body.recent).toHaveLength(1);
    expect(res.body.recent[0]).toMatchObject({ homeScore: 4, awayScore: 1 });
  });

  it('narrows to one team and to the number of rows asked for', async () => {
    const { id, teams } = await season('team');
    const res = await request(app).get(`/api/embed/season/${id}/games`).query({ team: teams[3].id, rows: '1' });
    expect(res.body.upcoming).toHaveLength(1);
    expect(res.body.upcoming[0].away.id).toBe(teams[3].id);
    expect(res.body.recent).toEqual([]);
  });
});

describe('a tournament', () => {
  it('shows group tables and lets Tournament Plus hide the ATM footer', async () => {
    const series = await prisma.tournamentSeries.create({ data: { name: `Embed Cup ${stamp}`, sportType: 'FLOORBALL' } });
    const tournament = await prisma.tournament.create({ data: { name: 'Embed Cup 2027', seriesId: series.id } });
    const group = await prisma.tournamentGroup.create({ data: { name: 'A', tournamentId: tournament.id } });
    const [x, y] = await Promise.all(['X', 'Y'].map((name) => prisma.tournamentTeam.create({ data: { name, tournamentId: tournament.id } })));
    await prisma.tournamentGroupTeam.createMany({ data: [x, y].map((team) => ({ groupId: group.id, teamId: team.id })) });
    await prisma.tournamentGame.create({
      data: { tournamentId: tournament.id, groupId: group.id, phase: 'GROUP', homeTeamId: x.id, awayTeamId: y.id, status: 'COMPLETED', homeScore: 3, awayScore: 0, date: day(-1) },
    });

    const free = await request(app).get(`/api/embed/tournament/${tournament.id}/standings`);
    expect(free.body.competition.canHideBrand).toBe(false);
    expect(free.body.tables[0].group.name).toBe('A');
    expect(free.body.tables[0].rows[0]).toMatchObject({ rank: 1, team: { name: 'X' }, points: expect.any(Number), wins: 1 });

    await prisma.tournament.update({ where: { id: tournament.id }, data: { plan: 'TOURNAMENT_PLUS' } });
    resetEmbedState();
    expect((await request(app).get(`/api/embed/tournament/${tournament.id}/standings`)).body.competition.canHideBrand).toBe(true);
    expect((await request(app).get(`/api/embed/tournament/${tournament.id}/games`).query({ results: '1' })).body.recent[0]).toMatchObject({ phase: 'GROUP', homeScore: 3 });
  });
});

describe('counting views', () => {
  it('counts a load per site and day without cookies, and shows the admin where the widget is used', async () => {
    const { id } = await season('views');
    const load = (site: string) => request(app).get(`/api/embed/season/${id}/standings`).query({ count: '1', site });
    const first = await load('www.hc-example.cz');
    expect(first.headers['set-cookie']).toBeUndefined();
    await load('www.hc-example.cz');
    await load('liga.example.com');
    await new Promise((resolve) => setTimeout(resolve, 200));

    const rows = await prisma.embedView.findMany({ where: { competitionId: id }, orderBy: { site: 'asc' } });
    expect(rows.map((row) => [row.site, row.views])).toEqual([['liga.example.com', 1], ['www.hc-example.cz', 2]]);

    const usage = await request(app).get('/api/admin/embeds').set(auth(adminToken));
    expect(usage.status).toBe(200);
    expect(usage.body.competitions.find((row: { id: string }) => row.id === id)).toMatchObject({
      kind: 'season', name: expect.stringContaining('Embed views'), sites: ['liga.example.com', 'www.hc-example.cz'], views: 3,
    });
    expect((await request(app).get('/api/admin/embeds')).status).toBe(401);
  });

  it('keeps only plain host names', () => {
    expect(siteOf('Klub.Example.CZ')).toBe('klub.example.cz');
    expect(siteOf('localhost')).toBe('');
    expect(siteOf('<script>.cz')).toBe('');
    expect(siteOf(undefined)).toBe('');
  });
});
