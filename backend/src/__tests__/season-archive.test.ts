import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import prisma from '../config/database.js';

async function getAdminToken(): Promise<string> {
  const email = `admin-archive-${Date.now()}@test.com`;
  const hashedPassword = await bcrypt.hash('password123', 10);
  await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name: 'Test Admin',
      role: 'ADMIN',
      active: true,
      emailVerified: true,
    },
  });

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email, password: 'password123' });

  return loginRes.body.token;
}

let token: string;
let leagueId: number;
let seasonId: number;
let draftSeasonId: number;
let teamId: number;
let teamId2: number;
let playerId: number;
let playerId2: number;
let gameId: number;

beforeAll(async () => {
  token = await getAdminToken();

  const leagueRes = await request(app)
    .post('/api/leagues')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Archive Test League ${Date.now()}`, sportType: 'HOCKEY' });
  leagueId = leagueRes.body.id;

  const seasonRes = await request(app)
    .post('/api/seasons')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: `Archive Test Season ${Date.now()}`,
      leagueId,
      startDate: '2025-01-01',
      endDate: '2025-06-30',
    });
  seasonId = seasonRes.body.id;

  const draftSeasonRes = await request(app)
    .post('/api/seasons')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: `Archive Draft Season ${Date.now()}`,
      leagueId,
      startDate: '2025-07-01',
      endDate: '2025-12-31',
    });
  draftSeasonId = draftSeasonRes.body.id;

  const teamRes = await request(app)
    .post(`/api/teams/season/${seasonId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Archive Team A ${Date.now()}` });
  teamId = teamRes.body.id;

  const teamRes2 = await request(app)
    .post(`/api/teams/season/${seasonId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Archive Team B ${Date.now()}` });
  teamId2 = teamRes2.body.id;

  const playerRes = await request(app)
    .post(`/api/players/team/${teamId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Archive Player Alpha', number: 10 });
  playerId = playerRes.body.id;

  const playerRes2 = await request(app)
    .post(`/api/players/team/${teamId2}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Archive Player Beta', number: 7 });
  playerId2 = playerRes2.body.id;

  const gameRes = await request(app)
    .post(`/api/games/season/${seasonId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ homeTeamId: teamId, awayTeamId: teamId2, date: '2025-03-15', round: 1 });
  gameId = gameRes.body.id;

  await request(app)
    .put(`/api/games/${gameId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'COMPLETED', homeScore: 3, awayScore: 1 });

  await request(app)
    .post(`/api/game-statistics/game/${gameId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ playerId, goals: 2, assists: 1 });
  await request(app)
    .post(`/api/game-statistics/game/${gameId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ playerId: playerId2, goals: 1, assists: 0 });

  // Season must be COMPLETED before it can be archived
  await request(app)
    .put(`/api/seasons/${seasonId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'COMPLETED' });
});

afterAll(async () => {
  await prisma.seasonArchivePlayerStat.deleteMany({ where: { seasonId } }).catch(() => {});
  await prisma.seasonArchiveStanding.deleteMany({ where: { seasonId } }).catch(() => {});
  await prisma.hockeyGameStatistic.deleteMany({ where: { gameId } }).catch(() => {});
  await prisma.game.deleteMany({ where: { seasonId } }).catch(() => {});
  await prisma.seasonTeam.deleteMany({ where: { seasonId } }).catch(() => {});
  if (playerId) await prisma.player.delete({ where: { id: playerId } }).catch(() => {});
  if (playerId2) await prisma.player.delete({ where: { id: playerId2 } }).catch(() => {});
  if (teamId) await prisma.team.delete({ where: { id: teamId } }).catch(() => {});
  if (teamId2) await prisma.team.delete({ where: { id: teamId2 } }).catch(() => {});
  if (draftSeasonId) await prisma.season.delete({ where: { id: draftSeasonId } }).catch(() => {});
  if (seasonId) await prisma.season.delete({ where: { id: seasonId } }).catch(() => {});
  if (leagueId) await prisma.league.delete({ where: { id: leagueId } }).catch(() => {});
  await prisma.$disconnect();
});

describe('Season Archive', () => {
  it('should reject archiving a non-COMPLETED season', async () => {
    const res = await request(app)
      .post(`/api/seasons/${draftSeasonId}/archive`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect(res.body.error).toMatch(/completed/i);
  });

  it('should capture pre-archive standings and top scorers for comparison', async () => {
    const standingsRes = await request(app).get(`/api/seasons/${seasonId}/standings`).expect(200);
    const topScorersRes = await request(app).get(`/api/game-statistics/season/${seasonId}/top`).expect(200);

    expect(standingsRes.body.length).toBe(2);
    expect(topScorersRes.body.length).toBe(2);
  });

  it('should archive a completed season', async () => {
    const res = await request(app)
      .post(`/api/seasons/${seasonId}/archive`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveProperty('season');
    expect(res.body.season.archivedAt).not.toBeNull();
  });

  it('should delete live season-scoped rows', async () => {
    const games = await prisma.game.findMany({ where: { seasonId } });
    const seasonTeams = await prisma.seasonTeam.findMany({ where: { seasonId } });
    const stats = await prisma.hockeyGameStatistic.findMany({ where: { gameId } });

    expect(games.length).toBe(0);
    expect(seasonTeams.length).toBe(0);
    expect(stats.length).toBe(0);
  });

  it('should leave Team and Player rows untouched', async () => {
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    const player = await prisma.player.findUnique({ where: { id: playerId } });

    expect(team).not.toBeNull();
    expect(player).not.toBeNull();
  });

  it('should expose matching archived standings', async () => {
    const res = await request(app).get(`/api/seasons/${seasonId}/archived-standings`).expect(200);

    expect(res.body.length).toBe(2);
    const winner = res.body.find((s: { team: { id: number } }) => s.team.id === teamId);
    expect(winner).toBeDefined();
    expect(winner.wins).toBe(1);
    expect(winner.points).toBe(2);
    expect(winner.rank).toBe(1);
  });

  it('should expose matching archived player stats', async () => {
    const res = await request(app).get(`/api/game-statistics/season/${seasonId}/archived`).expect(200);

    expect(res.body.length).toBe(2);
    const scorer = res.body.find((s: { player: { id: number } }) => s.player.id === playerId);
    expect(scorer).toBeDefined();
    expect(scorer.goals).toBe(2);
    expect(scorer.assists).toBe(1);
    expect(scorer.gamesPlayed).toBe(1);
  });

  it('should reject re-archiving an already archived season', async () => {
    const res = await request(app)
      .post(`/api/seasons/${seasonId}/archive`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect(res.body.error).toMatch(/already archived/i);
  });

  it('should reject creating a team in an archived season', async () => {
    const res = await request(app)
      .post(`/api/teams/season/${seasonId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Should Fail' })
      .expect(400);

    expect(res.body.error).toMatch(/archived/i);
  });

  it('should reject creating a game in an archived season', async () => {
    const res = await request(app)
      .post(`/api/games/season/${seasonId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ homeTeamId: teamId, awayTeamId: teamId2 })
      .expect(400);

    expect(res.body.error).toMatch(/archived/i);
  });

  it('should allow renaming an archived season but reject status/league changes', async () => {
    const renameRes = await request(app)
      .put(`/api/seasons/${seasonId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Archived Season Renamed' })
      .expect(200);
    expect(renameRes.body.name).toBe('Archived Season Renamed');

    const statusRes = await request(app)
      .put(`/api/seasons/${seasonId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'ACTIVE' })
      .expect(400);
    expect(statusRes.body.error).toMatch(/archived/i);
  });

  it('should reject deleting an archived season', async () => {
    const res = await request(app)
      .delete(`/api/seasons/${seasonId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect(res.body.error).toMatch(/archived/i);
  });
});
