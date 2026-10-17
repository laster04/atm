import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import prisma from '../config/database.js';
import { resetRegistrationRateLimit } from '../controllers/registrationController.js';

const stamp = Date.now();
let adminToken: string;
let applicantToken: string;
let applicantId: string;
let strangerToken: string;
let token = 0;

const auth = (value: string) => ({ Authorization: `Bearer ${value}` });
const clientToken = () => `client-${stamp}-${token++}`;

async function account(label: string, role: 'ADMIN' | 'USER' = 'USER') {
  const email = `${label}-${stamp}@test.com`;
  const user = await prisma.user.create({
    data: { email, password: await bcrypt.hash('password123', 10), name: label, role, active: true, emailVerified: true },
  });
  const res = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
  return { id: user.id, token: res.body.token as string };
}

async function season(label: string) {
  const league = await request(app).post('/api/leagues').set(auth(adminToken))
    .send({ name: `Reg League ${label} ${stamp}`, sportType: 'HOCKEY' });
  const created = await request(app).post('/api/seasons').set(auth(adminToken))
    .send({ name: `Reg ${label} ${stamp}`, leagueId: league.body.id, startDate: '2027-09-01', endDate: '2028-04-30' });
  return created.body.id as string;
}

async function tournament(label: string) {
  const series = await request(app).post('/api/tournaments/series').set(auth(adminToken))
    .send({ name: `Reg Cup ${label} ${stamp}`, sportType: 'FLOORBALL' });
  const created = await request(app).post(`/api/tournaments/series/${series.body.id}/tournaments`).set(auth(adminToken))
    .send({ name: `Reg Cup ${label} ${stamp}` });
  return created.body.id as string;
}

const settings = (kind: string, id: string, body: object) =>
  request(app).put(`/api/registrations/${kind}/${id}/settings`).set(auth(adminToken)).send(body);

const applyToSeason = (id: string, body: object, as = applicantToken) =>
  request(app).post(`/api/registrations/season/${id}`).set(auth(as)).send({ clientToken: clientToken(), ...body });

const applyToTournament = (id: string, body: object) =>
  request(app).post(`/api/registrations/tournament/${id}`)
    .send({ clientToken: clientToken(), contactName: 'Coach', email: `coach-${token}-${stamp}@test.com`, ...body });

beforeAll(async () => {
  ({ token: adminToken } = await account('admin-reg', 'ADMIN'));
  ({ token: applicantToken, id: applicantId } = await account('applicant-reg'));
  ({ token: strangerToken } = await account('stranger-reg'));
});

beforeEach(() => resetRegistrationRateLimit());

afterAll(async () => {
  await prisma.$disconnect();
});

describe('the form', () => {
  it('takes nothing until the manager opens it, and nothing after the deadline', async () => {
    const id = await season('closed');
    const form = await request(app).get(`/api/registrations/season/${id}`);
    expect(form.status).toBe(200);
    expect(form.body.state).toBe('CLOSED');
    expect((await applyToSeason(id, { teamName: 'Early Birds' })).status).toBe(409);

    await settings('season', id, { open: true, deadline: '2020-01-01T00:00:00Z' });
    expect((await request(app).get(`/api/registrations/season/${id}`)).body.state).toBe('PAST_DEADLINE');
    expect((await applyToSeason(id, { teamName: 'Late Birds' })).status).toBe(409);
  });

  it('needs an account for a season and the rules accepted', async () => {
    const id = await season('rules');
    await settings('season', id, { open: true, rules: 'Play fair.' });

    const anonymous = await request(app).post(`/api/registrations/season/${id}`)
      .send({ clientToken: clientToken(), teamName: 'Ghosts' });
    expect(anonymous.status).toBe(401);
    expect((await applyToSeason(id, { teamName: 'Ghosts' })).status).toBe(400);

    const ok = await applyToSeason(id, { teamName: 'Ghosts', acceptRules: true, primaryColor: '#112233' });
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ status: 'PENDING', applicantId, rulesVersion: 1 });
    expect(ok.body.rulesAcceptedAt).not.toBeNull();
  });

  it('bumps the rules version when the text changes', async () => {
    const id = await season('version');
    await settings('season', id, { open: true, rules: 'v1' });
    const changed = await settings('season', id, { rules: 'v2' });
    expect(changed.body.rulesVersion).toBe(2);
    const same = await settings('season', id, { rules: 'v2' });
    expect(same.body.rulesVersion).toBe(2);
  });
});

describe('a season application', () => {
  it('becomes a new team managed by the applicant', async () => {
    const id = await season('new');
    await settings('season', id, { open: true });
    const applied = await applyToSeason(id, { teamName: 'Rookies', primaryColor: '#AA0000' });
    expect(applied.status).toBe(201);

    const duplicate = await applyToSeason(id, { teamName: 'rookies' });
    expect(duplicate.status).toBe(409);

    const approved = await request(app).post(`/api/registrations/${applied.body.id}/approve`).set(auth(adminToken));
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe('APPROVED');

    const team = await prisma.team.findUnique({ where: { id: approved.body.teamId } });
    expect(team).toMatchObject({ name: 'Rookies', managerId: applicantId, primaryColor: '#AA0000' });
    expect(await prisma.seasonTeam.count({ where: { seasonId: id, teamId: team!.id } })).toBe(1);

    const again = await request(app).post(`/api/registrations/${applied.body.id}/approve`).set(auth(adminToken));
    expect(again.status).toBe(409);
  });

  it('brings back a team the applicant manages, and only theirs', async () => {
    const id = await season('returning');
    await settings('season', id, { open: true });
    const own = await prisma.team.create({ data: { name: `Veterans ${stamp}`, managerId: applicantId } });
    const foreign = await prisma.team.create({ data: { name: `Others ${stamp}` } });

    expect((await applyToSeason(id, { existingTeamId: foreign.id })).status).toBe(403);

    const applied = await applyToSeason(id, { existingTeamId: own.id });
    expect(applied.status).toBe(201);
    expect(applied.body.teamName).toBe(own.name);

    const approved = await request(app).post(`/api/registrations/${applied.body.id}/approve`).set(auth(adminToken));
    expect(approved.body.teamId).toBe(own.id);
    expect(await prisma.team.count({ where: { name: own.name } })).toBe(1);
  });

  it('waitlists past the maximum and will not approve past it', async () => {
    const id = await season('full');
    await settings('season', id, { open: true, maxTeams: 2 });
    const first = await applyToSeason(id, { teamName: 'One' });
    const second = await applyToSeason(id, { teamName: 'Two' });
    const third = await applyToSeason(id, { teamName: 'Three' });
    expect([first.body.status, second.body.status, third.body.status]).toEqual(['PENDING', 'PENDING', 'WAITLISTED']);

    const form = await request(app).get(`/api/registrations/season/${id}`);
    expect(form.body).toMatchObject({ full: true, placesTaken: 2, maxTeams: 2 });

    await request(app).post(`/api/registrations/${first.body.id}/approve`).set(auth(adminToken));
    await request(app).post(`/api/registrations/${second.body.id}/approve`).set(auth(adminToken));
    const over = await request(app).post(`/api/registrations/${third.body.id}/approve`).set(auth(adminToken));
    expect(over.status).toBe(409);
    expect(await prisma.seasonTeam.count({ where: { seasonId: id } })).toBe(2);
  });

  it('can be withdrawn by the applicant, rejected with a reason, and listed as theirs', async () => {
    const id = await season('decide');
    await settings('season', id, { open: true });
    const kept = await applyToSeason(id, { teamName: 'Keepers' });
    const pulled = await applyToSeason(id, { teamName: 'Pullers' });

    expect((await request(app).post(`/api/registrations/${pulled.body.id}/withdraw`).set(auth(strangerToken))).status).toBe(404);
    const withdrawn = await request(app).post(`/api/registrations/${pulled.body.id}/withdraw`).set(auth(applicantToken));
    expect(withdrawn.body.status).toBe('WITHDRAWN');

    const rejected = await request(app).post(`/api/registrations/${kept.body.id}/reject`).set(auth(adminToken))
      .send({ reason: 'Full roster already' });
    expect(rejected.body).toMatchObject({ status: 'REJECTED', reason: 'Full roster already' });

    const mine = await request(app).get('/api/registrations/mine').set(auth(applicantToken));
    const here = mine.body.filter((row: { competition: { id: string } }) => row.competition.id === id);
    expect(here.map((row: { status: string }) => row.status).sort()).toEqual(['REJECTED', 'WITHDRAWN']);
  });
});

describe('a tournament application', () => {
  it('needs no account and becomes a team with its roster', async () => {
    const id = await tournament('roster');
    await settings('tournament', id, { open: true, fee: '500 Kč' });
    const applied = await applyToTournament(id, {
      teamName: 'Floor Kings',
      roster: [{ name: 'Ann', number: 7 }, { name: 'Bob' }],
    });
    expect(applied.status).toBe(201);
    expect(applied.body.applicantId).toBeNull();

    const approved = await request(app).post(`/api/registrations/${applied.body.id}/approve`).set(auth(adminToken));
    expect(approved.status).toBe(200);
    const team = await prisma.tournamentTeam.findUnique({
      where: { id: approved.body.tournamentTeamId },
      include: { players: { orderBy: { name: 'asc' } } },
    });
    expect(team!.name).toBe('Floor Kings');
    expect(team!.players.map((p) => [p.name, p.number])).toEqual([['Ann', 7], ['Bob', null]]);
  });

  it('answers a bot like a person, returns a retried submit, and limits each address', async () => {
    const id = await tournament('guards');
    await settings('tournament', id, { open: true });

    const bot = await applyToTournament(id, { teamName: 'Spam FC', website: 'http://spam.example' });
    expect(bot.status).toBe(202);
    expect(await prisma.registration.count({ where: { teamName: 'Spam FC' } })).toBe(0);

    const retryToken = clientToken();
    const first = await request(app).post(`/api/registrations/tournament/${id}`)
      .send({ clientToken: retryToken, contactName: 'Coach', email: `retry-${stamp}@test.com`, teamName: 'Retry' });
    const second = await request(app).post(`/api/registrations/tournament/${id}`)
      .send({ clientToken: retryToken, contactName: 'Coach', email: `retry-${stamp}@test.com`, teamName: 'Retry' });
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);

    expect((await applyToTournament(id, { teamName: 'Bad Mail', email: 'nope' })).status).toBe(400);

    for (let i = 0; i < 4; i++) await applyToTournament(id, { teamName: `Team ${i}` });
    expect((await applyToTournament(id, { teamName: 'One Too Many' })).status).toBe(429);
  });
});

describe('the manager side', () => {
  it('is closed to outsiders', async () => {
    const id = await season('outsider');
    await settings('season', id, { open: true });
    const applied = await applyToSeason(id, { teamName: 'Watched' });

    expect((await request(app).get(`/api/registrations/season/${id}/inbox`).set(auth(strangerToken))).status).toBe(403);
    expect((await request(app).put(`/api/registrations/season/${id}/settings`).set(auth(strangerToken)).send({ open: false })).status).toBe(403);
    expect((await request(app).post(`/api/registrations/${applied.body.id}/approve`).set(auth(strangerToken))).status).toBe(403);

    const inbox = await request(app).get(`/api/registrations/season/${id}/inbox`).set(auth(adminToken));
    expect(inbox.status).toBe(200);
    expect(inbox.body.registrations).toHaveLength(1);
  });

  it('validates the settings', async () => {
    const id = await season('settings');
    expect((await settings('season', id, { maxTeams: 1 })).status).toBe(400);
    expect((await settings('season', id, { deadline: 'soon' })).status).toBe(400);
    expect((await settings('season', id, { open: 'yes' })).status).toBe(400);
  });
});
