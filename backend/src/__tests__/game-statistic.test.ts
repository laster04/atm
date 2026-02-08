import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import prisma from '../config/database.js';

async function getAdminToken(): Promise<string> {
  const email = `admin-stat-${Date.now()}@test.com`;
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
let gameId: number;
let statisticId: number;

beforeAll(async () => {
  token = await getAdminToken();

  // Create league
  const leagueRes = await request(app)
    .post('/api/leagues')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Stat Test League ${Date.now()}`, sportType: 'HOCKEY' });
  leagueId = leagueRes.body.id;

  // Create season
  const seasonRes = await request(app)
    .post('/api/seasons')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: `Stat Test Season ${Date.now()}`,
      leagueId,
      startDate: '2025-01-01',
      endDate: '2025-06-30',
    });
  seasonId = seasonRes.body.id;

  // Create two teams in the season
  const teamRes = await request(app)
    .post(`/api/teams/season/${seasonId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Stat Team A ${Date.now()}` });
  teamId = teamRes.body.id;

  const teamRes2 = await request(app)
    .post(`/api/teams/season/${seasonId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Stat Team B ${Date.now()}` });
  teamId2 = teamRes2.body.id;

  // Create players on each team
  const playerRes = await request(app)
    .post(`/api/players/team/${teamId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Player Alpha', number: 10 });
  playerId = playerRes.body.id;

  const playerRes2 = await request(app)
    .post(`/api/players/team/${teamId2}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Player Beta', number: 7 });
  playerId2 = playerRes2.body.id;

  // Create a game between the two teams
  const gameRes = await request(app)
    .post(`/api/games/season/${seasonId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      homeTeamId: teamId,
      awayTeamId: teamId2,
      date: '2025-03-15',
      round: 1,
    });
  gameId = gameRes.body.id;
});

afterAll(async () => {
  // Delete in dependency order
  if (gameId) await prisma.gameStatistic.deleteMany({ where: { gameId } }).catch(() => {});
  if (gameId) await prisma.game.delete({ where: { id: gameId } }).catch(() => {});
  if (seasonId) await prisma.game.deleteMany({ where: { seasonId } }).catch(() => {});
  if (playerId) await prisma.player.delete({ where: { id: playerId } }).catch(() => {});
  if (playerId2) await prisma.player.delete({ where: { id: playerId2 } }).catch(() => {});
  if (teamId) await prisma.team.delete({ where: { id: teamId } }).catch(() => {});
  if (teamId2) await prisma.team.delete({ where: { id: teamId2 } }).catch(() => {});
  if (seasonId) await prisma.season.delete({ where: { id: seasonId } }).catch(() => {});
  if (leagueId) await prisma.league.delete({ where: { id: leagueId } }).catch(() => {});
  await prisma.$disconnect();
});

describe('Game Statistics CRUD', () => {
  describe('POST /api/game-statistics/game/:gameId', () => {
    it('should create a statistic for a player in the game', async () => {
      const res = await request(app)
        .post(`/api/game-statistics/game/${gameId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ playerId, goals: 2, assists: 1 })
        .expect(201);

      statisticId = res.body.id;
      expect(res.body).toHaveProperty('id');
      expect(res.body.goals).toBe(2);
      expect(res.body.assists).toBe(1);
      expect(res.body.playerId).toBe(playerId);
      expect(res.body.gameId).toBe(gameId);
      expect(res.body).toHaveProperty('player');
      expect(res.body.player).toHaveProperty('team');
    });

    it('should create a statistic for the away team player', async () => {
      const res = await request(app)
        .post(`/api/game-statistics/game/${gameId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ playerId: playerId2, goals: 0, assists: 3 })
        .expect(201);

      expect(res.body.playerId).toBe(playerId2);
      expect(res.body.goals).toBe(0);
      expect(res.body.assists).toBe(3);
    });

    it('should return 400 for missing playerId', async () => {
      const res = await request(app)
        .post(`/api/game-statistics/game/${gameId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ goals: 1 })
        .expect(400);

      expect(res.body).toHaveProperty('error');
    });

    it('should return 400 for duplicate player+game statistic', async () => {
      const res = await request(app)
        .post(`/api/game-statistics/game/${gameId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ playerId, goals: 1, assists: 0 })
        .expect(400);

      expect(res.body.error).toMatch(/already exists/i);
    });

    it('should return 404 for non-existent game', async () => {
      await request(app)
        .post('/api/game-statistics/game/999999')
        .set('Authorization', `Bearer ${token}`)
        .send({ playerId, goals: 1 })
        .expect(404);
    });

    it('should return 404 for non-existent player', async () => {
      await request(app)
        .post(`/api/game-statistics/game/${gameId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ playerId: 999999, goals: 1 })
        .expect(404);
    });

    it('should return 400 for player not participating in the game', async () => {
      // Create a player on a team not in this game
      const otherTeamRes = await request(app)
        .post(`/api/teams/season/${seasonId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `Other Team ${Date.now()}` });
      const otherTeamId = otherTeamRes.body.id;

      const otherPlayerRes = await request(app)
        .post(`/api/players/team/${otherTeamId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Other Player' });
      const otherPlayerId = otherPlayerRes.body.id;

      const res = await request(app)
        .post(`/api/game-statistics/game/${gameId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ playerId: otherPlayerId, goals: 1 })
        .expect(400);

      expect(res.body.error).toMatch(/not participating/i);

      // Clean up
      await prisma.player.delete({ where: { id: otherPlayerId } }).catch(() => {});
      await prisma.team.delete({ where: { id: otherTeamId } }).catch(() => {});
    });

    it('should require authentication', async () => {
      await request(app)
        .post(`/api/game-statistics/game/${gameId}`)
        .send({ playerId, goals: 1 })
        .expect(401);
    });
  });

  describe('GET /api/game-statistics/game/:gameId', () => {
    it('should return statistics for the game', async () => {
      const res = await request(app)
        .get(`/api/game-statistics/game/${gameId}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);

      // Should include player and team info
      for (const stat of res.body) {
        expect(stat).toHaveProperty('player');
        expect(stat.player).toHaveProperty('team');
      }
    });

    it('should be ordered by goals desc, assists desc', async () => {
      const res = await request(app)
        .get(`/api/game-statistics/game/${gameId}`)
        .expect(200);

      // Player Alpha has 2 goals, Player Beta has 0 goals
      expect(res.body[0].playerId).toBe(playerId);
    });
  });

  describe('GET /api/game-statistics/player/:playerId', () => {
    it('should return statistics for a player', async () => {
      const res = await request(app)
        .get(`/api/game-statistics/player/${playerId}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);

      const stat = res.body[0];
      expect(stat.playerId).toBe(playerId);
      expect(stat).toHaveProperty('game');
      expect(stat.game).toHaveProperty('homeTeam');
      expect(stat.game).toHaveProperty('awayTeam');
    });

    it('should return empty array for player with no statistics', async () => {
      // Create a player with no stats
      const noStatPlayerRes = await request(app)
        .post(`/api/players/team/${teamId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'No Stats Player' });
      const noStatPlayerId = noStatPlayerRes.body.id;

      const res = await request(app)
        .get(`/api/game-statistics/player/${noStatPlayerId}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0);

      // Clean up
      await prisma.player.delete({ where: { id: noStatPlayerId } }).catch(() => {});
    });
  });

  describe('GET /api/game-statistics/:id', () => {
    it('should return a single statistic with full relations', async () => {
      const res = await request(app)
        .get(`/api/game-statistics/${statisticId}`)
        .expect(200);

      expect(res.body.id).toBe(statisticId);
      expect(res.body).toHaveProperty('player');
      expect(res.body.player).toHaveProperty('team');
      expect(res.body).toHaveProperty('game');
      expect(res.body.game).toHaveProperty('homeTeam');
      expect(res.body.game).toHaveProperty('awayTeam');
      expect(res.body.game).toHaveProperty('season');
    });

    it('should return 404 for non-existent statistic', async () => {
      await request(app)
        .get('/api/game-statistics/999999')
        .expect(404);
    });
  });

  describe('PUT /api/game-statistics/:id', () => {
    it('should update goals and assists', async () => {
      const res = await request(app)
        .put(`/api/game-statistics/${statisticId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ goals: 5, assists: 3 })
        .expect(200);

      expect(res.body.goals).toBe(5);
      expect(res.body.assists).toBe(3);
      expect(res.body).toHaveProperty('player');
    });

    it('should update only goals', async () => {
      const res = await request(app)
        .put(`/api/game-statistics/${statisticId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ goals: 10 })
        .expect(200);

      expect(res.body.goals).toBe(10);
      // assists should remain unchanged
      expect(res.body.assists).toBe(3);
    });

    it('should return 404 for non-existent statistic', async () => {
      await request(app)
        .put('/api/game-statistics/999999')
        .set('Authorization', `Bearer ${token}`)
        .send({ goals: 1 })
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(app)
        .put(`/api/game-statistics/${statisticId}`)
        .send({ goals: 1 })
        .expect(401);
    });
  });

  describe('GET /api/game-statistics/season/:seasonId/top', () => {
    it('should return top scorers for the season', async () => {
      const res = await request(app)
        .get(`/api/game-statistics/season/${seasonId}/top`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);

      // Each entry should have player info and aggregated stats
      for (const entry of res.body) {
        expect(entry).toHaveProperty('player');
        expect(entry).toHaveProperty('goals');
        expect(entry).toHaveProperty('assists');
        expect(entry).toHaveProperty('gamesPlayed');
        expect(entry).toHaveProperty('points');
      }
    });

    it('should sort by points descending', async () => {
      const res = await request(app)
        .get(`/api/game-statistics/season/${seasonId}/top`)
        .expect(200);

      for (let i = 0; i < res.body.length - 1; i++) {
        expect(res.body[i].points).toBeGreaterThanOrEqual(res.body[i + 1].points);
      }
    });

    it('should respect limit parameter', async () => {
      const res = await request(app)
        .get(`/api/game-statistics/season/${seasonId}/top?limit=1`)
        .expect(200);

      expect(res.body.length).toBeLessThanOrEqual(1);
    });

    it('should return empty array for season with no statistics', async () => {
      // Create an empty season
      const emptySeasonRes = await request(app)
        .post('/api/seasons')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: `Empty Stat Season ${Date.now()}`,
          leagueId,
          startDate: '2025-07-01',
          endDate: '2025-12-31',
        });
      const emptySeasonId = emptySeasonRes.body.id;

      const res = await request(app)
        .get(`/api/game-statistics/season/${emptySeasonId}/top`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0);

      // Clean up
      await prisma.season.delete({ where: { id: emptySeasonId } }).catch(() => {});
    });
  });

  describe('GET /api/game-statistics/season/:seasonId/team/:teamId', () => {
    it('should return scorers for team in particular season', async () => {
      const res = await request(app)
          .get(`/api/game-statistics/season/${seasonId}/team/${teamId}`)
          .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);

      for (const entry of res.body) {
        expect(entry).toHaveProperty('player');
        expect(entry).toHaveProperty('goals');
        expect(entry).toHaveProperty('assists');
        expect(entry).toHaveProperty('gamesPlayed');
        expect(entry).toHaveProperty('points');
      }
    });

    it('should only include players belonging to the requested team', async () => {
      const res = await request(app)
          .get(`/api/game-statistics/season/${seasonId}/team/${teamId}`)
          .expect(200);

      const playerIds = res.body.map((e: { player: { id: number } }) => e.player.id);
      expect(playerIds).toContain(playerId);
      expect(playerIds).not.toContain(playerId2);

      // Every returned player should belong to the requested team
      for (const entry of res.body) {
        expect(entry.player.teamId).toBe(teamId);
      }
    });

    it('should sort by points descending', async () => {
      const res = await request(app)
          .get(`/api/game-statistics/season/${seasonId}/team/${teamId}`)
          .expect(200);

      for (let i = 0; i < res.body.length - 1; i++) {
        expect(res.body[i].points).toBeGreaterThanOrEqual(res.body[i + 1].points);
      }
    });

    it('should return empty array for team with no games in season', async () => {
      // Create a team in the season but with no games
      const lonelyTeamRes = await request(app)
          .post(`/api/teams/season/${seasonId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ name: `Lonely Team ${Date.now()}` });
      const lonelyTeamId = lonelyTeamRes.body.id;

      const res = await request(app)
          .get(`/api/game-statistics/season/${seasonId}/team/${lonelyTeamId}`)
          .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0);

      // Clean up
      await prisma.team.delete({ where: { id: lonelyTeamId } }).catch(() => {});
    });
  });

  describe('DELETE /api/game-statistics/:id', () => {
    it('should delete a statistic', async () => {
      const res = await request(app)
        .delete(`/api/game-statistics/${statisticId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveProperty('message');

      // Verify it's gone
      await request(app)
        .get(`/api/game-statistics/${statisticId}`)
        .expect(404);
    });

    it('should return 404 for non-existent statistic', async () => {
      await request(app)
        .delete('/api/game-statistics/999999')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(app)
        .delete('/api/game-statistics/1')
        .expect(401);
    });
  });
});
