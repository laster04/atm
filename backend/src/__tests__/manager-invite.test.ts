import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import prisma from '../config/database.js';

const stamp = Date.now();
const email = (tag: string) => `invite-${tag}-${stamp}@test.com`;

async function createUser(tag: string, role: 'ADMIN' | 'USER' = 'USER') {
  return prisma.user.create({
    data: {
      email: email(tag),
      password: await bcrypt.hash('password123', 10),
      name: `Invite ${tag}`,
      role,
      active: true,
      emailVerified: true,
    },
  });
}

async function tokenFor(userEmail: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email: userEmail, password: 'password123' });
  return res.body.token;
}

const tokenFromLink = (link: string) => link.split('/invite/')[1];

let adminToken: string;
let seasonManagerToken: string;
let outsiderToken: string;
let leagueId: string;
let seasonId: string;
let teamId: string;
const userIds: string[] = [];

beforeAll(async () => {
  const admin = await createUser('admin', 'ADMIN');
  const seasonManager = await createUser('season-manager');
  const outsider = await createUser('outsider');
  userIds.push(admin.id, seasonManager.id, outsider.id);
  adminToken = await tokenFor(admin.email);
  seasonManagerToken = await tokenFor(seasonManager.email);
  outsiderToken = await tokenFor(outsider.email);

  const league = await prisma.league.create({
    data: { name: `Invite League ${stamp}`, sportType: 'HOCKEY', managerId: seasonManager.id },
  });
  leagueId = league.id;

  const seasonRes = await request(app)
    .post('/api/seasons')
    .set('Authorization', `Bearer ${seasonManagerToken}`)
    .send({ name: `Invite Season ${stamp}`, leagueId, startDate: '2026-09-01', endDate: '2027-03-31' });
  seasonId = seasonRes.body.id;

  const teamRes = await request(app)
    .post(`/api/teams/season/${seasonId}`)
    .set('Authorization', `Bearer ${seasonManagerToken}`)
    .send({ name: `Invite Team ${stamp}` });
  teamId = teamRes.body.id;
});

afterAll(async () => {
  await prisma.managerInvite.deleteMany({ where: { OR: [{ teamId }, { leagueId }] } }).catch(() => {});
  if (seasonId) await prisma.season.delete({ where: { id: seasonId } }).catch(() => {});
  if (teamId) await prisma.team.delete({ where: { id: teamId } }).catch(() => {});
  if (leagueId) await prisma.league.delete({ where: { id: leagueId } }).catch(() => {});
  await prisma.user.deleteMany({ where: { email: { contains: `-${stamp}@test.com` } } }).catch(() => {});
  await prisma.$disconnect();
});

describe('Inviting a team manager', () => {
  it('lets the season manager invite, without handing the team over yet', async () => {
    const res = await request(app)
      .post(`/api/teams/${teamId}/invite-manager`)
      .set('Authorization', `Bearer ${seasonManagerToken}`)
      .send({ email: email('new-manager').toUpperCase(), name: 'New Manager', locale: 'en' })
      .expect(201);

    expect(res.body.invite.status).toBe('PENDING');
    expect(res.body.invite.email).toBe(email('new-manager'));
    expect(res.body.link).toContain('/invite/');

    const team = await prisma.team.findUnique({ where: { id: teamId } });
    expect(team?.managerId).toBeNull();

    const listed = await request(app)
      .get(`/api/invites/season/${seasonId}`)
      .set('Authorization', `Bearer ${seasonManagerToken}`)
      .expect(200);
    expect(listed.body.map((i: { teamId: string }) => i.teamId)).toContain(teamId);
  });

  it('refuses someone who does not run the season', async () => {
    await request(app)
      .post(`/api/teams/${teamId}/invite-manager`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ email: email('nope'), name: 'Nope' })
      .expect(403);
  });

  it('creates the account and signs the invitee in on accept', async () => {
    const sent = await request(app)
      .post(`/api/teams/${teamId}/invite-manager`)
      .set('Authorization', `Bearer ${seasonManagerToken}`)
      .send({ email: email('fresh'), name: 'Fresh Person' })
      .expect(201);
    const token = tokenFromLink(sent.body.link);

    const preview = await request(app).get(`/api/invites/token/${token}`).expect(200);
    expect(preview.body).toMatchObject({ status: 'PENDING', kind: 'TEAM', hasAccount: false, name: 'Fresh Person' });
    expect(preview.body.team.id).toBe(teamId);

    await request(app).post(`/api/invites/token/${token}/accept`).send({ password: '123' }).expect(400);

    const accepted = await request(app)
      .post(`/api/invites/token/${token}/accept`)
      .send({ name: 'Fresh P.', password: 'secret123' })
      .expect(201);
    expect(accepted.body.session.token).toBeTruthy();
    expect(accepted.body.session.user.manages.teams).toBe(1);

    const team = await prisma.team.findUnique({ where: { id: teamId }, include: { manager: true } });
    expect(team?.manager?.email).toBe(email('fresh'));
    expect(team?.manager?.name).toBe('Fresh P.');
    expect(team?.manager?.emailVerified).toBe(true);

    const again = await request(app).post(`/api/invites/token/${token}/accept`).send({ password: 'secret123' });
    expect(again.status).toBe(410);
    expect(again.body.code).toBe('ACCEPTED');
  });

  it('cancels the earlier pending invite when a new one is sent', async () => {
    const first = await request(app)
      .post(`/api/teams/${teamId}/invite-manager`)
      .set('Authorization', `Bearer ${seasonManagerToken}`)
      .send({ email: email('first'), name: 'First' })
      .expect(201);
    await request(app)
      .post(`/api/teams/${teamId}/invite-manager`)
      .set('Authorization', `Bearer ${seasonManagerToken}`)
      .send({ email: email('second'), name: 'Second' })
      .expect(201);

    const preview = await request(app).get(`/api/invites/token/${tokenFromLink(first.body.link)}`).expect(200);
    expect(preview.body.status).toBe('REVOKED');
  });

  it('replaces the link on resend', async () => {
    const sent = await request(app)
      .post(`/api/teams/${teamId}/invite-manager`)
      .set('Authorization', `Bearer ${seasonManagerToken}`)
      .send({ email: email('resend'), name: 'Resend' })
      .expect(201);

    await request(app)
      .post(`/api/invites/${sent.body.invite.id}/resend`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);

    const resent = await request(app)
      .post(`/api/invites/${sent.body.invite.id}/resend`)
      .set('Authorization', `Bearer ${seasonManagerToken}`)
      .expect(200);

    await request(app).get(`/api/invites/token/${tokenFromLink(sent.body.link)}`).expect(404);
    const preview = await request(app).get(`/api/invites/token/${tokenFromLink(resent.body.link)}`).expect(200);
    expect(preview.body.status).toBe('PENDING');
  });

  it('reports an expired link and refuses to accept it', async () => {
    const sent = await request(app)
      .post(`/api/teams/${teamId}/invite-manager`)
      .set('Authorization', `Bearer ${seasonManagerToken}`)
      .send({ email: email('late'), name: 'Late' })
      .expect(201);
    await prisma.managerInvite.update({ where: { id: sent.body.invite.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const token = tokenFromLink(sent.body.link);

    const preview = await request(app).get(`/api/invites/token/${token}`).expect(200);
    expect(preview.body.status).toBe('EXPIRED');
    const res = await request(app).post(`/api/invites/token/${token}/accept`).send({ password: 'secret123' }).expect(410);
    expect(res.body.code).toBe('EXPIRED');
  });

  it('stops a cancelled link from working', async () => {
    const sent = await request(app)
      .post(`/api/teams/${teamId}/invite-manager`)
      .set('Authorization', `Bearer ${seasonManagerToken}`)
      .send({ email: email('cancel'), name: 'Cancel' })
      .expect(201);
    await request(app)
      .delete(`/api/invites/${sent.body.invite.id}`)
      .set('Authorization', `Bearer ${seasonManagerToken}`)
      .expect(200);

    const res = await request(app)
      .post(`/api/invites/token/${tokenFromLink(sent.body.link)}/accept`)
      .send({ password: 'secret123' })
      .expect(410);
    expect(res.body.code).toBe('REVOKED');
  });
});

describe('Inviting someone who already has an account', () => {
  it('asks them to sign in as that account', async () => {
    const existing = await createUser('existing');
    userIds.push(existing.id);
    const sent = await request(app)
      .post(`/api/teams/${teamId}/invite-manager`)
      .set('Authorization', `Bearer ${seasonManagerToken}`)
      .send({ email: existing.email, name: 'Existing' })
      .expect(201);
    const token = tokenFromLink(sent.body.link);

    const preview = await request(app).get(`/api/invites/token/${token}`).expect(200);
    expect(preview.body.hasAccount).toBe(true);

    const anonymous = await request(app).post(`/api/invites/token/${token}/accept`).send({}).expect(401);
    expect(anonymous.body.code).toBe('SIGN_IN_REQUIRED');

    const wrong = await request(app)
      .post(`/api/invites/token/${token}/accept`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({})
      .expect(403);
    expect(wrong.body.code).toBe('WRONG_ACCOUNT');

    const ok = await request(app)
      .post(`/api/invites/token/${token}/accept`)
      .set('Authorization', `Bearer ${await tokenFor(existing.email)}`)
      .send({})
      .expect(200);
    expect(ok.body).toMatchObject({ kind: 'TEAM', teamId, session: null });

    const team = await prisma.team.findUnique({ where: { id: teamId } });
    expect(team?.managerId).toBe(existing.id);
  });
});

describe('Inviting a season manager', () => {
  it('is for administrators only and hands over the league on accept', async () => {
    await request(app)
      .post(`/api/leagues/${leagueId}/invite-manager`)
      .set('Authorization', `Bearer ${seasonManagerToken}`)
      .send({ email: email('league'), name: 'League Person' })
      .expect(403);

    const sent = await request(app)
      .post(`/api/leagues/${leagueId}/invite-manager`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: email('league'), name: 'League Person' })
      .expect(201);

    const listed = await request(app).get('/api/invites/leagues').set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(listed.body.map((i: { leagueId: string }) => i.leagueId)).toContain(leagueId);

    const accepted = await request(app)
      .post(`/api/invites/token/${tokenFromLink(sent.body.link)}/accept`)
      .send({ password: 'secret123' })
      .expect(201);
    expect(accepted.body).toMatchObject({ kind: 'LEAGUE', leagueId });

    const league = await prisma.league.findUnique({ where: { id: leagueId }, include: { manager: true } });
    expect(league?.manager?.email).toBe(email('league'));
  });
});
