import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import prisma from '../config/database.js';

const stamp = Date.now();
const email = (tag: string) => `pinvite-${tag}-${stamp}@test.com`;

async function createUser(tag: string) {
  return prisma.user.create({
    data: {
      email: email(tag),
      password: await bcrypt.hash('password123', 10),
      name: `Player invite ${tag}`,
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

let seasonManagerToken: string;
let teamManagerToken: string;
let outsiderToken: string;
let leagueId: string;
let seasonId: string;
let teamId: string;

const newPlayer = async (name: string) =>
  (await prisma.player.create({ data: { name, teamId } })).id;

const invite = (playerId: string, tag: string, token = teamManagerToken) =>
  request(app)
    .post(`/api/players/${playerId}/invite`)
    .set('Authorization', `Bearer ${token}`)
    .send({ email: email(tag), locale: 'en' });

beforeAll(async () => {
  const seasonManager = await createUser('season-manager');
  const teamManager = await createUser('team-manager');
  const outsider = await createUser('outsider');
  seasonManagerToken = await tokenFor(seasonManager.email);
  teamManagerToken = await tokenFor(teamManager.email);
  outsiderToken = await tokenFor(outsider.email);

  const league = await prisma.league.create({
    data: { name: `Player Invite League ${stamp}`, sportType: 'HOCKEY', managerId: seasonManager.id },
  });
  leagueId = league.id;

  const seasonRes = await request(app)
    .post('/api/seasons')
    .set('Authorization', `Bearer ${seasonManagerToken}`)
    .send({ name: `Player Invite Season ${stamp}`, leagueId, startDate: '2026-09-01', endDate: '2027-03-31' });
  seasonId = seasonRes.body.id;

  const teamRes = await request(app)
    .post(`/api/teams/season/${seasonId}`)
    .set('Authorization', `Bearer ${seasonManagerToken}`)
    .send({ name: `Player Invite Team ${stamp}` });
  teamId = teamRes.body.id;
  await prisma.team.update({ where: { id: teamId }, data: { managerId: teamManager.id } });
});

afterAll(async () => {
  await prisma.managerInvite.deleteMany({ where: { player: { teamId } } }).catch(() => {});
  await prisma.player.deleteMany({ where: { teamId } }).catch(() => {});
  if (seasonId) await prisma.season.delete({ where: { id: seasonId } }).catch(() => {});
  if (teamId) await prisma.team.delete({ where: { id: teamId } }).catch(() => {});
  if (leagueId) await prisma.league.delete({ where: { id: leagueId } }).catch(() => {});
  await prisma.user.deleteMany({ where: { email: { contains: `-${stamp}@test.com` } } }).catch(() => {});
  await prisma.$disconnect();
});

describe('Inviting a player', () => {
  it("lets the team's manager invite, without linking the player yet", async () => {
    const playerId = await newPlayer('Jan Novák');
    const res = await invite(playerId, 'jan').expect(201);
    expect(res.body.invite).toMatchObject({ playerId, teamId: null, status: 'PENDING', name: 'Jan Novák' });
    expect(res.body.link).toContain('/invite/');

    const player = await prisma.player.findUnique({ where: { id: playerId } });
    expect(player?.userId).toBeNull();

    const forTeam = await request(app)
      .get(`/api/invites/team/${teamId}/players`)
      .set('Authorization', `Bearer ${teamManagerToken}`)
      .expect(200);
    expect(forTeam.body.map((i: { playerId: string }) => i.playerId)).toContain(playerId);

    const forPlayer = await request(app)
      .get(`/api/invites/player/${playerId}`)
      .set('Authorization', `Bearer ${teamManagerToken}`)
      .expect(200);
    expect(forPlayer.body.id).toBe(res.body.invite.id);

    // Player invites are not team-manager invites.
    const season = await request(app)
      .get(`/api/invites/season/${seasonId}`)
      .set('Authorization', `Bearer ${seasonManagerToken}`)
      .expect(200);
    expect(season.body.map((i: { id: string }) => i.id)).not.toContain(res.body.invite.id);
  });

  it('refuses someone who does not manage the team', async () => {
    const playerId = await newPlayer('Nobody');
    await invite(playerId, 'nobody', outsiderToken).expect(403);
    await request(app)
      .get(`/api/invites/team/${teamId}/players`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);
  });

  it('needs an email and a player without an account', async () => {
    const playerId = await newPlayer('Linked Already');
    await request(app)
      .post(`/api/players/${playerId}/invite`)
      .set('Authorization', `Bearer ${teamManagerToken}`)
      .send({})
      .expect(400);

    const holder = await createUser('holder');
    await prisma.player.update({ where: { id: playerId }, data: { userId: holder.id } });
    const res = await invite(playerId, 'linked').expect(409);
    expect(res.body.code).toBe('PLAYER_LINKED');
  });

  it('creates the account and links the player on accept', async () => {
    const playerId = await newPlayer('Petr Svoboda');
    const sent = await invite(playerId, 'petr').expect(201);
    const token = tokenFromLink(sent.body.link);

    const preview = await request(app).get(`/api/invites/token/${token}`).expect(200);
    expect(preview.body).toMatchObject({ status: 'PENDING', kind: 'PLAYER', hasAccount: false, name: 'Petr Svoboda' });
    expect(preview.body.team.id).toBe(teamId);
    expect(preview.body.player.name).toBe('Petr Svoboda');

    const accepted = await request(app)
      .post(`/api/invites/token/${token}/accept`)
      .send({ password: 'secret123' })
      .expect(201);
    expect(accepted.body).toMatchObject({ kind: 'PLAYER', teamId, playerId });
    expect(accepted.body.session.token).toBeTruthy();
    // A player manages nothing.
    expect(accepted.body.session.user.manages.teams).toBe(0);

    const player = await prisma.player.findUnique({ where: { id: playerId }, include: { user: true } });
    expect(player?.user?.email).toBe(email('petr'));
    expect(player?.user?.emailVerified).toBe(true);
  });

  it('links an existing account once they sign in', async () => {
    const existing = await createUser('existing');
    const playerId = await newPlayer('Existing Player');
    const sent = await request(app)
      .post(`/api/players/${playerId}/invite`)
      .set('Authorization', `Bearer ${teamManagerToken}`)
      .send({ email: existing.email })
      .expect(201);
    const token = tokenFromLink(sent.body.link);

    const anonymous = await request(app).post(`/api/invites/token/${token}/accept`).send({}).expect(401);
    expect(anonymous.body.code).toBe('SIGN_IN_REQUIRED');

    await request(app)
      .post(`/api/invites/token/${token}/accept`)
      .set('Authorization', `Bearer ${await tokenFor(existing.email)}`)
      .send({})
      .expect(200);

    const player = await prisma.player.findUnique({ where: { id: playerId } });
    expect(player?.userId).toBe(existing.id);
  });

  it('refuses a second spot on the same team and leaves the invite open', async () => {
    const twice = await createUser('twice');
    const first = await newPlayer('Twice A');
    await prisma.player.update({ where: { id: first }, data: { userId: twice.id } });
    const second = await newPlayer('Twice B');
    const sent = await request(app)
      .post(`/api/players/${second}/invite`)
      .set('Authorization', `Bearer ${teamManagerToken}`)
      .send({ email: twice.email })
      .expect(201);

    const res = await request(app)
      .post(`/api/invites/token/${tokenFromLink(sent.body.link)}/accept`)
      .set('Authorization', `Bearer ${await tokenFor(twice.email)}`)
      .send({})
      .expect(409);
    expect(res.body.code).toBe('ALREADY_ON_TEAM');

    const stored = await prisma.managerInvite.findUnique({ where: { id: sent.body.invite.id } });
    expect(stored?.acceptedAt).toBeNull();
    const player = await prisma.player.findUnique({ where: { id: second } });
    expect(player?.userId).toBeNull();
  });

  it('refuses when the player was linked by hand in the meantime', async () => {
    const playerId = await newPlayer('Raced');
    const sent = await invite(playerId, 'raced').expect(201);
    const other = await createUser('other');
    await prisma.player.update({ where: { id: playerId }, data: { userId: other.id } });

    const res = await request(app)
      .post(`/api/invites/token/${tokenFromLink(sent.body.link)}/accept`)
      .send({ password: 'secret123' })
      .expect(409);
    expect(res.body.code).toBe('PLAYER_TAKEN');
    // The account made on the way is rolled back with the rest.
    expect(await prisma.user.findUnique({ where: { email: email('raced') } })).toBeNull();
  });

  it("lets the team's manager resend and cancel", async () => {
    const playerId = await newPlayer('Resend Me');
    const sent = await invite(playerId, 'resend').expect(201);

    await request(app)
      .post(`/api/invites/${sent.body.invite.id}/resend`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);
    const resent = await request(app)
      .post(`/api/invites/${sent.body.invite.id}/resend`)
      .set('Authorization', `Bearer ${teamManagerToken}`)
      .expect(200);
    await request(app).get(`/api/invites/token/${tokenFromLink(sent.body.link)}`).expect(404);

    await request(app)
      .delete(`/api/invites/${sent.body.invite.id}`)
      .set('Authorization', `Bearer ${teamManagerToken}`)
      .expect(200);
    const res = await request(app)
      .post(`/api/invites/token/${tokenFromLink(resent.body.link)}/accept`)
      .send({ password: 'secret123' })
      .expect(410);
    expect(res.body.code).toBe('REVOKED');
  });
});
