import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import prisma from '../config/database.js';

const stamp = Date.now();

let adminToken: string;
let managerToken: string;
let strangerToken: string;
let managerEmail: string;
let teamId: string;
let playerId: string;

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function account(label: string, role: 'ADMIN' | 'USER' = 'USER') {
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
  const res = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
  return { email, token: res.body.token as string };
}

beforeAll(async () => {
  ({ token: adminToken } = await account('admin-public', 'ADMIN'));
  const manager = await account('manager-public');
  managerToken = manager.token;
  managerEmail = manager.email;
  ({ token: strangerToken } = await account('stranger-public'));

  const league = await request(app).post('/api/leagues').set(auth(adminToken))
    .send({ name: `Public League ${stamp}`, sportType: 'HOCKEY' });
  const season = await request(app).post('/api/seasons').set(auth(adminToken))
    .send({ name: `Public Season ${stamp}`, leagueId: league.body.id, startDate: '2026-01-01', endDate: '2027-12-31' });
  const team = await request(app).post(`/api/teams/season/${season.body.id}`).set(auth(adminToken))
    .send({ name: `Public Team ${stamp}` });
  teamId = team.body.id;

  await prisma.team.update({
    where: { id: teamId },
    data: { managerId: (await prisma.user.findUnique({ where: { email: managerEmail } }))!.id },
  });

  const player = await request(app).post(`/api/players/team/${teamId}`).set(auth(adminToken))
    .send({ name: 'Public Player', number: 8, position: 'Forward', bornYear: 2009, note: 'Ankle injury' });
  playerId = player.body.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('a roster seen by the public', () => {
  it('gives a visitor names and shirt numbers only', async () => {
    const res = await request(app).get(`/api/players/team/${teamId}`);
    expect(res.status).toBe(200);

    const [player] = res.body;
    expect(player.name).toBe('Public Player');
    expect(player.number).toBe(8);
    // Amateur rosters include minors: a birth year, a note about an injury and
    // the account behind a player are none of a visitor's business.
    expect(player.bornYear).toBeUndefined();
    expect(player.note).toBeUndefined();
    expect(player.position).toBeUndefined();
    expect(player.userId).toBeUndefined();
  });

  it('gives a signed-in stranger no more than a visitor', async () => {
    const res = await request(app).get(`/api/players/team/${teamId}`).set(auth(strangerToken));
    expect(res.body[0].bornYear).toBeUndefined();
    expect(res.body[0].note).toBeUndefined();
  });

  it('gives the team manager everything they entered', async () => {
    const res = await request(app).get(`/api/players/team/${teamId}`).set(auth(managerToken));
    const [player] = res.body;
    expect(player.bornYear).toBe(2009);
    expect(player.note).toBe('Ankle injury');
    expect(player.position).toBe('Forward');
  });
});

describe('one player seen by the public', () => {
  it('hides everything but the name and number', async () => {
    const res = await request(app).get(`/api/players/${playerId}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Public Player');
    expect(res.body.number).toBe(8);
    expect(res.body.bornYear).toBeUndefined();
    expect(res.body.note).toBeUndefined();
  });

  it('still shows the manager the whole row', async () => {
    const res = await request(app).get(`/api/players/${playerId}`).set(auth(managerToken));
    expect(res.body.bornYear).toBe(2009);
  });
});

describe('a team page seen by the public', () => {
  it('trims the roster and withholds the manager address', async () => {
    const res = await request(app).get(`/api/teams/${teamId}`);
    expect(res.status).toBe(200);

    expect(res.body.players[0].bornYear).toBeUndefined();
    expect(res.body.players[0].name).toBe('Public Player');

    // A league wants to say who runs a team; it does not want to publish their
    // inbox to anyone who opens the page.
    expect(res.body.manager.name).toBeTruthy();
    expect(res.body.manager.email).toBeUndefined();
  });

  it('gives the manager their own contact details and roster back', async () => {
    const res = await request(app).get(`/api/teams/${teamId}`).set(auth(managerToken));
    expect(res.body.manager.email).toBe(managerEmail);
    expect(res.body.players[0].bornYear).toBe(2009);
  });

  it('gives an admin the full view as well', async () => {
    const res = await request(app).get(`/api/teams/${teamId}`).set(auth(adminToken));
    expect(res.body.players[0].note).toBe('Ankle injury');
  });
});
