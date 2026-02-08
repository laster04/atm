import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import prisma from '../config/database.js';

// Helper: register an admin user and return the token
async function getAdminToken(): Promise<string> {
  const email = `admin-test-${Date.now()}@test.com`;

  // Create admin user directly in DB
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
let seasonId2: number;
let teamId: number;
let teamId2: number;

beforeAll(async () => {
  token = await getAdminToken();

  // Create a league
  const leagueRes = await request(app)
    .post('/api/leagues')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Test League ${Date.now()}`, sportType: 'HOCKEY' });
  leagueId = leagueRes.body.id;

  // Create two seasons
  const season1Res = await request(app)
    .post('/api/seasons')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: `Season A ${Date.now()}`,
      leagueId,
      startDate: '2025-01-01',
      endDate: '2025-06-30',
    });
  seasonId = season1Res.body.id;

  const season2Res = await request(app)
    .post('/api/seasons')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: `Season B ${Date.now()}`,
      leagueId,
      startDate: '2025-07-01',
      endDate: '2025-12-31',
    });
  seasonId2 = season2Res.body.id;
});

afterAll(async () => {
  // Clean up test data
  if (seasonId) await prisma.season.delete({ where: { id: seasonId } }).catch(() => {});
  if (seasonId2) await prisma.season.delete({ where: { id: seasonId2 } }).catch(() => {});
  if (teamId) await prisma.team.delete({ where: { id: teamId } }).catch(() => {});
  if (teamId2) await prisma.team.delete({ where: { id: teamId2 } }).catch(() => {});
  if (leagueId) await prisma.league.delete({ where: { id: leagueId } }).catch(() => {});
  await prisma.$disconnect();
});

describe('Season-Team M:N Relationship', () => {
  describe('POST /api/teams/season/:seasonId - Create team in season', () => {
    it('should create a new team and associate it with a season', async () => {
      const res = await request(app)
        .post(`/api/teams/season/${seasonId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `Team Alpha ${Date.now()}` })
        .expect(201);

      teamId = res.body.id;
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('name');
    });

    it('should create a second team in the same season', async () => {
      const res = await request(app)
        .post(`/api/teams/season/${seasonId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `Team Beta ${Date.now()}` })
        .expect(201);

      teamId2 = res.body.id;
      expect(res.body).toHaveProperty('id');
    });

    it('should have created a SeasonTeam junction record', async () => {
      const seasonTeam = await prisma.seasonTeam.findUnique({
        where: { seasonId_teamId: { seasonId, teamId } },
      });
      expect(seasonTeam).not.toBeNull();
      expect(seasonTeam!.seasonId).toBe(seasonId);
      expect(seasonTeam!.teamId).toBe(teamId);
    });
  });

  describe('GET /api/teams/season/:seasonId - Get teams by season', () => {
    it('should return teams for the season', async () => {
      const res = await request(app)
        .get(`/api/teams/season/${seasonId}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const ids = res.body.map((t: { id: number }) => t.id);
      expect(ids).toContain(teamId);
      expect(ids).toContain(teamId2);
    });
  });

  describe('GET /api/seasons/:id - Get season with teams', () => {
    it('should return season with flat teams array (mapped from junction)', async () => {
      const res = await request(app)
        .get(`/api/seasons/${seasonId}`)
        .expect(200);

      expect(res.body).toHaveProperty('teams');
      expect(Array.isArray(res.body.teams)).toBe(true);
      const teamIds = res.body.teams.map((t: { id: number }) => t.id);
      expect(teamIds).toContain(teamId);
      expect(teamIds).toContain(teamId2);

      // Should NOT have seasonTeams in the response (mapped away)
      expect(res.body).not.toHaveProperty('seasonTeams');
    });
  });

  describe('GET /api/teams/:id - Get team by id', () => {
    it('should return team with seasonTeams and convenience season field', async () => {
      const res = await request(app)
        .get(`/api/teams/${teamId}`)
        .expect(200);

      expect(res.body).toHaveProperty('seasonTeams');
      expect(Array.isArray(res.body.seasonTeams)).toBe(true);
      expect(res.body.seasonTeams.length).toBeGreaterThanOrEqual(1);

      // Should have a convenience season field
      expect(res.body).toHaveProperty('season');

      // seasonTeams entries should have nested season
      const st = res.body.seasonTeams[0];
      expect(st).toHaveProperty('seasonId');
      expect(st).toHaveProperty('season');
      expect(st.season).toHaveProperty('id');
      expect(st.season).toHaveProperty('name');
    });
  });

  describe('POST /api/teams/:id/seasons/:seasonId - Add team to another season', () => {
    it('should associate an existing team with a second season', async () => {
      await request(app)
        .post(`/api/teams/${teamId}/seasons/${seasonId2}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      // Verify in DB
      const seasonTeam = await prisma.seasonTeam.findUnique({
        where: { seasonId_teamId: { seasonId: seasonId2, teamId } },
      });
      expect(seasonTeam).not.toBeNull();
    });

    it('should return 400 when team is already in the season', async () => {
      const res = await request(app)
        .post(`/api/teams/${teamId}/seasons/${seasonId2}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/already/i);
    });

    it('should return 404 for non-existent team', async () => {
      await request(app)
        .post(`/api/teams/999999/seasons/${seasonId2}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('should return 404 for non-existent season', async () => {
      await request(app)
        .post(`/api/teams/${teamId}/seasons/999999`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('team should now appear in both seasons', async () => {
      const res1 = await request(app).get(`/api/teams/season/${seasonId}`).expect(200);
      const res2 = await request(app).get(`/api/teams/season/${seasonId2}`).expect(200);

      expect(res1.body.map((t: { id: number }) => t.id)).toContain(teamId);
      expect(res2.body.map((t: { id: number }) => t.id)).toContain(teamId);
    });

    it('should require authentication', async () => {
      await request(app)
        .post(`/api/teams/${teamId}/seasons/${seasonId2}`)
        .expect(401);
    });
  });

  describe('GET /api/teams/available/:seasonId - Get available teams', () => {
    it('should return teams NOT in the given season', async () => {
      const res = await request(app)
        .get(`/api/teams/available/${seasonId}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      // teamId and teamId2 are both in seasonId, so neither should be in available list
      const ids = res.body.map((t: { id: number }) => t.id);
      expect(ids).not.toContain(teamId);
      expect(ids).not.toContain(teamId2);
    });

    it('should return 404 for non-existent season', async () => {
      await request(app)
        .get('/api/teams/available/999999')
        .expect(404);
    });
  });

  describe('GET /api/seasons/:id/standings - Standings via junction', () => {
    it('should return standings for teams in the season', async () => {
      const res = await request(app)
        .get(`/api/seasons/${seasonId}/standings`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
      // Each standing should have team info and stats
      for (const standing of res.body) {
        expect(standing).toHaveProperty('team');
        expect(standing.team).toHaveProperty('id');
        expect(standing.team).toHaveProperty('name');
        expect(standing).toHaveProperty('played');
        expect(standing).toHaveProperty('wins');
        expect(standing).toHaveProperty('points');
      }
    });
  });

  describe('POST /api/games/season/:seasonId/generate - Generate schedule', () => {
    it('should generate schedule for teams in the season via junction', async () => {
      const res = await request(app)
        .post(`/api/games/season/${seasonId}/generate`)
        .set('Authorization', `Bearer ${token}`)
        .send({ rounds: 1 })
        .expect(201);

      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('games');
      expect(Array.isArray(res.body.games)).toBe(true);
      // 2 teams = 1 game per round
      expect(res.body.games.length).toBe(1);
    });
  });

  describe('POST /api/games/season/:seasonId - Create game validates teams in season', () => {
    it('should reject a game where a team is not in the season', async () => {
      // teamId2 is in seasonId but NOT added to seasonId2 yet
      // Create a third team that's only in seasonId2
      const thirdTeamRes = await request(app)
        .post(`/api/teams/season/${seasonId2}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `Team Gamma ${Date.now()}` })
        .expect(201);

      const thirdTeamId = thirdTeamRes.body.id;

      // Try creating a game in seasonId with thirdTeam (which is only in seasonId2)
      const res = await request(app)
        .post(`/api/games/season/${seasonId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ homeTeamId: teamId, awayTeamId: thirdTeamId })
        .expect(400);

      expect(res.body.error).toMatch(/must be part of this season/i);

      // Clean up
      await prisma.team.delete({ where: { id: thirdTeamId } }).catch(() => {});
    });
  });

  describe('DELETE /api/teams/:id/seasons/:seasonId - Remove team from season', () => {
    it('should remove team from the second season and clean up games', async () => {
      await request(app)
        .delete(`/api/teams/${teamId}/seasons/${seasonId2}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Verify junction record is gone
      const seasonTeam = await prisma.seasonTeam.findUnique({
        where: { seasonId_teamId: { seasonId: seasonId2, teamId } },
      });
      expect(seasonTeam).toBeNull();
    });

    it('team should still be in the first season', async () => {
      const res = await request(app)
        .get(`/api/teams/season/${seasonId}`)
        .expect(200);

      expect(res.body.map((t: { id: number }) => t.id)).toContain(teamId);
    });

    it('team should no longer be in the second season', async () => {
      const res = await request(app)
        .get(`/api/teams/season/${seasonId2}`)
        .expect(200);

      expect(res.body.map((t: { id: number }) => t.id)).not.toContain(teamId);
    });

    it('should return 404 when removing a team not in the season', async () => {
      await request(app)
        .delete(`/api/teams/${teamId}/seasons/${seasonId2}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(app)
        .delete(`/api/teams/${teamId}/seasons/${seasonId}`)
        .expect(401);
    });
  });

  describe('Seasons list returns seasonTeams count', () => {
    it('GET /api/seasons should include _count.seasonTeams', async () => {
      const res = await request(app)
        .get('/api/seasons')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const testSeason = res.body.find((s: { id: number }) => s.id === seasonId);
      expect(testSeason).toBeDefined();
      expect(testSeason._count).toHaveProperty('seasonTeams');
      expect(typeof testSeason._count.seasonTeams).toBe('number');
    });
  });
});
