import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import prisma from '../config/database.js';

/**
 * `canAdminister` on GET /teams/:id tells the UI whether this viewer may invite
 * the team's manager or delete the team. It must answer exactly what
 * requireTeamAdmin accepts, or the UI offers buttons the API refuses.
 */

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
  return { email, token: login.body.token as string };
}

let admin: { email: string; token: string };
let leagueManager: { email: string; token: string };
let otherLeagueManager: { email: string; token: string };
let teamManager: { email: string; token: string };
let leagueId: string;
let otherLeagueId: string;
let seasonId: string;
let teamId: string;

const canAdminister = async (token?: string): Promise<boolean> => {
  const req = request(app).get(`/api/teams/${teamId}`);
  if (token) req.set('Authorization', `Bearer ${token}`);
  const res = await req;
  expect(res.status).toBe(200);
  return res.body.canAdminister;
};

beforeAll(async () => {
  admin = await account('ta-admin', 'ADMIN');
  leagueManager = await account('ta-league');
  otherLeagueManager = await account('ta-other-league');
  teamManager = await account('ta-team');

  const league = await request(app)
    .post('/api/leagues')
    .set('Authorization', `Bearer ${leagueManager.token}`)
    .send({ name: `Administer League ${stamp}`, sportType: 'HOCKEY' });
  leagueId = league.body.id;

  const otherLeague = await request(app)
    .post('/api/leagues')
    .set('Authorization', `Bearer ${otherLeagueManager.token}`)
    .send({ name: `Other League ${stamp}`, sportType: 'HOCKEY' });
  otherLeagueId = otherLeague.body.id;

  const season = await request(app)
    .post('/api/seasons')
    .set('Authorization', `Bearer ${leagueManager.token}`)
    .send({
      name: `Administer Season ${stamp}`,
      leagueId,
      startDate: '2026-01-01',
      endDate: '2026-06-30',
      visibility: 'PUBLIC',
    });
  seasonId = season.body.id;

  const team = await request(app)
    .post(`/api/teams/season/${seasonId}`)
    .set('Authorization', `Bearer ${leagueManager.token}`)
    .send({ name: `Administer Team ${stamp}` });
  teamId = team.body.id;

  const manager = await prisma.user.findUnique({ where: { email: teamManager.email } });
  await prisma.team.update({ where: { id: teamId }, data: { managerId: manager!.id } });
});

afterAll(async () => {
  if (teamId) await prisma.team.delete({ where: { id: teamId } }).catch(() => {});
  if (seasonId) await prisma.season.delete({ where: { id: seasonId } }).catch(() => {});
  if (leagueId) await prisma.league.delete({ where: { id: leagueId } }).catch(() => {});
  if (otherLeagueId) await prisma.league.delete({ where: { id: otherLeagueId } }).catch(() => {});
  await prisma.user.deleteMany({
    where: { email: { in: [admin.email, leagueManager.email, otherLeagueManager.email, teamManager.email] } },
  });
  await prisma.$disconnect();
});

describe('GET /api/teams/:id - canAdminister', () => {
  it('is true for an admin', async () => {
    expect(await canAdminister(admin.token)).toBe(true);
  });

  it('is true for the manager of a league the team plays in', async () => {
    expect(await canAdminister(leagueManager.token)).toBe(true);
  });

  it('is false for the manager of another league', async () => {
    expect(await canAdminister(otherLeagueManager.token)).toBe(false);
  });

  it("is false for the team's own manager", async () => {
    expect(await canAdminister(teamManager.token)).toBe(false);
  });

  it('is false for a visitor', async () => {
    expect(await canAdminister()).toBe(false);
  });
});

describe('POST /api/teams/:id/invite-manager agrees with canAdminister', () => {
  it('refuses the manager of another league', async () => {
    const res = await request(app)
      .post(`/api/teams/${teamId}/invite-manager`)
      .set('Authorization', `Bearer ${otherLeagueManager.token}`)
      .send({ email: `invitee-${stamp}@test.com`, name: 'Invitee' });
    expect(res.status).toBe(403);
  });

  it("refuses the team's own manager", async () => {
    const res = await request(app)
      .post(`/api/teams/${teamId}/invite-manager`)
      .set('Authorization', `Bearer ${teamManager.token}`)
      .send({ email: `invitee-${stamp}@test.com`, name: 'Invitee' });
    expect(res.status).toBe(403);
  });
});
