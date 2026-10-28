import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import prisma from '../config/database.js';

const stamp = Date.now();

let organiser: { id: string; token: string };
let stranger: { id: string; token: string };

const as = (token: string) => ({ Authorization: `Bearer ${token}` });

async function account(label: string) {
  const email = `tscorer-${label}-${stamp}@test.com`;
  const user = await prisma.user.create({
    data: { email, password: await bcrypt.hash('password123', 10), name: label, active: true, emailVerified: true },
  });
  const res = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
  return { id: user.id, token: res.body.token as string };
}

interface Cup {
  id: string;
  home: string;
  away: string;
  homePlayer: string;
  homeAssist: string;
  awayPlayer: string;
}

/** A tournament of two teams with a player or two each, on the given plan and sport. */
async function cup(label: string, plan: 'FREE' | 'TOURNAMENT' = 'TOURNAMENT', sportType = 'FLOORBALL'): Promise<Cup> {
  const series = await request(app).post('/api/tournaments/series').set(as(organiser.token))
    .send({ name: `Court Series ${label} ${stamp}`, sportType });
  const created = await request(app).post(`/api/tournaments/series/${series.body.id}/tournaments`).set(as(organiser.token))
    .send({ name: `Court Cup ${label} ${stamp}` });
  const id = created.body.id as string;
  await prisma.tournament.update({ where: { id }, data: { plan } });
  const home = await prisma.tournamentTeam.create({ data: { tournamentId: id, name: `Home ${label}` } });
  const away = await prisma.tournamentTeam.create({ data: { tournamentId: id, name: `Away ${label}` } });
  const player = (teamId: string, name: string, number: number) =>
    prisma.tournamentPlayer.create({ data: { teamId, name, number } }).then(p => p.id);
  return {
    id,
    home: home.id,
    away: away.id,
    homePlayer: await player(home.id, 'Home Nine', 9),
    homeAssist: await player(home.id, 'Home Seven', 7),
    awayPlayer: await player(away.id, 'Away Ten', 10),
  };
}

const game = (c: Cup, location: string, extra: Record<string, unknown> = {}) =>
  prisma.tournamentGame.create({
    data: {
      tournamentId: c.id,
      phase: 'GROUP',
      homeTeamId: c.home,
      awayTeamId: c.away,
      location,
      date: new Date('2026-11-07T09:00:00Z'),
      ...extra,
    },
  }).then(g => g.id);

const createLink = (tournamentId: string, location: string, token = organiser.token) =>
  request(app).post(`/api/tournaments/${tournamentId}/scorer-links`).set(as(token)).send({ location, label: 'Volunteer' });

/** A fresh link for the court, as the organiser hands it out; returns its token. */
async function linkFor(tournamentId: string, location: string): Promise<string> {
  const res = await createLink(tournamentId, location);
  expect(res.status).toBe(201);
  return (res.body.url as string).split('/zapis/t/')[1];
}

const goal = (token: string, gameId: string, teamId: string, extra: Record<string, unknown> = {}) =>
  request(app).post(`/api/scorer/t/${token}/games/${gameId}/goals`).send({ teamId, ...extra });

beforeAll(async () => {
  organiser = await account('organiser');
  stranger = await account('stranger');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('tournament scorer links: the organiser side', () => {
  it('lists the courts and is for paid plans only', async () => {
    const free = await cup('free', 'FREE');
    await game(free, 'Court 1');

    const list = await request(app).get(`/api/tournaments/${free.id}/scorer-links`).set(as(organiser.token));
    expect(list.status).toBe(200);
    expect(list.body).toEqual(expect.objectContaining({ allowed: false, mode: 'GOALS' }));
    expect(list.body.courts).toEqual([expect.objectContaining({ location: 'Court 1', games: 1, link: null })]);

    const refused = await createLink(free.id, 'Court 1');
    expect(refused.status).toBe(409);
    expect(refused.body).toEqual(expect.objectContaining({ code: 'PLAN_FEATURE', feature: 'SCORER_LINKS' }));
  });

  it('lets only the organiser hand out a link, for a court that exists', async () => {
    const c = await cup('owner');
    await game(c, 'Court 1');
    expect((await createLink(c.id, 'Court 1', stranger.token)).status).toBe(403);
    expect((await createLink(c.id, 'Nowhere')).status).toBe(404);
  });

  it('stores only a hash, and a new link cancels the court\'s old one', async () => {
    const c = await cup('replace');
    const gameId = await game(c, 'Court 1');
    const first = await linkFor(c.id, 'Court 1');
    const second = await linkFor(c.id, 'Court 1');

    const stored = await prisma.tournamentScorerLink.findMany({ where: { tournamentId: c.id } });
    expect(stored.map(link => link.tokenHash)).not.toContain(first);

    expect((await goal(first, gameId, c.home)).status).toBe(410);
    expect((await goal(second, gameId, c.home)).status).toBe(201);

    const list = await request(app).get(`/api/tournaments/${c.id}/scorer-links`).set(as(organiser.token));
    const link = list.body.courts[0].link;
    expect(link).toEqual(expect.objectContaining({ status: 'ACTIVE', label: 'Volunteer' }));
    expect(JSON.stringify(list.body)).not.toContain(second);

    const revoke = await request(app).delete(`/api/tournaments/${c.id}/scorer-links/${link.id}`).set(as(organiser.token));
    expect(revoke.status).toBe(200);
    const dead = await goal(second, gameId, c.home);
    expect(dead.status).toBe(410);
    expect(dead.body.code).toBe('REVOKED');

    const page = await request(app).get(`/api/scorer/t/${second}`);
    expect(page.body.status).toBe('REVOKED');
    expect(page.body.games).toEqual([]);
  });

  it('expires twelve hours after the last game on the court', async () => {
    const c = await cup('expiry');
    await game(c, 'Court 1', { date: new Date('2030-05-01T10:00:00Z') });
    await game(c, 'Court 1', { date: new Date('2030-05-01T16:00:00Z') });
    await linkFor(c.id, 'Court 1');
    const link = await prisma.tournamentScorerLink.findFirstOrThrow({ where: { tournamentId: c.id } });
    expect(link.expiresAt.toISOString()).toBe('2030-05-02T04:00:00.000Z');

    await prisma.tournamentScorerLink.update({ where: { id: link.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const page = await request(app).get(`/api/scorer/t/${(await linkFor(c.id, 'Court 1'))}`);
    expect(page.body.status).toBe('ACTIVE');
  });
});

describe('tournament scorer links: the volunteer side', () => {
  it('shows only the games of its own court', async () => {
    const c = await cup('court');
    const here = await game(c, 'Court 1');
    const there = await game(c, 'Court 2');
    const token = await linkFor(c.id, 'Court 1');

    const page = await request(app).get(`/api/scorer/t/${token}`);
    expect(page.status).toBe(200);
    expect(page.body.location).toBe('Court 1');
    expect(page.body.games.map((g: { id: string }) => g.id)).toEqual([here]);

    expect((await goal(token, there, c.home)).status).toBe(404);
  });

  it('counts the score and the statistics from the goals', async () => {
    const c = await cup('count');
    const gameId = await game(c, 'Court 1');
    const token = await linkFor(c.id, 'Court 1');

    const first = await goal(token, gameId, c.home, { playerId: c.homePlayer, assistPlayerId: c.homeAssist });
    expect(first.status).toBe(201);
    expect(first.body.game.goals).toHaveLength(1);
    expect(first.body.game.rosters[c.home]).toHaveLength(2);
    await goal(token, gameId, c.home, { playerId: c.homePlayer });
    await goal(token, gameId, c.away);

    const saved = await prisma.tournamentGame.findUniqueOrThrow({ where: { id: gameId }, include: { statistics: true } });
    expect(saved).toEqual(expect.objectContaining({ homeScore: 2, awayScore: 1, status: 'IN_PROGRESS', keptByLink: true }));
    const line = (playerId: string) => saved.statistics.find(stat => stat.playerId === playerId);
    expect(line(c.homePlayer)).toEqual(expect.objectContaining({ goals: 2, assists: 0 }));
    expect(line(c.homeAssist)).toEqual(expect.objectContaining({ goals: 0, assists: 1 }));

    const scorers = await request(app).get(`/api/tournaments/${c.id}/scorers`);
    expect(scorers.body[0]).toEqual(expect.objectContaining({ goals: 2 }));

    // Removing a goal counts again.
    const goalId = first.body.game.goals[0].id;
    const removed = await request(app).delete(`/api/scorer/t/${token}/games/${gameId}/goals/${goalId}`);
    expect(removed.status).toBe(200);
    const after = await prisma.tournamentGame.findUniqueOrThrow({ where: { id: gameId }, include: { statistics: true } });
    expect(after.homeScore).toBe(1);
    expect(after.statistics.find(stat => stat.playerId === c.homeAssist)).toBeUndefined();
  });

  it('refuses players of the other team and goals of another link', async () => {
    const c = await cup('guard');
    const gameId = await game(c, 'Court 1');
    const old = await linkFor(c.id, 'Court 1');
    const added = await goal(old, gameId, c.home);
    const token = await linkFor(c.id, 'Court 1');

    expect((await goal(token, gameId, c.home, { playerId: c.awayPlayer })).status).toBe(400);
    expect((await goal(token, gameId, 'not-a-team')).status).toBe(400);

    const goalId = added.body.game.goals[0].id;
    const foreign = await request(app).delete(`/api/scorer/t/${token}/games/${gameId}/goals/${goalId}`);
    expect(foreign.status).toBe(403);
    expect(foreign.body.code).toBe('NOT_YOURS');
  });

  it('leaves a result the organiser entered by hand alone', async () => {
    const c = await cup('hand');
    const gameId = await game(c, 'Court 1', { homeScore: 4, awayScore: 2, status: 'COMPLETED' });
    const token = await linkFor(c.id, 'Court 1');

    const res = await goal(token, gameId, c.home);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('HAND_RESULT');
    const page = await request(app).get(`/api/scorer/t/${token}`);
    expect(page.body.games[0].block).toBe('HAND_RESULT');
  });

  it('finishes a game, 0:0 without goals, and the scorer may still correct it', async () => {
    const c = await cup('finish');
    const gameId = await game(c, 'Court 1');
    const token = await linkFor(c.id, 'Court 1');

    const done = await request(app).post(`/api/scorer/t/${token}/games/${gameId}/finish`);
    expect(done.status).toBe(200);
    expect(await prisma.tournamentGame.findUniqueOrThrow({ where: { id: gameId } }))
      .toEqual(expect.objectContaining({ status: 'COMPLETED', homeScore: 0, awayScore: 0, keptByLink: true }));

    expect((await goal(token, gameId, c.away)).status).toBe(201);
    expect((await prisma.tournamentGame.findUniqueOrThrow({ where: { id: gameId } })).awayScore).toBe(1);
  });

  it('sends the winner of a play-off game on, and wants a winner', async () => {
    const c = await cup('bracket');
    const semi = await game(c, 'Court 1', { phase: 'SEMI_FINAL', bracketSlot: 0 });
    const final = await game(c, 'Court 1', { phase: 'FINAL', bracketSlot: 0, homeTeamId: null, awayTeamId: null });
    const bronze = await game(c, 'Court 1', { phase: 'BRONZE', bracketSlot: 0, homeTeamId: null, awayTeamId: null });
    const token = await linkFor(c.id, 'Court 1');

    const page = await request(app).get(`/api/scorer/t/${token}`);
    expect(page.body.games.find((g: { id: string }) => g.id === final).block).toBe('TEAMS_UNKNOWN');

    const level = await request(app).post(`/api/scorer/t/${token}/games/${semi}/finish`);
    expect(level.status).toBe(409);
    expect(level.body.code).toBe('PLAYOFF_NEEDS_WINNER');

    await goal(token, semi, c.away);
    expect((await request(app).post(`/api/scorer/t/${token}/games/${semi}/finish`)).status).toBe(200);
    expect((await prisma.tournamentGame.findUniqueOrThrow({ where: { id: final } })).homeTeamId).toBe(c.away);
    expect((await prisma.tournamentGame.findUniqueOrThrow({ where: { id: bronze } })).homeTeamId).toBe(c.home);
  });

  it('fills the play-off seeds once the last group game is finished', async () => {
    const c = await cup('seeds');
    const group = await prisma.tournamentGroup.create({ data: { tournamentId: c.id, name: 'A' } });
    await prisma.tournamentGroupTeam.createMany({
      data: [{ groupId: group.id, teamId: c.home }, { groupId: group.id, teamId: c.away }],
    });
    const groupGame = await game(c, 'Court 1', { groupId: group.id });
    const final = await game(c, 'Court 1', {
      phase: 'FINAL', bracketSlot: 0, homeTeamId: null, awayTeamId: null, homeSeed: 1, awaySeed: 2,
    });
    const token = await linkFor(c.id, 'Court 1');

    await goal(token, groupGame, c.away);
    expect((await request(app).post(`/api/scorer/t/${token}/games/${groupGame}/finish`)).status).toBe(200);
    const seeded = await prisma.tournamentGame.findUniqueOrThrow({ where: { id: final } });
    expect(seeded.homeTeamId).toBe(c.away);
    expect(seeded.awayTeamId).toBe(c.home);
  });

  it('keeps volleyball sets, and the organiser can take a game back by hand', async () => {
    const c = await cup('volley', 'TOURNAMENT', 'VOLLEYBALL');
    const gameId = await game(c, 'Court 1');
    const token = await linkFor(c.id, 'Court 1');

    expect((await goal(token, gameId, c.home)).status).toBe(409);
    const sets = await request(app).put(`/api/scorer/t/${token}/games/${gameId}/sets`)
      .send({ periodScores: [{ home: 25, away: 20 }, { home: 18, away: 25 }, { home: 15, away: 10 }] });
    expect(sets.status).toBe(200);
    expect(await prisma.tournamentGame.findUniqueOrThrow({ where: { id: gameId } }))
      .toEqual(expect.objectContaining({ homeScore: 2, awayScore: 1, keptByLink: true }));

    const byHand = await request(app).put(`/api/tournaments/games/${gameId}`).set(as(organiser.token))
      .send({ periodScores: [{ home: 25, away: 20 }, { home: 25, away: 18 }] });
    expect(byHand.status).toBe(200);
    expect(byHand.body.keptByLink).toBe(false);
    expect((await request(app).put(`/api/scorer/t/${token}/games/${gameId}/sets`).send({ periodScores: [] })).body.code)
      .toBe('HAND_RESULT');
  });

  it('keeps the organiser\'s hand statistics off a game the link keeps', async () => {
    const c = await cup('stats');
    const gameId = await game(c, 'Court 1');
    const token = await linkFor(c.id, 'Court 1');
    await goal(token, gameId, c.home, { playerId: c.homePlayer });

    const res = await request(app).post(`/api/tournaments/games/${gameId}/statistics`).set(as(organiser.token))
      .send({ playerId: c.homeAssist, goals: 1 });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('KEPT_BY_LINK');
  });
});
