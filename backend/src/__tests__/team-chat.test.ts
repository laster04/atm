import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import prisma from '../config/database.js';

const stamp = Date.now();
const CHAT = 'https://chat.whatsapp.com/AbCdEf123456';

let adminToken: string;
let managerToken: string;
let playerToken: string;
let strangerToken: string;
let seasonId: string;
let teamId: string;

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function account(label: string, role: 'ADMIN' | 'USER' = 'USER') {
  const email = `${label}-${stamp}@test.com`;
  const user = await prisma.user.create({
    data: {
      email,
      password: await bcrypt.hash('password123', 10),
      name: label,
      role,
      active: true,
      emailVerified: true,
    },
  });
  const res = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
  return { id: user.id, token: res.body.token as string };
}

beforeAll(async () => {
  ({ token: adminToken } = await account('admin-chat', 'ADMIN'));
  const manager = await account('manager-chat');
  managerToken = manager.token;
  const player = await account('player-chat');
  playerToken = player.token;
  ({ token: strangerToken } = await account('stranger-chat'));

  const league = await request(app).post('/api/leagues').set(auth(adminToken))
    .send({ name: `Chat League ${stamp}`, sportType: 'HOCKEY' });
  const season = await request(app).post('/api/seasons').set(auth(adminToken))
    .send({ name: `Chat Season ${stamp}`, leagueId: league.body.id, startDate: '2026-01-01', endDate: '2027-12-31' });
  seasonId = season.body.id;
  const team = await request(app).post(`/api/teams/season/${seasonId}`).set(auth(adminToken))
    .send({ name: `Chat Team ${stamp}` });
  teamId = team.body.id;

  await prisma.team.update({ where: { id: teamId }, data: { managerId: manager.id } });
  await prisma.player.create({ data: { name: 'Chat Player', number: 9, teamId, userId: player.id } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('a team chat link', () => {
  it('is set by the team manager and handed back to them', async () => {
    const res = await request(app).put(`/api/teams/${teamId}`).set(auth(managerToken))
      .send({ chatUrl: `  ${CHAT}  ` });
    expect(res.status).toBe(200);
    expect(res.body.chatUrl).toBe(CHAT);
  });

  it('refuses anything but an https address', async () => {
    for (const chatUrl of ['http://chat.whatsapp.com/x', 'javascript:alert(1)', 'whatsapp group', 42]) {
      const res = await request(app).put(`/api/teams/${teamId}`).set(auth(managerToken)).send({ chatUrl });
      expect(res.status).toBe(400);
    }
    const team = await prisma.team.findUnique({ where: { id: teamId }, select: { chatUrl: true } });
    expect(team!.chatUrl).toBe(CHAT);
  });

  it('cannot be set by someone outside the team', async () => {
    const res = await request(app).put(`/api/teams/${teamId}`).set(auth(strangerToken))
      .send({ chatUrl: 'https://example.com/spam' });
    expect(res.status).toBe(403);
  });

  // Whoever holds the link can join the group, so no public listing of the
  // team may carry it.
  it('stays off every public view of the team', async () => {
    const views = await Promise.all([
      request(app).get(`/api/teams/${teamId}`),
      request(app).get(`/api/teams/${teamId}`).set(auth(strangerToken)),
      request(app).get(`/api/teams/${teamId}`).set(auth(playerToken)),
    ]);
    for (const res of views) {
      expect(res.status).toBe(200);
      expect(res.body.chatUrl).toBeUndefined();
    }

    const bySeason = await request(app).get(`/api/teams/season/${seasonId}`);
    expect(bySeason.body.find((t: { id: string }) => t.id === teamId).chatUrl).toBeUndefined();

    // The directory only lists teams of listed seasons; an admin sees them all.
    const directory = await request(app).get('/api/teams').set(auth(adminToken))
      .query({ search: `Chat Team ${stamp}` });
    expect(directory.body.items[0].chatUrl).toBeUndefined();
  });

  it('is shown on the team page to its manager', async () => {
    const res = await request(app).get(`/api/teams/${teamId}`).set(auth(managerToken));
    expect(res.body.chatUrl).toBe(CHAT);
  });

  it('reaches the players on the roster', async () => {
    const res = await request(app).get('/api/players/me').set(auth(playerToken));
    expect(res.status).toBe(200);
    expect(res.body[0].team.chatUrl).toBe(CHAT);
  });

  it('is removed by an empty value', async () => {
    const res = await request(app).put(`/api/teams/${teamId}`).set(auth(managerToken)).send({ chatUrl: '' });
    expect(res.status).toBe(200);
    expect(res.body.chatUrl).toBeNull();
  });
});
