import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import prisma from '../config/database.js';

const stamp = Date.now();
let adminToken: string;

const auth = () => ({ Authorization: `Bearer ${adminToken}` });

interface Built {
  tournamentId: string;
  /** Team ids per group, strongest first: index 0 wins every game in its group. */
  groups: string[][];
}

/**
 * A tournament with `groupSizes.length` groups and a generated group schedule.
 * Teams are named by strength so results can be decided without lookups.
 */
async function buildTournament(label: string, groupSizes: number[]): Promise<Built> {
  const series = await request(app).post('/api/tournaments/series').set(auth())
    .send({ name: `Playoff Series ${label} ${stamp}`, sportType: 'HOCKEY' });
  const tournament = await request(app).post(`/api/tournaments/series/${series.body.id}/tournaments`).set(auth())
    .send({ name: `Playoff Cup ${label} ${stamp}` });
  const tournamentId = tournament.body.id as string;

  const groups: string[][] = [];
  for (let g = 0; g < groupSizes.length; g++) {
    const group = await request(app).post(`/api/tournaments/${tournamentId}/groups`).set(auth())
      .send({ name: String.fromCharCode(65 + g) });
    const ids: string[] = [];
    for (let i = 0; i < groupSizes[g]; i++) {
      const team = await request(app).post(`/api/tournaments/${tournamentId}/teams`).set(auth())
        .send({ name: `${String.fromCharCode(65 + g)}${i + 1} ${label}` });
      await request(app).post(`/api/tournaments/groups/${group.body.id}/teams`).set(auth())
        .send({ teamId: team.body.id });
      ids.push(team.body.id);
    }
    groups.push(ids);
  }

  const schedule = await request(app).post(`/api/tournaments/${tournamentId}/generate-schedule`).set(auth())
    .send({ startDate: '2026-11-07', startTime: '08:00', endTime: '22:00', slotDurationMinutes: 20, locations: ['Rink'] });
  expect(schedule.status).toBeLessThan(300);

  return { tournamentId, groups };
}

async function gamesOf(tournamentId: string) {
  return prisma.tournamentGame.findMany({ where: { tournamentId }, orderBy: [{ phase: 'asc' }, { bracketSlot: 'asc' }] });
}

/** Plays every group game the stronger team wins; `skip` leaves that many unplayed. */
async function playGroupStage(built: Built, skip = 0) {
  const rank = new Map(built.groups.flatMap(ids => ids.map((id, i) => [id, i] as const)));
  const groupGames = (await gamesOf(built.tournamentId)).filter(g => g.phase === 'GROUP');
  for (const game of groupGames.slice(0, groupGames.length - skip)) {
    await play(game.id, rank.get(game.homeTeamId!)! < rank.get(game.awayTeamId!)!);
  }
  return groupGames.slice(groupGames.length - skip);
}

async function play(gameId: string, homeWins: boolean) {
  const res = await request(app).put(`/api/tournaments/games/${gameId}`).set(auth())
    .send({ homeScore: homeWins ? 3 : 1, awayScore: homeWins ? 1 : 3, status: 'COMPLETED' });
  expect(res.status).toBe(200);
}

async function generatePlayoffs(tournamentId: string, qualifiersPerGroup: number) {
  return request(app).post(`/api/tournaments/${tournamentId}/generate-playoffs`).set(auth())
    .send({ qualifiersPerGroup, startTime: '09:00', slotDurationMinutes: 30 });
}

beforeAll(async () => {
  const email = `admin-tplayoff-${stamp}@test.com`;
  await prisma.user.create({
    data: { email, password: await bcrypt.hash('password123', 10), name: 'Admin', role: 'ADMIN', active: true, emailVerified: true },
  });
  const res = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
  adminToken = res.body.token;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('tournament play-off from two groups', () => {
  it('pairs each group winner with the other group runner-up and adds a bronze game', async () => {
    const built = await buildTournament('four', [4, 4]);
    await playGroupStage(built);

    const res = await generatePlayoffs(built.tournamentId, 2);
    expect(res.status).toBe(201);

    const knockout = (await gamesOf(built.tournamentId)).filter(g => g.phase !== 'GROUP');
    expect(knockout.map(g => g.phase).sort()).toEqual(['BRONZE', 'FINAL', 'SEMI_FINAL', 'SEMI_FINAL']);

    const [a, b] = built.groups;
    const semis = knockout.filter(g => g.phase === 'SEMI_FINAL');
    expect(semis.map(g => [g.homeSeed, g.awaySeed])).toEqual([[1, 4], [2, 3]]);
    for (const semi of semis) {
      const pair = [semi.homeTeamId, semi.awayTeamId];
      const crossed = (pair.includes(a[0]) && pair.includes(b[1])) || (pair.includes(b[0]) && pair.includes(a[1]));
      expect(crossed).toBe(true);
    }
  });

  it('seeds eight qualifiers 1v8, 4v5, 2v7, 3v6', async () => {
    const built = await buildTournament('eight', [4, 4]);
    await playGroupStage(built);

    expect((await generatePlayoffs(built.tournamentId, 4)).status).toBe(201);

    const knockout = (await gamesOf(built.tournamentId)).filter(g => g.phase !== 'GROUP');
    const quarters = knockout.filter(g => g.phase === 'QUARTER_FINAL');
    expect(quarters.map(g => [g.homeSeed, g.awaySeed])).toEqual([[1, 8], [4, 5], [2, 7], [3, 6]]);
    expect(quarters.every(g => g.homeTeamId && g.awayTeamId)).toBe(true);
    expect(knockout.filter(g => g.phase === 'SEMI_FINAL')).toHaveLength(2);
    expect(knockout.filter(g => g.phase === 'FINAL')).toHaveLength(1);
    expect(knockout.filter(g => g.phase === 'BRONZE')).toHaveLength(1);
  });

  it('shows seeds only until the group stage ends, then fills the teams in', async () => {
    const built = await buildTournament('early', [4, 4]);
    const [last] = await playGroupStage(built, 1);

    expect((await generatePlayoffs(built.tournamentId, 2)).status).toBe(201);
    let semis = (await gamesOf(built.tournamentId)).filter(g => g.phase === 'SEMI_FINAL');
    expect(semis.every(g => g.homeTeamId === null && g.awayTeamId === null)).toBe(true);
    expect(semis.every(g => g.homeSeed !== null && g.awaySeed !== null)).toBe(true);

    const rank = new Map(built.groups.flatMap(ids => ids.map((id, i) => [id, i] as const)));
    await play(last.id, rank.get(last.homeTeamId!)! < rank.get(last.awayTeamId!)!);

    semis = (await gamesOf(built.tournamentId)).filter(g => g.phase === 'SEMI_FINAL');
    expect(semis.every(g => g.homeTeamId && g.awayTeamId)).toBe(true);
  });

  it('moves the semi-final winner to the final and the loser to the bronze game', async () => {
    const built = await buildTournament('advance', [4, 4]);
    await playGroupStage(built);
    await generatePlayoffs(built.tournamentId, 2);

    const games = await gamesOf(built.tournamentId);
    const semi = games.find(g => g.phase === 'SEMI_FINAL' && g.bracketSlot === 0)!;
    await play(semi.id, false);

    const after = await gamesOf(built.tournamentId);
    const final = after.find(g => g.phase === 'FINAL')!;
    const bronze = after.find(g => g.phase === 'BRONZE')!;
    expect(final.homeTeamId).toBe(semi.awayTeamId);
    expect(bronze.homeTeamId).toBe(semi.homeTeamId);
  });

  it('gives the two best group winners a bye when six teams qualify', async () => {
    const built = await buildTournament('byes', [3, 3, 3]);
    const [last] = await playGroupStage(built, 1);

    expect((await generatePlayoffs(built.tournamentId, 2)).status).toBe(201);
    let knockout = (await gamesOf(built.tournamentId)).filter(g => g.phase !== 'GROUP');
    expect(knockout.filter(g => g.phase === 'QUARTER_FINAL').map(g => [g.homeSeed, g.awaySeed])).toEqual([[4, 5], [3, 6]]);
    expect(knockout.filter(g => g.phase === 'SEMI_FINAL').map(g => [g.homeSeed, g.awaySeed])).toEqual([[1, null], [2, null]]);
    expect(knockout.filter(g => g.phase === 'BRONZE')).toHaveLength(1);

    // The seeds waiting in the semi-finals fill in with the rest once the groups end.
    const rank = new Map(built.groups.flatMap(ids => ids.map((id, i) => [id, i] as const)));
    await play(last.id, rank.get(last.homeTeamId!)! < rank.get(last.awayTeamId!)!);
    knockout = (await gamesOf(built.tournamentId)).filter(g => g.phase !== 'GROUP');
    const winners = built.groups.map(ids => ids[0]);
    for (const semi of knockout.filter(g => g.phase === 'SEMI_FINAL')) {
      expect(winners).toContain(semi.homeTeamId);
      expect(semi.awayTeamId).toBeNull();
    }

    // A quarter-final winner joins the bye team in the semi-final.
    const quarter = knockout.find(g => g.phase === 'QUARTER_FINAL' && g.bracketSlot === 1)!;
    await play(quarter.id, true);
    const semi = (await gamesOf(built.tournamentId)).find(g => g.phase === 'SEMI_FINAL' && g.bracketSlot === 0)!;
    expect(semi.awayTeamId).toBe(quarter.homeTeamId);
  });

  it('refuses a second bracket, and deleting one once a result is in', async () => {
    const built = await buildTournament('locked', [4, 4]);
    await playGroupStage(built);
    await generatePlayoffs(built.tournamentId, 2);

    expect((await generatePlayoffs(built.tournamentId, 2)).status).toBe(400);

    const semi = (await gamesOf(built.tournamentId)).find(g => g.phase === 'SEMI_FINAL')!;
    await play(semi.id, true);

    const res = await request(app).delete(`/api/tournaments/${built.tournamentId}/playoffs`).set(auth());
    expect(res.status).toBe(400);
  });
});
