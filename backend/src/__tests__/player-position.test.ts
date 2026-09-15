import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import prisma from '../config/database.js';

// Positions are a fixed list per sport. These cover what the CRUD tests do not:
// the sport comes from seasons a visitor cannot see, a move to another sport
// drops a position that no longer exists there, and tournaments follow their
// series' sport.

const stamp = Date.now();
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
let adminToken: string;

beforeAll(async () => {
  const email = `admin-position-${stamp}@test.com`;
  await prisma.user.create({
    data: {
      email,
      password: await bcrypt.hash('password123', 10),
      name: 'Position Admin',
      role: 'ADMIN',
      active: true,
      emailVerified: true,
    },
  });
  const login = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
  adminToken = login.body.token;
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function teamInSeason(sportType: string, visibility: 'PUBLIC' | 'UNLISTED') {
  const league = await request(app).post('/api/leagues').set(auth(adminToken))
    .send({ name: `Position ${sportType} ${stamp}`, sportType });
  const season = await request(app).post('/api/seasons').set(auth(adminToken))
    .send({ name: `Position Season ${stamp}`, leagueId: league.body.id, startDate: '2026-09-01', endDate: '2027-04-30', visibility });
  const team = await request(app).post(`/api/teams/season/${season.body.id}`).set(auth(adminToken))
    .send({ name: `Position Team ${sportType} ${stamp}` });
  return team.body.id as string;
}

describe('league player positions', () => {
  it('reports the sport of an unlisted season to every viewer', async () => {
    const teamId = await teamInSeason('HOCKEY', 'UNLISTED');

    const res = await request(app).get(`/api/teams/${teamId}`).expect(200);
    expect(res.body.seasonTeams).toHaveLength(0);
    expect(res.body.sportTypes).toEqual(['HOCKEY']);
  });

  it('drops a position the target team\'s sport does not have when a player moves', async () => {
    const hockeyTeam = await teamInSeason('HOCKEY', 'PUBLIC');
    const tennisTeam = await teamInSeason('TENNIS', 'PUBLIC');
    const secondHockeyTeam = await teamInSeason('HOCKEY', 'PUBLIC');

    const player = await request(app).post(`/api/players/team/${hockeyTeam}`).set(auth(adminToken))
      .send({ name: 'Mover', position: 'GOALIE' })
      .expect(201);

    const kept = await request(app).patch(`/api/players/${player.body.id}/move`).set(auth(adminToken))
      .send({ targetTeamId: secondHockeyTeam })
      .expect(200);
    expect(kept.body.position).toBe('GOALIE');

    const dropped = await request(app).patch(`/api/players/${player.body.id}/move`).set(auth(adminToken))
      .send({ targetTeamId: tennisTeam })
      .expect(200);
    expect(dropped.body.position).toBeNull();
  });

  it('allows no position at all for a sport without a list', async () => {
    const tennisTeam = await teamInSeason('TENNIS', 'PUBLIC');

    await request(app).post(`/api/players/team/${tennisTeam}`).set(auth(adminToken))
      .send({ name: 'Tennis Player', position: 'FORWARD' })
      .expect(400);
  });
});

describe('tournament player positions', () => {
  async function tournamentTeam(sportType: string) {
    const series = await request(app).post('/api/tournaments/series').set(auth(adminToken))
      .send({ name: `Position Series ${sportType} ${stamp}`, sportType });
    const tournament = await request(app).post(`/api/tournaments/series/${series.body.id}/tournaments`).set(auth(adminToken))
      .send({ name: `Position Cup ${stamp}` });
    const team = await request(app).post(`/api/tournaments/${tournament.body.id}/teams`).set(auth(adminToken))
      .send({ name: `Position Cup Team ${stamp}` });
    return team.body.id as string;
  }

  it('follows the series sport on create and update', async () => {
    const teamId = await tournamentTeam('FOOTBALL');

    const player = await request(app).post(`/api/tournaments/teams/${teamId}/players`).set(auth(adminToken))
      .send({ name: 'Midfield', position: 'MIDFIELDER' })
      .expect(201);
    expect(player.body.position).toBe('MIDFIELDER');

    await request(app).put(`/api/tournaments/players/${player.body.id}`).set(auth(adminToken))
      .send({ position: 'LIBERO' })
      .expect(400);

    const cleared = await request(app).put(`/api/tournaments/players/${player.body.id}`).set(auth(adminToken))
      .send({ position: null })
      .expect(200);
    expect(cleared.body.position).toBeNull();
  });

  it('rejects free text', async () => {
    const teamId = await tournamentTeam('HOCKEY');

    await request(app).post(`/api/tournaments/teams/${teamId}/players`).set(auth(adminToken))
      .send({ name: 'Old Style', position: 'Útočník' })
      .expect(400);
  });
});
