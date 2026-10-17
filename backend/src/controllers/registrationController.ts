import { Response } from 'express';
import { Prisma, RegistrationStatus } from '@prisma/client';
import prisma from '../config/database.js';
import { AuthRequest } from '../types/index.js';
import { canManageSeason, canManageTournament } from '../services/access.js';
import emailService from '../services/emailService.js';

type Kind = 'season' | 'tournament';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEXT_MAX = { name: 80, contact: 120, phone: 40, note: 1000, rules: 10000, fee: 300, reason: 500 };
const ROSTER_MAX = 40;
/** Applications that hold or may take a place: decided ones and withdrawn ones do not. */
const LIVE: RegistrationStatus[] = ['PENDING', 'WAITLISTED', 'APPROVED'];

// ---------------------------------------------------------------- rate limit

/**
 * Tournament applications need no account, so they get the contact form's
 * guard: at most this many per address per window, kept in process memory.
 */
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const recentByIp = new Map<string, number[]>();

const overRateLimit = (ip: string, now = Date.now()): boolean => {
  const recent = (recentByIp.get(ip) ?? []).filter((at) => now - at < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    recentByIp.set(ip, recent);
    return true;
  }
  recent.push(now);
  recentByIp.set(ip, recent);
  return false;
};

/** For tests: forget every address. */
export const resetRegistrationRateLimit = (): void => recentByIp.clear();

// --------------------------------------------------------------- competition

interface Competition {
  kind: Kind;
  id: string;
  name: string;
  /** League or series, for the heading of the form. */
  parentName: string;
  sport: string;
  archived: boolean;
  /** Teams already in the competition. */
  teamCount: number;
  /** Who hears about new applications: the league or series manager. */
  managerEmails: string[];
  window: Prisma.RegistrationWindowGetPayload<object> | null;
}

/** Everything the rules need about one season or tournament, or null if it does not exist. */
async function loadCompetition(kind: Kind, id: string): Promise<Competition | null> {
  if (kind === 'season') {
    const season = await prisma.season.findUnique({
      where: { id },
      include: {
        league: { select: { name: true, sportType: true, manager: { select: { email: true } } } },
        registrationWindow: true,
        _count: { select: { seasonTeams: true } },
      },
    });
    if (!season) return null;
    return {
      kind,
      id,
      name: `${season.league.name} – ${season.name}`,
      parentName: season.league.name,
      sport: season.league.sportType,
      archived: season.archivedAt !== null,
      teamCount: season._count.seasonTeams,
      managerEmails: season.league.manager ? [season.league.manager.email] : [],
      window: season.registrationWindow,
    };
  }
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: {
      series: { select: { name: true, sportType: true, manager: { select: { email: true } } } },
      registrationWindow: true,
      _count: { select: { teams: true } },
    },
  });
  if (!tournament) return null;
  return {
    kind,
    id,
    name: tournament.name,
    parentName: tournament.series.name,
    sport: tournament.series.sportType,
    archived: tournament.status === 'COMPLETED',
    teamCount: tournament._count.teams,
    managerEmails: tournament.series.manager ? [tournament.series.manager.email] : [],
    window: tournament.registrationWindow,
  };
}

/** Whether the form takes applications right now, and if not, why. */
const formState = (competition: Competition, now = new Date()): 'OPEN' | 'CLOSED' | 'PAST_DEADLINE' => {
  const window = competition.window;
  if (!window?.open || competition.archived) return 'CLOSED';
  if (window.deadline && window.deadline < now) return 'PAST_DEADLINE';
  return 'OPEN';
};

/** Places taken: teams already in, plus applications waiting for a decision. */
const placesTaken = async (competition: Competition): Promise<number> => {
  if (!competition.window) return competition.teamCount;
  const pending = await prisma.registration.count({ where: { windowId: competition.window.id, status: 'PENDING' } });
  return competition.teamCount + pending;
};

const competitionLink = (competition: Competition): string => {
  const base = process.env.APP_URL || 'http://localhost:5173';
  return competition.kind === 'season' ? `${base}/season-detail/${competition.id}` : `${base}/tournament/${competition.id}`;
};

const inboxLink = (competition: Competition): string => {
  const base = process.env.APP_URL || 'http://localhost:5173';
  return competition.kind === 'season'
    ? `${base}/season-management/${competition.id}?registrations=1`
    : `${base}/tournament-management/tournament/${competition.id}?registrations=1`;
};

const managerEmailsOrAdmins = async (competition: Competition): Promise<string[]> =>
  competition.managerEmails.length > 0
    ? competition.managerEmails
    : (await prisma.user.findMany({ where: { role: 'ADMIN', active: true }, select: { email: true } })).map((u) => u.email);

const mayManage = (req: AuthRequest, kind: Kind, id: string): Promise<boolean> =>
  kind === 'season' ? canManageSeason(req.user!, id) : canManageTournament(req.user!, id);

const kindOf = (req: AuthRequest): Kind => (req.params.kind === 'tournament' ? 'tournament' : 'season');

const text = (value: unknown, max: number): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= max ? trimmed : null;
};

const optionalText = (value: unknown, max: number): string | null | false => {
  if (value === undefined || value === null || value === '') return null;
  return text(value, max) ?? false;
};

const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

// ---------------------------------------------------------------- public form

/** What the public form shows: the competition, the terms and whether it takes applications. */
export const getForm = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const kind = kindOf(req);
    const competition = await loadCompetition(kind, req.params.id);
    if (!competition) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const window = competition.window;
    const taken = await placesTaken(competition);
    res.json({
      kind,
      id: competition.id,
      name: competition.name,
      parentName: competition.parentName,
      sport: competition.sport,
      state: formState(competition),
      deadline: window?.deadline ?? null,
      maxTeams: window?.maxTeams ?? null,
      placesTaken: taken,
      full: window?.maxTeams != null && taken >= window.maxTeams,
      rules: window?.rules ?? null,
      rulesVersion: window?.rulesVersion ?? 1,
      fee: window?.fee ?? null,
    });
  } catch (error) {
    console.error('Get registration form error:', error);
    res.status(500).json({ error: 'Failed to load the registration form' });
  }
};

/**
 * Takes an application. A season application comes from a signed-in user and
 * may name one of their own teams; a tournament application needs no account
 * and carries an optional roster. Once the places are taken a new application
 * joins the waiting list instead of the queue.
 */
export const submit = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const kind = kindOf(req);
    const body = req.body ?? {};

    // Honeypot: hidden from people, so anything in it is a bot. It gets the
    // same answer as a person and nothing is stored.
    if (typeof body.website === 'string' && body.website.trim() !== '') {
      res.status(202).json({ received: true });
      return;
    }

    if (kind === 'season' && !req.user) {
      res.status(401).json({ error: 'Sign in to apply to a season' });
      return;
    }

    const competition = await loadCompetition(kind, req.params.id);
    if (!competition) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const clientToken = body.clientToken;
    if (typeof clientToken !== 'string' || clientToken.length < 8 || clientToken.length > 100) {
      res.status(400).json({ error: 'Invalid application', fields: { clientToken: 'invalid' } });
      return;
    }
    // A retry of an application that already arrived returns it.
    const existing = await prisma.registration.findUnique({ where: { clientToken } });
    if (existing) {
      res.status(200).json(existing);
      return;
    }

    const state = formState(competition);
    if (state !== 'OPEN') {
      res.status(409).json({ error: state === 'PAST_DEADLINE' ? 'The deadline has passed' : 'Registrations are closed' });
      return;
    }
    const window = competition.window!;

    if (window.rules && body.acceptRules !== true) {
      res.status(400).json({ error: 'The rules must be accepted', fields: { acceptRules: 'required' } });
      return;
    }

    const fields: Record<string, string> = {};
    const contactName = text(body.contactName, TEXT_MAX.contact) ?? (kind === 'season' ? req.user!.name : null);
    if (!contactName) fields.contactName = 'invalid';
    const email = kind === 'season'
      ? req.user!.email
      : typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (email.length > 254 || !EMAIL_PATTERN.test(email)) fields.email = 'invalid';
    const phone = optionalText(body.phone, TEXT_MAX.phone);
    if (phone === false) fields.phone = 'invalid';
    const note = optionalText(body.note, TEXT_MAX.note);
    if (note === false) fields.note = 'invalid';
    const primaryColor = optionalText(body.primaryColor, 7);
    if (primaryColor === false || (primaryColor && !COLOR_PATTERN.test(primaryColor))) fields.primaryColor = 'invalid';
    const locale = body.locale === 'en' ? 'en' : 'cs';

    // A season applicant either brings back a team they manage or names a new one.
    let existingTeamId: string | null = null;
    let teamName = text(body.teamName, TEXT_MAX.name);
    if (kind === 'season' && typeof body.existingTeamId === 'string' && body.existingTeamId) {
      const team = await prisma.team.findUnique({ where: { id: body.existingTeamId } });
      if (!team || team.managerId !== req.user!.id) {
        res.status(403).json({ error: 'You can only apply with a team you manage' });
        return;
      }
      const alreadyIn = await prisma.seasonTeam.findUnique({ where: { seasonId_teamId: { seasonId: competition.id, teamId: team.id } } });
      if (alreadyIn) {
        res.status(409).json({ error: 'This team is already in the season' });
        return;
      }
      existingTeamId = team.id;
      teamName = team.name;
    }
    if (!teamName) fields.teamName = 'invalid';

    let roster: Prisma.InputJsonValue | undefined;
    if (kind === 'tournament' && body.roster !== undefined && body.roster !== null) {
      if (!Array.isArray(body.roster) || body.roster.length > ROSTER_MAX) {
        fields.roster = 'invalid';
      } else {
        const rows = [];
        for (const row of body.roster as unknown[]) {
          const entry = (row ?? {}) as Record<string, unknown>;
          const name = text(entry.name, TEXT_MAX.name);
          const number = entry.number === undefined || entry.number === null || entry.number === '' ? null : Number(entry.number);
          if (!name || (number !== null && (!Number.isInteger(number) || number < 0 || number > 999))) {
            fields.roster = 'invalid';
            break;
          }
          rows.push({ name, number });
        }
        roster = rows;
      }
    }

    if (Object.keys(fields).length > 0) {
      res.status(400).json({ error: 'Invalid application', fields });
      return;
    }

    if (kind === 'tournament' && overRateLimit(req.ip ?? 'unknown')) {
      res.status(429).json({ error: 'Too many applications. Please try again later.' });
      return;
    }

    // One live application per team name in a competition.
    const duplicate = await prisma.registration.findFirst({
      where: {
        windowId: window.id,
        status: { in: LIVE },
        OR: [
          { teamName: { equals: teamName!, mode: 'insensitive' } },
          ...(existingTeamId ? [{ existingTeamId }] : []),
        ],
      },
    });
    if (duplicate) {
      res.status(409).json({ error: 'This team has already applied' });
      return;
    }

    const waitlisted = window.maxTeams != null && (await placesTaken(competition)) >= window.maxTeams;
    const registration = await prisma.registration.create({
      data: {
        windowId: window.id,
        status: waitlisted ? 'WAITLISTED' : 'PENDING',
        applicantId: req.user?.id ?? null,
        contactName: contactName!,
        email,
        phone: phone || null,
        note: note || null,
        locale,
        existingTeamId,
        teamName: teamName!,
        primaryColor: primaryColor || null,
        ...(roster !== undefined && { roster }),
        rulesAcceptedAt: window.rules ? new Date() : null,
        rulesVersion: window.rules ? window.rulesVersion : null,
        clientToken,
      },
    });

    // Mail is best effort: a failed send must not lose an application that arrived.
    void emailService
      .sendRegistrationReceivedEmail({
        to: email,
        contactName: contactName!,
        teamName: teamName!,
        competitionName: competition.name,
        waitlisted,
        link: competitionLink(competition),
        locale,
      })
      .catch((error) => console.error('Registration receipt email error:', error));
    void managerEmailsOrAdmins(competition)
      .then((recipients) => Promise.all(recipients.map((to) => emailService.sendRegistrationNoticeEmail({
        to,
        teamName: teamName!,
        contactName: contactName!,
        contactEmail: email,
        competitionName: competition.name,
        waitlisted,
        link: inboxLink(competition),
      }))))
      .catch((error) => console.error('Registration notice email error:', error));

    res.status(201).json(registration);
  } catch (error) {
    if ((error as Prisma.PrismaClientKnownRequestError).code === 'P2002') {
      res.status(409).json({ error: 'This application already arrived' });
      return;
    }
    console.error('Submit registration error:', error);
    res.status(500).json({ error: 'Failed to submit the application' });
  }
};

// ---------------------------------------------------------------- applicant

/** The signed-in user's own applications, newest first, with where they applied. */
export const listMine = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rows = await prisma.registration.findMany({
      where: { applicantId: req.user!.id },
      include: {
        window: {
          select: {
            season: { select: { id: true, name: true, league: { select: { name: true } } } },
            tournament: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(rows.map(({ window, ...row }) => ({
      ...row,
      competition: window.season
        ? { kind: 'season', id: window.season.id, name: `${window.season.league.name} – ${window.season.name}` }
        : { kind: 'tournament', id: window.tournament!.id, name: window.tournament!.name },
    })));
  } catch (error) {
    console.error('List my registrations error:', error);
    res.status(500).json({ error: 'Failed to load your applications' });
  }
};

/** An applicant takes back an application nobody has decided yet. */
export const withdraw = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const registration = await prisma.registration.findUnique({ where: { id: req.params.id } });
    if (!registration || registration.applicantId !== req.user!.id) {
      res.status(404).json({ error: 'Application not found' });
      return;
    }
    if (registration.status !== 'PENDING' && registration.status !== 'WAITLISTED') {
      res.status(409).json({ error: 'Only an application waiting for a decision can be withdrawn' });
      return;
    }
    const updated = await prisma.registration.update({ where: { id: registration.id }, data: { status: 'WITHDRAWN' } });
    res.json(updated);
  } catch (error) {
    console.error('Withdraw registration error:', error);
    res.status(500).json({ error: 'Failed to withdraw the application' });
  }
};

// ---------------------------------------------------------------- manager

/** The form's settings as the manager edits them; a competition with no form yet gets the defaults. */
export const getSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const kind = kindOf(req);
    if (!(await mayManage(req, kind, req.params.id))) {
      res.status(403).json({ error: 'Not allowed' });
      return;
    }
    const competition = await loadCompetition(kind, req.params.id);
    if (!competition) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(competition.window ?? { open: false, deadline: null, maxTeams: null, rules: null, rulesVersion: 1, fee: null });
  } catch (error) {
    console.error('Get registration settings error:', error);
    res.status(500).json({ error: 'Failed to load the registration settings' });
  }
};

export const updateSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const kind = kindOf(req);
    if (!(await mayManage(req, kind, req.params.id))) {
      res.status(403).json({ error: 'Not allowed' });
      return;
    }
    const competition = await loadCompetition(kind, req.params.id);
    if (!competition) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    if (competition.archived) {
      res.status(400).json({ error: 'The competition is finished' });
      return;
    }

    const body = req.body ?? {};
    const fields: Record<string, string> = {};
    const data: Prisma.RegistrationWindowUncheckedUpdateInput = {};
    if (body.open !== undefined) {
      if (typeof body.open !== 'boolean') fields.open = 'invalid';
      else data.open = body.open;
    }
    if (body.deadline !== undefined) {
      const deadline = body.deadline === null || body.deadline === '' ? null : new Date(body.deadline);
      if (deadline && Number.isNaN(deadline.getTime())) fields.deadline = 'invalid';
      else data.deadline = deadline;
    }
    if (body.maxTeams !== undefined) {
      const max = body.maxTeams === null || body.maxTeams === '' ? null : Number(body.maxTeams);
      if (max !== null && (!Number.isInteger(max) || max < 2 || max > 200)) fields.maxTeams = 'invalid';
      else data.maxTeams = max;
    }
    if (body.rules !== undefined) {
      const rules = optionalText(body.rules, TEXT_MAX.rules);
      if (rules === false) fields.rules = 'invalid';
      else data.rules = rules;
    }
    if (body.fee !== undefined) {
      const fee = optionalText(body.fee, TEXT_MAX.fee);
      if (fee === false) fields.fee = 'invalid';
      else data.fee = fee;
    }
    if (Object.keys(fields).length > 0) {
      res.status(400).json({ error: 'Invalid settings', fields });
      return;
    }

    // Changed rules are a new version: later applicants accept the new text,
    // and the earlier ones keep the record of what they accepted.
    const rulesChanged = data.rules !== undefined && competition.window && data.rules !== competition.window.rules;
    const target = kind === 'season' ? { seasonId: competition.id } : { tournamentId: competition.id };
    const window = await prisma.registrationWindow.upsert({
      where: target,
      create: { ...target, ...(data as Prisma.RegistrationWindowUncheckedCreateInput) },
      update: { ...data, ...(rulesChanged && { rulesVersion: { increment: 1 } }) },
    });
    res.json(window);
  } catch (error) {
    console.error('Update registration settings error:', error);
    res.status(500).json({ error: 'Failed to save the registration settings' });
  }
};

/** Every application to a competition, waiting ones first, oldest first within each status. */
export const getInbox = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const kind = kindOf(req);
    if (!(await mayManage(req, kind, req.params.id))) {
      res.status(403).json({ error: 'Not allowed' });
      return;
    }
    const competition = await loadCompetition(kind, req.params.id);
    if (!competition) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const rows = competition.window
      ? await prisma.registration.findMany({
          where: { windowId: competition.window.id },
          include: { existingTeam: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        })
      : [];
    const order: RegistrationStatus[] = ['PENDING', 'WAITLISTED', 'APPROVED', 'REJECTED', 'WITHDRAWN'];
    rows.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
    res.json({
      registrations: rows,
      teamCount: competition.teamCount,
      maxTeams: competition.window?.maxTeams ?? null,
    });
  } catch (error) {
    console.error('Get registration inbox error:', error);
    res.status(500).json({ error: 'Failed to load the applications' });
  }
};

/** Loads an application with its competition and checks the caller may decide it. */
async function forDecision(req: AuthRequest, res: Response) {
  const registration = await prisma.registration.findUnique({
    where: { id: req.params.id },
    include: { window: { select: { seasonId: true, tournamentId: true } } },
  });
  if (!registration) {
    res.status(404).json({ error: 'Application not found' });
    return null;
  }
  const kind: Kind = registration.window.seasonId ? 'season' : 'tournament';
  const id = (registration.window.seasonId ?? registration.window.tournamentId)!;
  if (!(await mayManage(req, kind, id))) {
    res.status(403).json({ error: 'Not allowed' });
    return null;
  }
  const competition = (await loadCompetition(kind, id))!;
  return { registration, competition };
}

const notifyDecision = (
  registration: { email: string; contactName: string; teamName: string; locale: string; reason: string | null },
  competition: Competition,
  decision: 'APPROVED' | 'REJECTED' | 'WAITLISTED'
) => {
  void emailService
    .sendRegistrationDecisionEmail({
      to: registration.email,
      contactName: registration.contactName,
      teamName: registration.teamName,
      competitionName: competition.name,
      decision,
      reason: registration.reason,
      link: competitionLink(competition),
      locale: registration.locale,
    })
    .catch((error) => console.error('Registration decision email error:', error));
};

class Full extends Error {}
class AlreadyIn extends Error {}

/**
 * Accepts an application and puts the team in the competition, in one
 * transaction with the capacity check so two approvals cannot pass the
 * maximum between them.
 */
export const approve = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const found = await forDecision(req, res);
    if (!found) return;
    const { registration, competition } = found;
    if (registration.status !== 'PENDING' && registration.status !== 'WAITLISTED') {
      res.status(409).json({ error: 'This application has already been decided' });
      return;
    }
    if (competition.archived) {
      res.status(400).json({ error: 'The competition is finished' });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const max = competition.window?.maxTeams;
      if (max != null) {
        const teams = competition.kind === 'season'
          ? await tx.seasonTeam.count({ where: { seasonId: competition.id } })
          : await tx.tournamentTeam.count({ where: { tournamentId: competition.id } });
        if (teams >= max) throw new Full();
      }

      if (competition.kind === 'season') {
        let teamId = registration.existingTeamId;
        if (teamId) {
          const already = await tx.seasonTeam.findUnique({ where: { seasonId_teamId: { seasonId: competition.id, teamId } } });
          if (already) throw new AlreadyIn();
        } else {
          // The applicant becomes the new team's manager, with no further invitation.
          const team = await tx.team.create({
            data: { name: registration.teamName, primaryColor: registration.primaryColor, managerId: registration.applicantId },
          });
          teamId = team.id;
        }
        await tx.seasonTeam.create({ data: { seasonId: competition.id, teamId } });
        return tx.registration.update({
          where: { id: registration.id },
          data: { status: 'APPROVED', decidedAt: new Date(), decidedById: req.user!.id, teamId },
        });
      }

      const roster = Array.isArray(registration.roster) ? (registration.roster as { name: string; number: number | null }[]) : [];
      const team = await tx.tournamentTeam.create({
        data: {
          tournamentId: competition.id,
          name: registration.teamName,
          primaryColor: registration.primaryColor,
          players: { create: roster.map((row) => ({ name: row.name, number: row.number })) },
        },
      });
      return tx.registration.update({
        where: { id: registration.id },
        data: { status: 'APPROVED', decidedAt: new Date(), decidedById: req.user!.id, tournamentTeamId: team.id },
      });
    });

    notifyDecision(updated, competition, 'APPROVED');
    res.json(updated);
  } catch (error) {
    if (error instanceof Full) {
      res.status(409).json({ error: 'The competition is full. Raise the maximum or remove a team first.' });
      return;
    }
    if (error instanceof AlreadyIn) {
      res.status(409).json({ error: 'This team is already in the season' });
      return;
    }
    console.error('Approve registration error:', error);
    res.status(500).json({ error: 'Failed to approve the application' });
  }
};

/** Declines an application, with an optional reason the applicant is told. */
export const reject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const found = await forDecision(req, res);
    if (!found) return;
    const { registration, competition } = found;
    if (registration.status !== 'PENDING' && registration.status !== 'WAITLISTED') {
      res.status(409).json({ error: 'This application has already been decided' });
      return;
    }
    const reason = optionalText(req.body?.reason, TEXT_MAX.reason);
    if (reason === false) {
      res.status(400).json({ error: 'The reason is too long' });
      return;
    }
    const updated = await prisma.registration.update({
      where: { id: registration.id },
      data: { status: 'REJECTED', decidedAt: new Date(), decidedById: req.user!.id, reason: reason || null },
    });
    notifyDecision(updated, competition, 'REJECTED');
    res.json(updated);
  } catch (error) {
    console.error('Reject registration error:', error);
    res.status(500).json({ error: 'Failed to reject the application' });
  }
};

/** Moves a pending application to the waiting list. */
export const waitlist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const found = await forDecision(req, res);
    if (!found) return;
    const { registration, competition } = found;
    if (registration.status !== 'PENDING') {
      res.status(409).json({ error: 'Only a pending application can be moved to the waiting list' });
      return;
    }
    const updated = await prisma.registration.update({ where: { id: registration.id }, data: { status: 'WAITLISTED' } });
    notifyDecision(updated, competition, 'WAITLISTED');
    res.json(updated);
  } catch (error) {
    console.error('Waitlist registration error:', error);
    res.status(500).json({ error: 'Failed to move the application to the waiting list' });
  }
};
