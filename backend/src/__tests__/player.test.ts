import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import prisma from '../config/database.js';

async function getAdminToken(): Promise<string> {
  const email = `admin-player-${Date.now()}@test.com`;
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
let playerId: number;
let playerId2: number;

beforeAll(async () => {
  token = await getAdminToken();

  const leagueRes = await request(app)
    .post('/api/leagues')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Player Test League ${Date.now()}`, sportType: 'HOCKEY' });
  leagueId = leagueRes.body.id;

  const seasonRes = await request(app)
    .post('/api/seasons')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: `Player Test Season ${Date.now()}`,
      leagueId,
      startDate: '2025-01-01',
      endDate: '2025-06-30',
    });
  seasonId = seasonRes.body.id;

  const teamRes = await request(app)
    .post(`/api/teams/season/${seasonId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Player Test Team A ${Date.now()}` });
  teamId = teamRes.body.id;

  const teamRes2 = await request(app)
    .post(`/api/teams/season/${seasonId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Player Test Team B ${Date.now()}` });
  teamId2 = teamRes2.body.id;
});

afterAll(async () => {
  if (playerId) await prisma.player.delete({ where: { id: playerId } }).catch(() => {});
  if (playerId2) await prisma.player.delete({ where: { id: playerId2 } }).catch(() => {});
  if (teamId) await prisma.team.delete({ where: { id: teamId } }).catch(() => {});
  if (teamId2) await prisma.team.delete({ where: { id: teamId2 } }).catch(() => {});
  if (seasonId) await prisma.season.delete({ where: { id: seasonId } }).catch(() => {});
  if (leagueId) await prisma.league.delete({ where: { id: leagueId } }).catch(() => {});
  await prisma.$disconnect();
});

describe('Players CRUD', () => {
  describe('GET /api/players/team/:teamId', () => {
    it('should return empty array for team with no players', async () => {
      const res = await request(app)
        .get(`/api/players/team/${teamId}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0);
    });
  });

  describe('POST /api/players/team/:teamId', () => {
    it('should create a player with full data', async () => {
      const res = await request(app)
        .post(`/api/players/team/${teamId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'John Doe',
          number: 10,
          position: 'Forward',
          bornYear: 1995,
          note: 'Star player',
        })
        .expect(201);

      playerId = res.body.id;
      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('John Doe');
      expect(res.body.number).toBe(10);
      expect(res.body.position).toBe('Forward');
      expect(res.body.bornYear).toBe(1995);
      expect(res.body.note).toBe('Star player');
      expect(res.body.teamId).toBe(teamId);
    });

    it('should create a second player with minimal data', async () => {
      const res = await request(app)
        .post(`/api/players/team/${teamId2}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Jane Smith' })
        .expect(201);

      playerId2 = res.body.id;
      expect(res.body.name).toBe('Jane Smith');
      expect(res.body.number).toBeNull();
      expect(res.body.position).toBeNull();
    });

    it('should return 400 for missing name', async () => {
      const res = await request(app)
        .post(`/api/players/team/${teamId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ number: 5 })
        .expect(400);

      expect(res.body).toHaveProperty('error');
    });

    it('should return 404 for non-existent team', async () => {
      await request(app)
        .post('/api/players/team/999999')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Nobody' })
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(app)
        .post(`/api/players/team/${teamId}`)
        .send({ name: 'Unauthorized' })
        .expect(401);
    });
  });

  describe('GET /api/players/team/:teamId (after creation)', () => {
    it('should return players for the team', async () => {
      const res = await request(app)
        .get(`/api/players/team/${teamId}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      const ids = res.body.map((p: { id: number }) => p.id);
      expect(ids).toContain(playerId);
    });
  });

  describe('GET /api/players/:id', () => {
    it('should return player with team and season info', async () => {
      const res = await request(app)
        .get(`/api/players/${playerId}`)
        .expect(200);

      expect(res.body.id).toBe(playerId);
      expect(res.body.name).toBe('John Doe');
      expect(res.body).toHaveProperty('team');
      expect(res.body.team).toHaveProperty('id', teamId);
      expect(res.body.team).toHaveProperty('season');
    });

    it('should return 404 for non-existent player', async () => {
      await request(app)
        .get('/api/players/999999')
        .expect(404);
    });
  });

  describe('PUT /api/players/:id', () => {
    it('should update player fields', async () => {
      const res = await request(app)
        .put(`/api/players/${playerId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'John Updated',
          number: 99,
          position: 'Goalkeeper',
        })
        .expect(200);

      expect(res.body.name).toBe('John Updated');
      expect(res.body.number).toBe(99);
      expect(res.body.position).toBe('Goalkeeper');
    });

    it('should return 404 for non-existent player', async () => {
      await request(app)
        .put('/api/players/999999')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Ghost' })
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(app)
        .put(`/api/players/${playerId}`)
        .send({ name: 'Unauthorized' })
        .expect(401);
    });
  });

  describe('PATCH /api/players/:id/move', () => {
    it('should move player to another team', async () => {
      const res = await request(app)
        .patch(`/api/players/${playerId}/move`)
        .set('Authorization', `Bearer ${token}`)
        .send({ targetTeamId: teamId2 })
        .expect(200);

      expect(res.body.teamId).toBe(teamId2);
      expect(res.body.team).toHaveProperty('id', teamId2);
    });

    it('should return 400 for missing targetTeamId', async () => {
      const res = await request(app)
        .patch(`/api/players/${playerId}/move`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);

      expect(res.body).toHaveProperty('error');
    });

    it('should return 400 when moving to same team', async () => {
      const res = await request(app)
        .patch(`/api/players/${playerId}/move`)
        .set('Authorization', `Bearer ${token}`)
        .send({ targetTeamId: teamId2 })
        .expect(400);

      expect(res.body.error).toMatch(/already/i);
    });

    it('should return 404 for non-existent player', async () => {
      await request(app)
        .patch('/api/players/999999/move')
        .set('Authorization', `Bearer ${token}`)
        .send({ targetTeamId: teamId })
        .expect(404);
    });

    it('should return 404 for non-existent target team', async () => {
      await request(app)
        .patch(`/api/players/${playerId}/move`)
        .set('Authorization', `Bearer ${token}`)
        .send({ targetTeamId: 999999 })
        .expect(404);
    });

    it('should move player back for cleanup', async () => {
      await request(app)
        .patch(`/api/players/${playerId}/move`)
        .set('Authorization', `Bearer ${token}`)
        .send({ targetTeamId: teamId })
        .expect(200);
    });

    it('should require authentication', async () => {
      await request(app)
        .patch(`/api/players/${playerId}/move`)
        .send({ targetTeamId: teamId2 })
        .expect(401);
    });
  });

  describe('DELETE /api/players/:id', () => {
    it('should delete a player', async () => {
      // Create a temporary player to delete
      const createRes = await request(app)
        .post(`/api/players/team/${teamId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Temp Player' })
        .expect(201);

      const tempId = createRes.body.id;

      const res = await request(app)
        .delete(`/api/players/${tempId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveProperty('message');

      // Verify it's gone
      await request(app)
        .get(`/api/players/${tempId}`)
        .expect(404);
    });

    it('should return 404 for non-existent player', async () => {
      await request(app)
        .delete('/api/players/999999')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(app)
        .delete(`/api/players/${playerId}`)
        .expect(401);
    });
  });
});
