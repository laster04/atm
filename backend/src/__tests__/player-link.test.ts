import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import prisma from '../config/database.js';

const stamp = Date.now();

async function createAccount(label: string, role: 'ADMIN' | 'USER' = 'USER'): Promise<{ email: string; token: string }> {
  const email = `${label}-${stamp}@test.com`;
  await prisma.user.create({
    data: {
      email,
      password: await bcrypt.hash('password123', 10),
      name: label,
      role,
      active: true,
      emailVerified: true,
    },
  });
  const login = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
  return { email, token: login.body.token };
}

let adminToken: string;
let teamId: string;
let playerId: string;
let otherPlayerId: string;
let playerAccount: { email: string; token: string };

beforeAll(async () => {
  ({ token: adminToken } = await createAccount('admin-link', 'ADMIN'));
  playerAccount = await createAccount('player-link');

  const league = await request(app)
    .post('/api/leagues')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: `Link League ${stamp}`, sportType: 'HOCKEY' });

  const season = await request(app)
    .post('/api/seasons')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: `Link Season ${stamp}`, leagueId: league.body.id, startDate: '2026-01-01', endDate: '2026-06-30' });

  const team = await request(app)
    .post(`/api/teams/season/${season.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: `Link Team ${stamp}` });
  teamId = team.body.id;

  const player = await request(app)
    .post(`/api/players/team/${teamId}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Linked Player', number: 9 });
  playerId = player.body.id;

  const other = await request(app)
    .post(`/api/players/team/${teamId}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Other Player', number: 10 });
  otherPlayerId = other.body.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/players/:id/link', () => {
  it('rejects an unauthenticated caller', async () => {
    const res = await request(app).patch(`/api/players/${playerId}/link`).send({ email: playerAccount.email });
    expect(res.status).toBe(401);
  });

  it('requires an email', async () => {
    const res = await request(app)
      .patch(`/api/players/${playerId}/link`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('refuses an email that has no account rather than creating one', async () => {
    const res = await request(app)
      .patch(`/api/players/${playerId}/link`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: `ghost-${stamp}@test.com` });
    expect(res.status).toBe(404);
    expect(await prisma.user.findUnique({ where: { email: `ghost-${stamp}@test.com` } })).toBeNull();
  });

  it('links a roster row to an existing account', async () => {
    const res = await request(app)
      .patch(`/api/players/${playerId}/link`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: playerAccount.email });
    expect(res.status).toBe(200);
    expect(res.body.userId).toBeTruthy();
    expect(res.body.user.email).toBe(playerAccount.email);
  });

  it('refuses to link a player that is already linked', async () => {
    const res = await request(app)
      .patch(`/api/players/${playerId}/link`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: playerAccount.email });
    expect(res.status).toBe(409);
  });

  it('refuses to give one account two roster spots in the same team', async () => {
    const res = await request(app)
      .patch(`/api/players/${otherPlayerId}/link`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: playerAccount.email });
    expect(res.status).toBe(409);
  });
});

describe('GET /api/players/me', () => {
  it('returns the roster spots the caller holds, with their team', async () => {
    const res = await request(app)
      .get('/api/players/me')
      .set('Authorization', `Bearer ${playerAccount.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(playerId);
    expect(res.body[0].team.id).toBe(teamId);
    expect(Array.isArray(res.body[0].team.seasons)).toBe(true);
  });

  it('returns nothing for an account that holds no roster spot', async () => {
    const stranger = await createAccount('stranger-link');
    const res = await request(app).get('/api/players/me').set('Authorization', `Bearer ${stranger.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('DELETE /api/players/:id/link', () => {
  it('unlinks without deleting the roster row', async () => {
    const res = await request(app)
      .delete(`/api/players/${playerId}/link`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.userId).toBeNull();

    const stillThere = await prisma.player.findUnique({ where: { id: playerId } });
    expect(stillThere?.name).toBe('Linked Player');
    expect(stillThere?.number).toBe(9);
  });

  it('leaves the account itself untouched', async () => {
    const user = await prisma.user.findUnique({ where: { email: playerAccount.email } });
    expect(user).not.toBeNull();
    expect(user?.active).toBe(true);
  });
});
