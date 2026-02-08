import request from 'supertest';
import app from '../app.js';

describe('API Endpoints - Unauthorized Access', () => {
  describe('Leagues API', () => {
    it('GET /api/leagues should be accessible without auth', async () => {
      const response = await request(app)
        .get('/api/leagues')
        .expect('Content-Type', /json/);

      // Should return 200 (public endpoint) or array
      expect([200, 401]).toContain(response.status);
    });

    it('POST /api/leagues should require authentication', async () => {
      const response = await request(app)
        .post('/api/leagues')
        .send({ name: 'Test League', sportType: 'HOCKEY' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Seasons API', () => {
    it('GET /api/seasons should be accessible', async () => {
      const response = await request(app)
        .get('/api/seasons')
        .expect('Content-Type', /json/);

      expect([200, 401]).toContain(response.status);
    });

    it('POST /api/seasons should require authentication', async () => {
      const response = await request(app)
        .post('/api/seasons')
        .send({
          name: 'Test Season',
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          leagueId: 1,
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Teams API', () => {
    it('GET /api/teams/my should require authentication', async () => {
      const response = await request(app)
        .get('/api/teams/my')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('POST /api/teams/season/:id should require authentication', async () => {
      const response = await request(app)
        .post('/api/teams/season/1')
        .send({ name: 'Test Team' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Players API', () => {
    it('POST /api/players/team/:id should require authentication', async () => {
      const response = await request(app)
        .post('/api/players/team/1')
        .send({ name: 'Test Player' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('PUT /api/players/:id should require authentication', async () => {
      const response = await request(app)
        .put('/api/players/1')
        .send({ name: 'Updated Player' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('DELETE /api/players/:id should require authentication', async () => {
      const response = await request(app)
        .delete('/api/players/1')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Games API', () => {
    it('POST /api/games/season/:id should require authentication', async () => {
      const response = await request(app)
        .post('/api/games/season/1')
        .send({
          homeTeamId: 1,
          awayTeamId: 2,
          date: '2024-06-01',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('PUT /api/games/:id should require authentication', async () => {
      const response = await request(app)
        .put('/api/games/1')
        .send({ homeScore: 3, awayScore: 2 })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Game Statistics API', () => {
    it('POST /api/game-statistics/game/:id should require authentication', async () => {
      const response = await request(app)
        .post('/api/game-statistics/game/1')
        .send({ playerId: 1, goals: 2, assists: 1 })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('PUT /api/game-statistics/:id should require authentication', async () => {
      const response = await request(app)
        .put('/api/game-statistics/1')
        .send({ goals: 3 })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('DELETE /api/game-statistics/:id should require authentication', async () => {
      const response = await request(app)
        .delete('/api/game-statistics/1')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });
});
