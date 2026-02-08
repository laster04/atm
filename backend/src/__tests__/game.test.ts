import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import prisma from '../config/database.js';

async function getAdminToken(): Promise<string> {
  const email = `admin-game-${Date.now()}@test.com`;
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
let teamId: number;
let teamId2: number;
let gameId: number;

beforeAll(async () => {
  token = await getAdminToken();

  const leagueRes = await request(app)
    .post('/api/leagues')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Game Test League ${Date.now()}`, sportType: 'HOCKEY' });
  leagueId = leagueRes.body.id;

  const seasonRes = await request(app)
    .post('/api/seasons')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: `Game Test Season ${Date.now()}`,
      leagueId,
      startDate: '2025-01-01',
      endDate: '2025-06-30',
    });
  seasonId = seasonRes.body.id;

  const teamRes = await request(app)
    .post(`/api/teams/season/${seasonId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Game Team A ${Date.now()}` });
  teamId = teamRes.body.id;

  const teamRes2 = await request(app)
    .post(`/api/teams/season/${seasonId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Game Team B ${Date.now()}` });
  teamId2 = teamRes2.body.id;
});

afterAll(async () => {
  // Delete games first (they reference teams and season)
  if (seasonId) await prisma.game.deleteMany({ where: { seasonId } }).catch(() => {});
  if (teamId) await prisma.team.delete({ where: { id: teamId } }).catch(() => {});
  if (teamId2) await prisma.team.delete({ where: { id: teamId2 } }).catch(() => {});
  if (seasonId) await prisma.season.delete({ where: { id: seasonId } }).catch(() => {});
  if (leagueId) await prisma.league.delete({ where: { id: leagueId } }).catch(() => {});
  await prisma.$disconnect();
});

describe('Games CRUD', () => {
  describe('GET /api/games/season/:seasonId', () => {
    it('should return empty array for season with no games', async () => {
      const res = await request(app)
        .get(`/api/games/season/${seasonId}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0);
    });
  });

  describe('POST /api/games/season/:seasonId', () => {
    it('should create a game between two teams', async () => {
      const res = await request(app)
        .post(`/api/games/season/${seasonId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          homeTeamId: teamId,
          awayTeamId: teamId2,
          date: '2025-03-15',
          location: 'Test Arena',
          round: 1,
        })
        .expect(201);

      gameId = res.body.id;
      expect(res.body).toHaveProperty('id');
      expect(res.body.homeTeam).toHaveProperty('id', teamId);
      expect(res.body.awayTeam).toHaveProperty('id', teamId2);
      expect(res.body.location).toBe('Test Arena');
      expect(res.body.round).toBe(1);
    });

    it('should return 400 for missing teams', async () => {
      const res = await request(app)
        .post(`/api/games/season/${seasonId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);

      expect(res.body).toHaveProperty('error');
    });

    it('should return 400 for same home and away team', async () => {
      const res = await request(app)
        .post(`/api/games/season/${seasonId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ homeTeamId: teamId, awayTeamId: teamId })
        .expect(400);

      expect(res.body.error).toMatch(/different/i);
    });

    it('should return 400 for team not in season', async () => {
      // Create a team not in this season
      const otherTeamRes = await request(app)
        .post(`/api/teams/season/${seasonId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `Orphan Team ${Date.now()}` });
      const otherTeamId = otherTeamRes.body.id;

      // Remove it from the season
      await request(app)
        .delete(`/api/teams/${otherTeamId}/seasons/${seasonId}`)
        .set('Authorization', `Bearer ${token}`);

      const res = await request(app)
        .post(`/api/games/season/${seasonId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ homeTeamId: teamId, awayTeamId: otherTeamId })
        .expect(400);

      expect(res.body.error).toMatch(/must be part of this season/i);

      // Clean up
      await prisma.team.delete({ where: { id: otherTeamId } }).catch(() => {});
    });

    it('should return 404 for non-existent season', async () => {
      await request(app)
        .post('/api/games/season/999999')
        .set('Authorization', `Bearer ${token}`)
        .send({ homeTeamId: teamId, awayTeamId: teamId2 })
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(app)
        .post(`/api/games/season/${seasonId}`)
        .send({ homeTeamId: teamId, awayTeamId: teamId2 })
        .expect(401);
    });
  });

  describe('GET /api/games/season/:seasonId (after creation)', () => {
    it('should return games for the season', async () => {
      const res = await request(app)
        .get(`/api/games/season/${seasonId}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      const ids = res.body.map((g: { id: number }) => g.id);
      expect(ids).toContain(gameId);
    });

    it('should include team info in games', async () => {
      const res = await request(app)
        .get(`/api/games/season/${seasonId}`)
        .expect(200);

      const game = res.body.find((g: { id: number }) => g.id === gameId);
      expect(game).toBeDefined();
      expect(game.homeTeam).toHaveProperty('id', teamId);
      expect(game.homeTeam).toHaveProperty('name');
      expect(game.awayTeam).toHaveProperty('id', teamId2);
      expect(game.awayTeam).toHaveProperty('name');
    });
  });

  describe('GET /api/games/:id', () => {
    it('should return game with teams and season', async () => {
      const res = await request(app)
        .get(`/api/games/${gameId}`)
        .expect(200);

      expect(res.body.id).toBe(gameId);
      expect(res.body).toHaveProperty('season');
      expect(res.body).toHaveProperty('homeTeam');
      expect(res.body).toHaveProperty('awayTeam');
      expect(res.body.season).toHaveProperty('id', seasonId);
    });

    it('should return 404 for non-existent game', async () => {
      await request(app)
        .get('/api/games/999999')
        .expect(404);
    });
  });

  describe('PUT /api/games/:id', () => {
    it('should update game score and status', async () => {
      const res = await request(app)
        .put(`/api/games/${gameId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          homeScore: 3,
          awayScore: 1,
          status: 'COMPLETED',
        })
        .expect(200);

      expect(res.body.homeScore).toBe(3);
      expect(res.body.awayScore).toBe(1);
      expect(res.body.status).toBe('COMPLETED');
    });

    it('should update game location', async () => {
      const res = await request(app)
        .put(`/api/games/${gameId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ location: 'New Arena' })
        .expect(200);

      expect(res.body.location).toBe('New Arena');
    });

    it('should return 404 for non-existent game', async () => {
      await request(app)
        .put('/api/games/999999')
        .set('Authorization', `Bearer ${token}`)
        .send({ homeScore: 1 })
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(app)
        .put(`/api/games/${gameId}`)
        .send({ homeScore: 5 })
        .expect(401);
    });
  });

  describe('DELETE /api/games/:id', () => {
    it('should delete a game', async () => {
      // Create a temporary game to delete
      const createRes = await request(app)
        .post(`/api/games/season/${seasonId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ homeTeamId: teamId2, awayTeamId: teamId })
        .expect(201);

      const tempGameId = createRes.body.id;

      const res = await request(app)
        .delete(`/api/games/${tempGameId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveProperty('message');

      // Verify it's gone
      await request(app)
        .get(`/api/games/${tempGameId}`)
        .expect(404);
    });

    it('should return 404 for non-existent game', async () => {
      await request(app)
        .delete('/api/games/999999')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(app)
        .delete(`/api/games/${gameId}`)
        .expect(401);
    });
  });

  describe('POST /api/games/season/:seasonId/generate', () => {
    it('should return 400 for non-DRAFT season', async () => {
      // Set season to ACTIVE
      await prisma.season.update({
        where: { id: seasonId },
        data: { status: 'ACTIVE' },
      });

      const res = await request(app)
        .post(`/api/games/season/${seasonId}/generate`)
        .set('Authorization', `Bearer ${token}`)
        .send({ rounds: 1 })
        .expect(400);

      expect(res.body.error).toMatch(/ACTIVE|COMPLETED|reschedule/i);

      // Reset back to DRAFT
      await prisma.season.update({
        where: { id: seasonId },
        data: { status: 'DRAFT' },
      });
    });

    it('should return 400 for season with less than 2 teams', async () => {
      // Create a season with only 1 team
      const emptySeasonRes = await request(app)
        .post('/api/seasons')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: `Empty Season ${Date.now()}`,
          leagueId,
          startDate: '2025-07-01',
          endDate: '2025-12-31',
        });
      const emptySeasonId = emptySeasonRes.body.id;

      // Add only 1 team
      await request(app)
        .post(`/api/teams/season/${emptySeasonId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `Solo Team ${Date.now()}` });

      const res = await request(app)
        .post(`/api/games/season/${emptySeasonId}/generate`)
        .set('Authorization', `Bearer ${token}`)
        .send({ rounds: 1 })
        .expect(400);

      expect(res.body.error).toMatch(/at least 2 teams/i);

      // Clean up
      await prisma.season.delete({ where: { id: emptySeasonId } }).catch(() => {});
    });

    it('should generate schedule for DRAFT season with 2+ teams', async () => {
      // Delete existing games first
      await prisma.game.deleteMany({ where: { seasonId } });

      const res = await request(app)
        .post(`/api/games/season/${seasonId}/generate`)
        .set('Authorization', `Bearer ${token}`)
        .send({ rounds: 2 })
        .expect(201);

      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('games');
      expect(Array.isArray(res.body.games)).toBe(true);
      // 2 teams = 1 game per round, 2 rounds = 2 games
      expect(res.body.games.length).toBe(2);
    });

    it('should return 404 for non-existent season', async () => {
      await request(app)
        .post('/api/games/season/999999/generate')
        .set('Authorization', `Bearer ${token}`)
        .send({ rounds: 1 })
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(app)
        .post(`/api/games/season/${seasonId}/generate`)
        .send({ rounds: 1 })
        .expect(401);
    });
  });
});
