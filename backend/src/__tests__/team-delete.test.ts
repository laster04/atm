import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import prisma from '../config/database.js';

const stamp = Date.now();

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
  const login = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
  return login.body.token as string;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

let admin: string;
let manager: string;
let stranger: string;
let seasonId: string;

const createTeam = async (name: string, token = admin) => {
  const res = await request(app).post(`/api/teams/season/${seasonId}`).set(auth(token)).send({ name: `${name} ${stamp}` });
  return res.body.id as string;
};

beforeAll(async () => {
  admin = await account('admin-team-delete', 'ADMIN');
  manager = await account('manager-team-delete');
  stranger = await account('stranger-team-delete');

  // The season manager owns the league, so they run its seasons.
  const league = await request(app).post('/api/leagues').set(auth(manager))
    .send({ name: `Delete League ${stamp}`, sportType: 'HOCKEY' });
  const season = await request(app).post('/api/seasons').set(auth(manager))
    .send({ name: `Delete Season ${stamp}`, leagueId: league.body.id, startDate: '2026-09-01', endDate: '2027-04-30' });
  seasonId = season.body.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('deleting a league team', () => {
  it('lets the season manager delete a team without games', async () => {
    const teamId = await createTeam('Spare', manager);
    const res = await request(app).delete(`/api/teams/${teamId}`).set(auth(manager));
    expect(res.status).toBe(200);
    expect(await prisma.team.findUnique({ where: { id: teamId } })).toBeNull();

    const audit = await prisma.auditLog.findFirst({ where: { entityType: 'Team', entityId: teamId, action: 'DELETE' } });
    expect(audit).not.toBeNull();
  });

  it('refuses a team that has games, saying how many', async () => {
    const home = await createTeam('Home');
    const away = await createTeam('Away');
    await request(app).post(`/api/games/season/${seasonId}`).set(auth(admin))
      .send({ homeTeamId: home, awayTeamId: away, round: 1, date: '2026-10-01T18:00:00.000Z' });

    const res = await request(app).delete(`/api/teams/${away}`).set(auth(admin));
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'TEAM_HAS_GAMES', games: 1 });
    expect(await prisma.team.findUnique({ where: { id: away } })).not.toBeNull();
  });

  it('refuses someone with no hold on the team', async () => {
    const teamId = await createTeam('Guarded');
    const res = await request(app).delete(`/api/teams/${teamId}`).set(auth(stranger));
    expect(res.status).toBe(403);
  });
});
