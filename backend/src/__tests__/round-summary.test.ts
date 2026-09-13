import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import prisma from '../config/database.js';
import { buildRoundSummary, summaryRecipients } from '../services/digest/roundSummary.js';

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
let manager: { email: string; token: string };
let playerUser: { email: string; token: string };
let optedOut: { email: string; token: string };
let stranger: { email: string; token: string };

let seasonId: string;
let teamA: string;
let teamB: string;
let scorerId: string;

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

beforeAll(async () => {
  admin = await account('admin-digest', 'ADMIN');
  manager = await account('manager-digest');
  playerUser = await account('player-digest');
  optedOut = await account('optout-digest');
  stranger = await account('stranger-digest');

  const league = await request(app).post('/api/leagues').set(auth(admin.token))
    .send({ name: `Digest League ${stamp}`, sportType: 'HOCKEY' });
  const season = await request(app).post('/api/seasons').set(auth(admin.token))
    .send({ name: `Digest Season ${stamp}`, leagueId: league.body.id, startDate: '2026-01-01', endDate: '2027-12-31' });
  seasonId = season.body.id;

  const a = await request(app).post(`/api/teams/season/${seasonId}`).set(auth(admin.token))
    .send({ name: `Digest A ${stamp}` });
  teamA = a.body.id;
  const b = await request(app).post(`/api/teams/season/${seasonId}`).set(auth(admin.token))
    .send({ name: `Digest B ${stamp}` });
  teamB = b.body.id;

  // One team manager, one linked player, and one linked player who opted out.
  await prisma.team.update({ where: { id: teamA }, data: { managerId: (await prisma.user.findUnique({ where: { email: manager.email } }))!.id } });

  const scorer = await request(app).post(`/api/players/team/${teamA}`).set(auth(admin.token))
    .send({ name: 'Digest Scorer', number: 9 });
  scorerId = scorer.body.id;
  await request(app).patch(`/api/players/${scorerId}/link`).set(auth(admin.token))
    .send({ email: playerUser.email });

  const quiet = await request(app).post(`/api/players/team/${teamB}`).set(auth(admin.token))
    .send({ name: 'Quiet Player', number: 12 });
  await request(app).patch(`/api/players/${quiet.body.id}/link`).set(auth(admin.token))
    .send({ email: optedOut.email });
  await request(app).put('/api/auth/profile').set(auth(optedOut.token)).send({ emailDigest: false });

  // A played round to summarise.
  const game = await request(app).post(`/api/games/season/${seasonId}`).set(auth(admin.token))
    .send({ homeTeamId: teamA, awayTeamId: teamB, round: 1, date: '2026-02-01T18:00:00.000Z' });
  await request(app).post(`/api/games/${game.body.id}/events`).set(auth(admin.token))
    .send({ type: 'GOAL', teamId: teamA, period: 1, playerId: scorerId });
  await request(app).put(`/api/games/${game.body.id}`).set(auth(admin.token))
    .send({ status: 'COMPLETED' });
  await request(app).post(`/api/games/${game.body.id}/confirm`).set(auth(admin.token));
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('building the summary', () => {
  it('reports the round results, the table to date and the top scorers', async () => {
    const summary = await buildRoundSummary(seasonId, 1);
    expect(summary).not.toBeNull();
    expect(summary!.round).toBe(1);
    expect(summary!.results).toHaveLength(1);
    expect(summary!.results[0].homeScore).toBe(1);
    expect(summary!.results[0].awayScore).toBe(0);
    expect(summary!.results[0].confirmed).toBe(true);

    // The table is the season so far, not the round alone.
    expect(summary!.standings).toHaveLength(2);
    expect(summary!.standings[0].rank).toBe(1);
    expect(summary!.standings[0].points).toBeGreaterThan(0);

    expect(summary!.topScorers[0].name).toBe('Digest Scorer');
    expect(summary!.topScorers[0].points).toBe(1);
  });

  it('says nothing about a round with no completed games', async () => {
    expect(await buildRoundSummary(seasonId, 9)).toBeNull();
  });
});

describe('who it goes to', () => {
  it('includes the league manager, team managers and linked players', async () => {
    const recipients = await summaryRecipients(seasonId);
    const emails = recipients.map((r) => r.email);
    expect(emails).toContain(manager.email);
    expect(emails).toContain(playerUser.email);
  });

  it('leaves out anyone who turned the summary off', async () => {
    const emails = (await summaryRecipients(seasonId)).map((r) => r.email);
    expect(emails).not.toContain(optedOut.email);
  });

  it('leaves out people with nothing to do with the season', async () => {
    const emails = (await summaryRecipients(seasonId)).map((r) => r.email);
    expect(emails).not.toContain(stranger.email);
  });

  it('mails someone once even when they hold several roles in the season', async () => {
    const managerUser = await prisma.user.findUnique({ where: { email: manager.email } });
    const dual = await request(app).post(`/api/players/team/${teamA}`).set(auth(admin.token))
      .send({ name: 'Playing Manager', number: 21 });
    await request(app).patch(`/api/players/${dual.body.id}/link`).set(auth(admin.token))
      .send({ email: manager.email });

    const recipients = await summaryRecipients(seasonId);
    expect(recipients.filter((r) => r.id === managerUser!.id)).toHaveLength(1);
  });

  it('leaves out an account whose address was never confirmed', async () => {
    const unverified = await prisma.user.create({
      data: {
        email: `unverified-${stamp}@test.com`,
        password: await bcrypt.hash('password123', 10),
        name: 'Unverified',
        active: true,
        emailVerified: false,
      },
    });
    const player = await request(app).post(`/api/players/team/${teamB}`).set(auth(admin.token))
      .send({ name: 'Unverified Player', number: 31 });
    await prisma.player.update({ where: { id: player.body.id }, data: { userId: unverified.id } });

    const emails = (await summaryRecipients(seasonId)).map((r) => r.email);
    expect(emails).not.toContain(unverified.email);
  });
});

describe('the endpoints', () => {
  it('refuses a preview to someone without season access', async () => {
    const res = await request(app).get(`/api/seasons/${seasonId}/rounds/1/summary`)
      .set(auth(stranger.token));
    expect(res.status).toBe(403);
  });

  it('previews without sending anything', async () => {
    const res = await request(app).get(`/api/seasons/${seasonId}/rounds/1/summary`)
      .set(auth(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.summary.round).toBe(1);
    expect(res.body.recipientCount).toBeGreaterThan(0);
    expect(res.body.lastSent).toBeNull();
    expect(await prisma.seasonDigest.count({ where: { seasonId } })).toBe(0);
  });

  it('rejects a round that is not a positive whole number', async () => {
    const res = await request(app).get(`/api/seasons/${seasonId}/rounds/0/summary`)
      .set(auth(admin.token));
    expect(res.status).toBe(400);
  });

  it('records the send', async () => {
    const res = await request(app).post(`/api/seasons/${seasonId}/rounds/1/summary`)
      .set(auth(admin.token)).send({});
    expect(res.status).toBe(200);
    expect(res.body.round).toBe(1);
    expect(res.body.attempted).toBeGreaterThan(0);

    const record = await prisma.seasonDigest.findUnique({
      where: { seasonId_round: { seasonId, round: 1 } },
    });
    expect(record).not.toBeNull();
  });

  it('refuses to send the same round twice by accident', async () => {
    const res = await request(app).post(`/api/seasons/${seasonId}/rounds/1/summary`)
      .set(auth(admin.token)).send({});
    expect(res.status).toBe(409);
  });

  it('sends it again when asked explicitly', async () => {
    const res = await request(app).post(`/api/seasons/${seasonId}/rounds/1/summary`)
      .set(auth(admin.token)).send({ resend: true });
    expect(res.status).toBe(200);

    const records = await prisma.seasonDigest.findMany({ where: { seasonId, round: 1 } });
    // Re-sending updates the record rather than adding a second one.
    expect(records).toHaveLength(1);
  });

  it('refuses to send a round that has not been played', async () => {
    const res = await request(app).post(`/api/seasons/${seasonId}/rounds/9/summary`)
      .set(auth(admin.token)).send({});
    expect(res.status).toBe(404);
  });

  it('lists what has already gone out', async () => {
    const res = await request(app).get(`/api/seasons/${seasonId}/digests`).set(auth(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.map((d: { round: number }) => d.round)).toEqual([1]);
  });

  it('leaves a trail of the send', async () => {
    const entries = await prisma.auditLog.findMany({
      where: { entityType: 'Season', entityId: seasonId },
    });
    expect(entries.length).toBeGreaterThanOrEqual(2);
    expect(entries.some((entry) => entry.reason === 'Round summary sent')).toBe(true);
    expect(entries.some((entry) => entry.reason === 'Round summary sent again')).toBe(true);
  });
});
