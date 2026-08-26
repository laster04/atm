import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import prisma from '../config/database.js';

async function getAdminToken(): Promise<string> {
  const email = `admin-copyteams-${Date.now()}@test.com`;
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
let liveCompletedSeasonId: number;
let archivedSeasonId: number;
let draftSeasonId: number;
let newSeasonId: number;
let teamId: number;
let teamId2: number;
let archivedTeamId: number;

beforeAll(async () => {
  token = await getAdminToken();

  const leagueRes = await request(app)
    .post('/api/leagues')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Copy Teams League ${Date.now()}`, sportType: 'HOCKEY' });
  leagueId = leagueRes.body.id;

  // Live COMPLETED season with two teams still in season_teams
  const liveSeasonRes = await request(app)
    .post('/api/seasons')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Live Completed ${Date.now()}`, leagueId, startDate: '2024-01-01', endDate: '2024-06-30' });
  liveCompletedSeasonId = liveSeasonRes.body.id;

  const teamRes = await request(app)
    .post(`/api/teams/season/${liveCompletedSeasonId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Copy Team A ${Date.now()}` });
  teamId = teamRes.body.id;

  const teamRes2 = await request(app)
    .post(`/api/teams/season/${liveCompletedSeasonId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Copy Team B ${Date.now()}` });
  teamId2 = teamRes2.body.id;

  await request(app)
    .put(`/api/seasons/${liveCompletedSeasonId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'COMPLETED' });

  // Archived season with its own team, to prove copyable-teams works post-archive
  const archivedSeasonRes = await request(app)
    .post('/api/seasons')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `To Archive ${Date.now()}`, leagueId, startDate: '2023-01-01', endDate: '2023-06-30' });
  archivedSeasonId = archivedSeasonRes.body.id;

  const archivedTeamRes = await request(app)
    .post(`/api/teams/season/${archivedSeasonId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Archived Copy Team ${Date.now()}` });
  archivedTeamId = archivedTeamRes.body.id;

  const archivedTeamRes2 = await request(app)
    .post(`/api/teams/season/${archivedSeasonId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Archived Copy Team 2 ${Date.now()}` });

  await request(app)
    .put(`/api/seasons/${archivedSeasonId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'COMPLETED' });
  await request(app)
    .post(`/api/seasons/${archivedSeasonId}/archive`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  void archivedTeamRes2;

  // Still-DRAFT season, invalid as a copy source
  const draftSeasonRes = await request(app)
    .post('/api/seasons')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Draft Source ${Date.now()}`, leagueId, startDate: '2025-01-01', endDate: '2025-06-30' });
  draftSeasonId = draftSeasonRes.body.id;

  // Target season the teams get copied into
  const newSeasonRes = await request(app)
    .post('/api/seasons')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `New Season ${Date.now()}`, leagueId, startDate: '2026-01-01', endDate: '2026-06-30' });
  newSeasonId = newSeasonRes.body.id;
});

afterAll(async () => {
  await prisma.seasonArchivePlayerStat.deleteMany({ where: { seasonId: archivedSeasonId } }).catch(() => {});
  await prisma.seasonArchiveStanding.deleteMany({ where: { seasonId: archivedSeasonId } }).catch(() => {});
  await prisma.seasonTeam.deleteMany({ where: { seasonId: { in: [liveCompletedSeasonId, newSeasonId] } } }).catch(() => {});
  await prisma.game.deleteMany({ where: { seasonId: { in: [liveCompletedSeasonId, archivedSeasonId, newSeasonId] } } }).catch(() => {});
  if (teamId) await prisma.team.delete({ where: { id: teamId } }).catch(() => {});
  if (teamId2) await prisma.team.delete({ where: { id: teamId2 } }).catch(() => {});
  if (archivedTeamId) await prisma.team.delete({ where: { id: archivedTeamId } }).catch(() => {});
  for (const id of [liveCompletedSeasonId, archivedSeasonId, draftSeasonId, newSeasonId]) {
    if (id) await prisma.season.delete({ where: { id } }).catch(() => {});
  }
  if (leagueId) await prisma.league.delete({ where: { id: leagueId } }).catch(() => {});
  await prisma.$disconnect();
});

describe('Season copy-teams', () => {
  it('should reject a DRAFT season as a copy source', async () => {
    const res = await request(app)
      .get(`/api/seasons/${draftSeasonId}/copyable-teams`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
    expect(res.body.error).toMatch(/completed/i);
  });

  it('should list teams from a live COMPLETED season', async () => {
    const res = await request(app)
      .get(`/api/seasons/${liveCompletedSeasonId}/copyable-teams`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const ids = res.body.map((t: { id: number }) => t.id);
    expect(ids).toContain(teamId);
    expect(ids).toContain(teamId2);
  });

  it('should list teams from an archived season via the archive snapshot', async () => {
    const res = await request(app)
      .get(`/api/seasons/${archivedSeasonId}/copyable-teams`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const ids = res.body.map((t: { id: number }) => t.id);
    expect(ids).toContain(archivedTeamId);
    expect(ids.length).toBe(2);
  });

  it('should copy selected teams into the new season, reusing the same Team rows', async () => {
    const res = await request(app)
      .post(`/api/seasons/${newSeasonId}/copy-teams`)
      .set('Authorization', `Bearer ${token}`)
      .send({ teamIds: [teamId, archivedTeamId] })
      .expect(201);

    const ids = res.body.teams.map((t: { id: number }) => t.id);
    expect(ids).toContain(teamId);
    expect(ids).toContain(archivedTeamId);

    const seasonTeams = await prisma.seasonTeam.findMany({ where: { seasonId: newSeasonId } });
    expect(seasonTeams.map((st) => st.teamId).sort()).toEqual([teamId, archivedTeamId].sort());

    // the source team should still be attached to its original season too (reuse, not move)
    const originalLink = await prisma.seasonTeam.findUnique({
      where: { seasonId_teamId: { seasonId: liveCompletedSeasonId, teamId } },
    });
    expect(originalLink).not.toBeNull();
  });

  it('should be idempotent (skip duplicates) when copying an already-added team again', async () => {
    await request(app)
      .post(`/api/seasons/${newSeasonId}/copy-teams`)
      .set('Authorization', `Bearer ${token}`)
      .send({ teamIds: [teamId] })
      .expect(201);

    const seasonTeams = await prisma.seasonTeam.findMany({
      where: { seasonId: newSeasonId, teamId },
    });
    expect(seasonTeams.length).toBe(1);
  });

  it('should reject copying into an archived season', async () => {
    const res = await request(app)
      .post(`/api/seasons/${archivedSeasonId}/copy-teams`)
      .set('Authorization', `Bearer ${token}`)
      .send({ teamIds: [teamId2] })
      .expect(400);
    expect(res.body.error).toMatch(/archived/i);
  });

  it('should reject an empty teamIds array', async () => {
    await request(app)
      .post(`/api/seasons/${newSeasonId}/copy-teams`)
      .set('Authorization', `Bearer ${token}`)
      .send({ teamIds: [] })
      .expect(400);
  });

  it('should require authentication for copy-teams', async () => {
    await request(app)
      .post(`/api/seasons/${newSeasonId}/copy-teams`)
      .send({ teamIds: [teamId2] })
      .expect(401);
  });
});
