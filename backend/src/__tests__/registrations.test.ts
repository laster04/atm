import { jest } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import prisma from '../config/database.js';
import { resetRegistrationRateLimit } from '../controllers/registrationController.js';
import emailService from '../services/emailService.js';
import { safeNextPath } from '../controllers/authController.js';

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

// No mail leaves the tests: each email is a recorded call, checked where it matters.
const receipts = jest.spyOn(emailService, 'sendRegistrationReceivedEmail').mockResolvedValue(true);
const decisions = jest.spyOn(emailService, 'sendRegistrationDecisionEmail').mockResolvedValue(true);
const withdrawals = jest.spyOn(emailService, 'sendRegistrationWithdrawnEmail').mockResolvedValue(true);
jest.spyOn(emailService, 'sendRegistrationNoticeEmail').mockResolvedValue(true);

/** Mail goes out after the answer; wait until it has. */
async function eventually(check: () => boolean, timeoutMs = 2000) {
  const until = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > until) throw new Error('Timed out waiting');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

const decide = (id: string, action: 'approve' | 'reject' | 'waitlist' | 'promote') =>
  request(app).post(`/api/registrations/${id}/${action}`).set(auth(adminToken));

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

describe('capacity and the waiting list', () => {
  it('counts the places the same way in the form, the inbox and the settings', async () => {
    const id = await season('capacity');
    await settings('season', id, { open: true, maxTeams: 2 });
    const first = await applyToSeason(id, { teamName: 'Cap One' });
    await applyToSeason(id, { teamName: 'Cap Two' });
    await applyToSeason(id, { teamName: 'Cap Three' });
    await decide(first.body.id, 'approve');

    const expected = { approved: 1, pending: 1, waitlisted: 1, max: 2, free: 0 };
    expect((await request(app).get(`/api/registrations/season/${id}`)).body.capacity).toEqual(expected);
    expect((await request(app).get(`/api/registrations/season/${id}/inbox`).set(auth(adminToken))).body.capacity).toEqual(expected);
    const current = await request(app).get(`/api/registrations/season/${id}/settings`).set(auth(adminToken));
    expect(current.body).toMatchObject({ capacity: expected, lifecycle: 'FULL' });

    // A bigger maximum shows at once.
    const raised = await settings('season', id, { maxTeams: 3 });
    expect(raised.body).toMatchObject({ capacity: { free: 1 }, lifecycle: 'OPEN' });
  });

  it('moves a team up only into a free place, and records moving one up out of turn', async () => {
    const id = await season('promote');
    await settings('season', id, { open: true, maxTeams: 2 });
    const one = await applyToSeason(id, { teamName: 'Up One' });
    await applyToSeason(id, { teamName: 'Up Two' });
    const older = await applyToSeason(id, { teamName: 'Up Three' });
    const younger = await applyToSeason(id, { teamName: 'Up Four' });
    expect([older.body.status, younger.body.status]).toEqual(['WAITLISTED', 'WAITLISTED']);

    expect((await decide(younger.body.id, 'promote')).status).toBe(409);
    // While the pending ones hold the places, the waiting list cannot be approved past them.
    expect((await decide(older.body.id, 'approve')).status).toBe(409);

    await request(app).post(`/api/registrations/${one.body.id}/withdraw`).set(auth(applicantToken));
    await eventually(() => withdrawals.mock.calls.some(([params]) => params.teamName === 'Up One'));

    const promoted = await decide(younger.body.id, 'promote');
    expect(promoted.status).toBe(200);
    expect(promoted.body).toMatchObject({ status: 'PENDING', promotedOutOfOrder: true });
    expect(promoted.body.promotedAt).not.toBeNull();
    await eventually(() => decisions.mock.calls.some(([params]) => params.teamName === 'Up Four' && params.decision === 'PROMOTED'));

    // The place is taken again.
    expect((await decide(older.body.id, 'promote')).status).toBe(409);
  });

  it('records moving up the oldest as in turn', async () => {
    const id = await season('in-turn');
    await settings('season', id, { open: true, maxTeams: 2 });
    await applyToSeason(id, { teamName: 'Turn One' });
    await applyToSeason(id, { teamName: 'Turn Two' });
    const waiting = await applyToSeason(id, { teamName: 'Turn Three' });
    await settings('season', id, { maxTeams: 3 });
    const promoted = await decide(waiting.body.id, 'promote');
    expect(promoted.body).toMatchObject({ status: 'PENDING', promotedOutOfOrder: false });
  });
});

describe('the publish lifecycle', () => {
  it('is a draft until first opened, and remembers publishing and closing', async () => {
    const id = await season('lifecycle');
    const draft = await request(app).get(`/api/registrations/season/${id}/settings`).set(auth(adminToken));
    expect(draft.body).toMatchObject({ lifecycle: 'DRAFT', publishedAt: null });

    const saved = await settings('season', id, { fee: '100 Kč' });
    expect(saved.body.lifecycle).toBe('DRAFT');

    const opened = await settings('season', id, { open: true });
    expect(opened.body.lifecycle).toBe('OPEN');
    expect(opened.body.publishedAt).not.toBeNull();

    const closed = await settings('season', id, { open: false });
    expect(closed.body.lifecycle).toBe('CLOSED');
    expect(closed.body.closedAt).not.toBeNull();

    const reopened = await settings('season', id, { open: true });
    expect(reopened.body.publishedAt).toBe(opened.body.publishedAt);
  });
});

describe('the status link', () => {
  it('shows a tournament application to whoever holds the link, and lets them withdraw it', async () => {
    const id = await tournament('status');
    await settings('tournament', id, { open: true, maxTeams: 2 });
    const applied = await applyToTournament(id, { teamName: 'Linked', roster: [{ name: 'Eve', number: 3 }] });
    expect(applied.status).toBe(201);
    expect(applied.body.statusLink).toMatch(/\/prihlaska\/stav\/[\w-]{20,}$/);
    expect(applied.body.statusTokenHash).toBeUndefined();
    const token = applied.body.statusLink.split('/').pop();

    // Only the hash is kept, and the receipt carries the link.
    const stored = await prisma.registration.findUnique({ where: { id: applied.body.id } });
    expect(stored!.statusTokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored!.statusTokenHash).not.toContain(token);
    await eventually(() => receipts.mock.calls.some(([params]) => params.statusLink === applied.body.statusLink));

    const inbox = await request(app).get(`/api/registrations/tournament/${id}/inbox`).set(auth(adminToken));
    expect(inbox.body.registrations[0].statusTokenHash).toBeUndefined();

    const status = await request(app).get(`/api/registrations/status/${token}`);
    expect(status.status).toBe(200);
    expect(status.body).toMatchObject({ status: 'PENDING', teamName: 'Linked', competition: { kind: 'tournament', id } });
    expect(status.body.roster).toEqual([{ name: 'Eve', number: 3 }]);

    expect((await request(app).get(`/api/registrations/status/${'x'.repeat(43)}`)).status).toBe(404);

    const withdrawn = await request(app).post(`/api/registrations/status/${token}/withdraw`);
    expect(withdrawn.body.status).toBe('WITHDRAWN');
    expect((await request(app).post(`/api/registrations/status/${token}/withdraw`)).status).toBe(409);
    const form = await request(app).get(`/api/registrations/tournament/${id}`);
    expect(form.body.capacity).toMatchObject({ pending: 0, free: 2 });
  });

  it('stops working a while after the decision', async () => {
    const id = await tournament('expired');
    await settings('tournament', id, { open: true });
    const applied = await applyToTournament(id, { teamName: 'Old News' });
    const token = applied.body.statusLink.split('/').pop();
    await decide(applied.body.id, 'reject');
    await prisma.registration.update({ where: { id: applied.body.id }, data: { decidedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) } });
    expect((await request(app).get(`/api/registrations/status/${token}`)).status).toBe(410);
  });

  it('is not given to a season application, which the dashboard shows', async () => {
    const id = await season('no-link');
    await settings('season', id, { open: true });
    const applied = await applyToSeason(id, { teamName: 'Accounted' });
    expect(applied.body.statusLink).toBeNull();
  });
});

describe('public lists', () => {
  it('badge seasons and tournament series that take applications', async () => {
    const open = await season('listed-open');
    const closed = await season('listed-closed');
    await settings('season', open, { open: true });
    await prisma.season.update({ where: { id: open }, data: { visibility: 'PUBLIC' } });
    await prisma.season.update({ where: { id: closed }, data: { visibility: 'PUBLIC' } });
    const seasons = await request(app).get('/api/seasons');
    const byId = new Map(seasons.body.map((row: { id: string; registrationOpen: boolean }) => [row.id, row.registrationOpen]));
    expect(byId.get(open)).toBe(true);
    expect(byId.get(closed)).toBe(false);

    const cup = await tournament('listed');
    await settings('tournament', cup, { open: true });
    const { seriesId } = (await prisma.tournament.findUnique({ where: { id: cup } }))!;
    const series = await request(app).get('/api/tournaments/series').set(auth(adminToken));
    expect(series.body.find((row: { id: string }) => row.id === seriesId).registrationOpen).toBe(true);
    const detail = await request(app).get(`/api/tournaments/series/${seriesId}`).set(auth(adminToken));
    expect(detail.body.tournaments[0].registrationOpen).toBe(true);
  });
});

describe('the dashboard list', () => {
  it("shows a manager their own running competitions, work waiting first", async () => {
    const owner = await account('owner-reg');
    const league = await request(app).post('/api/leagues').set(auth(owner.token))
      .send({ name: `Own League ${stamp}`, sportType: 'FOOTBALL' });
    const ownSeason = await request(app).post('/api/seasons').set(auth(owner.token))
      .send({ name: `Own Season ${stamp}`, leagueId: league.body.id, startDate: '2027-09-01', endDate: '2028-04-30' });
    const series = await request(app).post('/api/tournaments/series').set(auth(owner.token))
      .send({ name: `Own Cup ${stamp}`, sportType: 'HOCKEY' });
    const cup = await request(app).post(`/api/tournaments/series/${series.body.id}/tournaments`).set(auth(owner.token))
      .send({ name: `Own Cup ${stamp}` });
    await request(app).put(`/api/registrations/tournament/${cup.body.id}/settings`).set(auth(owner.token))
      .send({ open: true, maxTeams: 4 });
    expect((await applyToTournament(cup.body.id, { teamName: 'Visitors' })).status).toBe(201);

    const mine = await request(app).get('/api/registrations/managed').set(auth(owner.token));
    expect(mine.status).toBe(200);
    expect(mine.body).toEqual([
      expect.objectContaining({
        kind: 'tournament', id: cup.body.id, lifecycle: 'OPEN', pending: 1, waitlisted: 0,
        inboxPath: `/tournament-management/tournament/${cup.body.id}?registrations=1`,
      }),
      expect.objectContaining({ kind: 'season', id: ownSeason.body.id, lifecycle: 'DRAFT', pending: 0, parentName: `Own League ${stamp}` }),
    ]);

    // Only the manager relation counts, so neither a stranger nor an admin sees them.
    expect((await request(app).get('/api/registrations/managed').set(auth(strangerToken))).body).toEqual([]);
    const admin = await request(app).get('/api/registrations/managed').set(auth(adminToken));
    expect(admin.body.some((row: { id: string }) => row.id === cup.body.id)).toBe(false);
    expect((await request(app).get('/api/registrations/managed')).status).toBe(401);
  });
});

describe('the funnel', () => {
  it('is for admins only and counts published forms', async () => {
    expect((await request(app).get('/api/registrations/funnel').set(auth(strangerToken))).status).toBe(403);
    const funnel = await request(app).get('/api/registrations/funnel').set(auth(adminToken));
    expect(funnel.status).toBe(200);
    expect(funnel.body.published).toBeGreaterThan(0);
    expect(funnel.body.publishedWithApplications).toBeLessThanOrEqual(funnel.body.published);
  });
});

describe('signing up on the way to a season application', () => {
  it('keeps the way back to the form in the activation link, and only a path inside the app', async () => {
    const activation = jest.spyOn(emailService, 'sendActivationEmail').mockResolvedValue(true);
    const next = '/prihlaska/sezona/some-season';
    const registered = await request(app).post('/api/auth/register')
      .send({ email: `newcomer-${stamp}@test.com`, password: 'password123', name: 'Newcomer', next });
    expect(registered.status).toBe(201);
    await eventually(() => activation.mock.calls.some(([to]) => to === `newcomer-${stamp}@test.com`));
    expect(activation.mock.calls.find(([to]) => to === `newcomer-${stamp}@test.com`)![3]).toBe(next);

    await request(app).post('/api/auth/register')
      .send({ email: `wanderer-${stamp}@test.com`, password: 'password123', name: 'Wanderer', next: 'https://evil.example' });
    await eventually(() => activation.mock.calls.some(([to]) => to === `wanderer-${stamp}@test.com`));
    expect(activation.mock.calls.find(([to]) => to === `wanderer-${stamp}@test.com`)![3]).toBeNull();
  });

  it('follows only paths inside the app', () => {
    expect(safeNextPath('/prihlaska/turnaj/1')).toBe('/prihlaska/turnaj/1');
    expect(safeNextPath('//evil.example')).toBeNull();
    expect(safeNextPath('/\\evil.example')).toBeNull();
    expect(safeNextPath('https://evil.example')).toBeNull();
    expect(safeNextPath('/with space')).toBeNull();
    expect(safeNextPath(42)).toBeNull();
  });
});
