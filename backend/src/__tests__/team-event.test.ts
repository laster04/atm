import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import prisma from '../config/database.js';

const stamp = Date.now();

/** Fixtures have to be in the future for the "my calendar" filter to see them. */
const inDays = (days: number, hour = 18): string => {
	const date = new Date();
	date.setDate(date.getDate() + days);
	date.setHours(hour, 0, 0, 0);
	return date.toISOString();
};

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
let playerAccount: { email: string; token: string };
let stranger: { email: string; token: string };
let teamId: string;
let otherTeamId: string;
let gameId: string;
let linkedPlayerId: string;
let otherPlayerId: string;
let eventId: string;

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

beforeAll(async () => {
  admin = await account('admin-event', 'ADMIN');
  playerAccount = await account('player-event');
  stranger = await account('stranger-event');

  const league = await request(app).post('/api/leagues').set(auth(admin.token))
    .send({ name: `Event League ${stamp}`, sportType: 'HOCKEY' });
  const season = await request(app).post('/api/seasons').set(auth(admin.token))
    .send({ name: `Event Season ${stamp}`, leagueId: league.body.id, startDate: '2026-01-01', endDate: '2027-12-31' });

  const team = await request(app).post(`/api/teams/season/${season.body.id}`).set(auth(admin.token))
    .send({ name: `Calendar Team ${stamp}` });
  teamId = team.body.id;
  const other = await request(app).post(`/api/teams/season/${season.body.id}`).set(auth(admin.token))
    .send({ name: `Opponent ${stamp}` });
  otherTeamId = other.body.id;

  const game = await request(app).post(`/api/games/season/${season.body.id}`).set(auth(admin.token))
    .send({ homeTeamId: teamId, awayTeamId: otherTeamId, date: inDays(5) });
  gameId = game.body.id;

  const p1 = await request(app).post(`/api/players/team/${teamId}`).set(auth(admin.token))
    .send({ name: 'Linked Player', number: 4 });
  linkedPlayerId = p1.body.id;
  await request(app).patch(`/api/players/${linkedPlayerId}/link`).set(auth(admin.token))
    .send({ email: playerAccount.email });

  const p2 = await request(app).post(`/api/players/team/${teamId}`).set(auth(admin.token))
    .send({ name: 'Unlinked Player', number: 5 });
  otherPlayerId = p2.body.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('creating team events', () => {
  it('rejects an unauthenticated caller', async () => {
    const res = await request(app).post(`/api/events/team/${teamId}`)
      .send({ title: 'Training', startsAt: inDays(7) });
    expect(res.status).toBe(401);
  });

  it('rejects someone who does not manage the team', async () => {
    const res = await request(app).post(`/api/events/team/${teamId}`).set(auth(stranger.token))
      .send({ title: 'Training', startsAt: inDays(7) });
    expect(res.status).toBe(403);
  });

  it('requires a title and a valid start', async () => {
    const noTitle = await request(app).post(`/api/events/team/${teamId}`).set(auth(admin.token))
      .send({ startsAt: inDays(7) });
    expect(noTitle.status).toBe(400);

    const badDate = await request(app).post(`/api/events/team/${teamId}`).set(auth(admin.token))
      .send({ title: 'Training', startsAt: 'not a date' });
    expect(badDate.status).toBe(400);
  });

  it('refuses an event that ends before it starts', async () => {
    const res = await request(app).post(`/api/events/team/${teamId}`).set(auth(admin.token))
      .send({ title: 'Training', startsAt: inDays(7), endsAt: inDays(7, 17) });
    expect(res.status).toBe(400);
  });

  it('opens attendance for the whole roster on creation', async () => {
    const res = await request(app).post(`/api/events/team/${teamId}`).set(auth(admin.token))
      .send({ type: 'TRAINING', title: 'Tuesday ice', startsAt: inDays(7), location: 'Rink' });
    expect(res.status).toBe(201);
    eventId = res.body.id;

    expect(res.body.attendances).toHaveLength(2);
    expect(res.body.attendances.every((a: { status: string }) => a.status === 'NO_RESPONSE')).toBe(true);
  });

  it('refuses to mirror a game this team does not play in', async () => {
    const elsewhere = await request(app).post('/api/leagues').set(auth(admin.token))
      .send({ name: `Other League ${stamp}`, sportType: 'HOCKEY' });
    const season = await request(app).post('/api/seasons').set(auth(admin.token))
      .send({ name: `Other Season ${stamp}`, leagueId: elsewhere.body.id, startDate: '2026-01-01', endDate: '2027-12-31' });
    const a = await request(app).post(`/api/teams/season/${season.body.id}`).set(auth(admin.token))
      .send({ name: `Far A ${stamp}` });
    const b = await request(app).post(`/api/teams/season/${season.body.id}`).set(auth(admin.token))
      .send({ name: `Far B ${stamp}` });
    const farGame = await request(app).post(`/api/games/season/${season.body.id}`).set(auth(admin.token))
      .send({ homeTeamId: a.body.id, awayTeamId: b.body.id });

    const res = await request(app).post(`/api/events/team/${teamId}`).set(auth(admin.token))
      .send({ title: 'Not ours', startsAt: inDays(8), gameId: farGame.body.id });
    expect(res.status).toBe(400);
  });

  it('mirrors a fixture once, and refuses a second event for it', async () => {
    const first = await request(app).post(`/api/events/team/${teamId}`).set(auth(admin.token))
      .send({ type: 'MATCH', title: 'League game', startsAt: inDays(5), gameId });
    expect(first.status).toBe(201);

    const second = await request(app).post(`/api/events/team/${teamId}`).set(auth(admin.token))
      .send({ type: 'MATCH', title: 'League game again', startsAt: inDays(5), gameId });
    expect(second.status).toBe(409);
  });
});

describe('answering attendance', () => {
  it('rejects an unknown status', async () => {
    const res = await request(app).put(`/api/events/${eventId}/attendance/${linkedPlayerId}`)
      .set(auth(admin.token)).send({ status: 'PERHAPS' });
    expect(res.status).toBe(400);
  });

  it('lets the manager answer for any player on the team', async () => {
    const res = await request(app).put(`/api/events/${eventId}/attendance/${otherPlayerId}`)
      .set(auth(admin.token)).send({ status: 'ATTENDING' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ATTENDING');
    expect(res.body.respondedAt).toBeTruthy();
  });

  it('lets a linked player answer for themselves', async () => {
    const res = await request(app).put(`/api/events/${eventId}/attendance/${linkedPlayerId}`)
      .set(auth(playerAccount.token)).send({ status: 'MAYBE', note: 'Depends on work' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('MAYBE');
    expect(res.body.note).toBe('Depends on work');
  });

  it('refuses to let a player answer for someone else', async () => {
    const res = await request(app).put(`/api/events/${eventId}/attendance/${otherPlayerId}`)
      .set(auth(playerAccount.token)).send({ status: 'NOT_ATTENDING' });
    expect(res.status).toBe(403);

    const unchanged = await prisma.attendance.findUnique({
      where: { eventId_playerId: { eventId, playerId: otherPlayerId } },
    });
    expect(unchanged?.status).toBe('ATTENDING');
  });

  it('refuses an answer for a player on another team', async () => {
    const outsider = await request(app).post(`/api/players/team/${otherTeamId}`).set(auth(admin.token))
      .send({ name: 'Outsider', number: 22 });
    const res = await request(app).put(`/api/events/${eventId}/attendance/${outsider.body.id}`)
      .set(auth(admin.token)).send({ status: 'ATTENDING' });
    expect(res.status).toBe(404);
  });

  it('replaces an earlier answer rather than adding a second', async () => {
    await request(app).put(`/api/events/${eventId}/attendance/${linkedPlayerId}`)
      .set(auth(playerAccount.token)).send({ status: 'ATTENDING' });
    const rows = await prisma.attendance.findMany({ where: { eventId, playerId: linkedPlayerId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('ATTENDING');
  });
});

describe('a player\'s own calendar', () => {
  it('returns upcoming events for every roster spot with their own answer', async () => {
    const res = await request(app).get('/api/events/mine').set(auth(playerAccount.token));
    expect(res.status).toBe(200);
    const event = res.body.find((e: { id: string }) => e.id === eventId);
    expect(event).toBeDefined();
    expect(event.team.id).toBe(teamId);
    expect(event.myAttendance.status).toBe('ATTENDING');
  });

  it('returns nothing for an account holding no roster spot', async () => {
    const res = await request(app).get('/api/events/mine').set(auth(stranger.token));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('leaves out events that have already happened', async () => {
    await request(app).post(`/api/events/team/${teamId}`).set(auth(admin.token))
      .send({ title: 'Last year', startsAt: '2020-01-01T18:00:00.000Z' });
    const res = await request(app).get('/api/events/mine').set(auth(playerAccount.token));
    expect(res.body.some((e: { title: string }) => e.title === 'Last year')).toBe(false);
  });
});

describe('changing and removing events', () => {
  it('refuses an edit from someone who does not manage the team', async () => {
    const res = await request(app).put(`/api/events/${eventId}`).set(auth(stranger.token))
      .send({ title: 'Hijacked' });
    expect(res.status).toBe(403);
  });

  it('refuses a delete from someone who does not manage the team', async () => {
    const res = await request(app).delete(`/api/events/${eventId}`).set(auth(stranger.token));
    expect(res.status).toBe(403);
  });

  it('deletes the event and its answers together', async () => {
    const doomed = await request(app).post(`/api/events/team/${teamId}`).set(auth(admin.token))
      .send({ title: 'Cancelled meeting', startsAt: inDays(30) });
    const res = await request(app).delete(`/api/events/${doomed.body.id}`).set(auth(admin.token));
    expect(res.status).toBe(200);
    expect(await prisma.attendance.count({ where: { eventId: doomed.body.id } })).toBe(0);
  });
});
