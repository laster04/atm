import crypto from 'crypto';
import { Response } from 'express';
import { Prisma, Registration, RegistrationStatus } from '@prisma/client';
import prisma from '../config/database.js';
import { AuthRequest } from '../types/index.js';
import { canManageSeason, canManageTournament } from '../services/access.js';
import emailService from '../services/emailService.js';
import { localeOf, type Locale } from '../i18n/index.js';
import { registrationFormState } from '../services/registrationState.js';
import {
  capacityLimit,
  lockCompetition,
  PlanLimitError,
  planLimitBody,
  teamAllowance,
  type TeamAllowance,
} from '../services/plans/tournamentPlan.js';

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
/** Status links are read more often than forms are sent, so they get more room. */
const STATUS_RATE_LIMIT = 30;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const recentByIp = new Map<string, number[]>();

const overRateLimit = (ip: string, limit = RATE_LIMIT, now = Date.now()): boolean => {
  const recent = (recentByIp.get(ip) ?? []).filter((at) => now - at < RATE_WINDOW_MS);
  if (recent.length >= limit) {
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

/** Someone a notice goes to, in their own language. */
interface Recipient {
  email: string;
  locale: Locale;
}

const recipient = (user: { email: string; locale: string }): Recipient => ({ email: user.email, locale: localeOf(user.locale) });

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
  managers: Recipient[];
  window: Prisma.RegistrationWindowGetPayload<object> | null;
  /** A tournament's plan and team limit; null for a season. */
  allowance: TeamAllowance | null;
}

/** Everything the rules need about one season or tournament, or null if it does not exist. */
async function loadCompetition(kind: Kind, id: string): Promise<Competition | null> {
  if (kind === 'season') {
    const season = await prisma.season.findUnique({
      where: { id },
      include: {
        league: { select: { name: true, sportType: true, manager: { select: { email: true, locale: true } } } },
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
      managers: season.league.manager ? [recipient(season.league.manager)] : [],
      window: season.registrationWindow,
      allowance: null,
    };
  }
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: {
      series: { select: { name: true, sportType: true, manager: { select: { email: true, locale: true } } } },
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
    managers: tournament.series.manager ? [recipient(tournament.series.manager)] : [],
    window: tournament.registrationWindow,
    allowance: await teamAllowance(id),
  };
}

/** The competition a window belongs to. */
async function competitionOfWindow(windowId: string): Promise<Competition | null> {
  const window = await prisma.registrationWindow.findUnique({ where: { id: windowId }, select: { seasonId: true, tournamentId: true } });
  if (!window) return null;
  return window.seasonId ? loadCompetition('season', window.seasonId) : loadCompetition('tournament', window.tournamentId!);
}

/** Whether the form takes applications right now, and if not, why. */
const formState = (competition: Competition, now = new Date()) =>
  registrationFormState(competition.window, competition.archived, now);

/**
 * Where the places stand, one model for the manager's inbox, the public form
 * and the emails: teams already in, applications holding a place while they
 * wait for a decision, and the waiting list behind them.
 */
export interface Capacity {
  approved: number;
  pending: number;
  waitlisted: number;
  max: number | null;
  /** Places nobody holds yet; null when the competition has no maximum. */
  free: number | null;
}

/**
 * The most teams the competition takes: the form's maximum, or the plan's
 * limit when that is lower. Past it, applications join the waiting list.
 */
const maxOf = (competition: Competition): number | null => {
  const formMax = competition.window?.maxTeams ?? null;
  const planLimit = capacityLimit(competition.allowance);
  if (formMax === null) return planLimit;
  return planLimit === null ? formMax : Math.min(formMax, planLimit);
};

const capacityFrom = (approved: number, pending: number, waitlisted: number, max: number | null): Capacity => ({
  approved,
  pending,
  waitlisted,
  max,
  free: max === null ? null : Math.max(0, max - approved - pending),
});

const capacityOf = async (competition: Competition, db: Pick<typeof prisma, 'registration'> = prisma): Promise<Capacity> => {
  const window = competition.window;
  const counts = window
    ? await db.registration.groupBy({
        by: ['status'],
        where: { windowId: window.id, status: { in: ['PENDING', 'WAITLISTED'] } },
        _count: { _all: true },
      })
    : [];
  const count = (status: RegistrationStatus) => counts.find((row) => row.status === status)?._count._all ?? 0;
  return capacityFrom(competition.teamCount, count('PENDING'), count('WAITLISTED'), maxOf(competition));
};

/**
 * The manager's view of the form's life: a draft until first published, then
 * open (or full, still taking waiting-list applications), past its deadline,
 * or closed.
 */
type Lifecycle = 'DRAFT' | 'OPEN' | 'FULL' | 'PAST_DEADLINE' | 'CLOSED';

const lifecycleOf = (competition: Competition, capacity: Capacity): Lifecycle => {
  const window = competition.window;
  if (!window?.open && !window?.publishedAt) return 'DRAFT';
  const state = formState(competition);
  if (state !== 'OPEN') return state;
  return capacity.free === 0 ? 'FULL' : 'OPEN';
};

const appUrl = (): string => process.env.APP_URL || 'http://localhost:5173';

const competitionLink = (competition: Competition): string =>
  competition.kind === 'season' ? `${appUrl()}/season-detail/${competition.id}` : `${appUrl()}/tournament/${competition.id}`;

// ---------------------------------------------------------------- status link

/**
 * A tournament applicant has no account, so their receipt carries a link to
 * the application itself: its status and a way to withdraw it. Only the
 * SHA-256 of the token is stored, as with manager invites; the link stops
 * working this long after the application was decided or withdrawn.
 */
const STATUS_LINK_DAYS = 30;

const hashToken = (token: string): string => crypto.createHash('sha256').update(token).digest('hex');

const statusLink = (token: string): string => `${appUrl()}/prihlaska/stav/${token}`;

/** An application as it leaves the API: the status token's hash stays inside. */
const view = <T extends Pick<Registration, 'statusTokenHash'>>({ statusTokenHash: _hash, ...row }: T): Omit<T, 'statusTokenHash'> => row;

const inboxLink = (competition: Competition): string =>
  competition.kind === 'season'
    ? `${appUrl()}/season-management/${competition.id}?registrations=1`
    : `${appUrl()}/tournament-management/tournament/${competition.id}?registrations=1`;

const managersOrAdmins = async (competition: Competition): Promise<Recipient[]> =>
  competition.managers.length > 0
    ? competition.managers
    : (await prisma.user.findMany({ where: { role: 'ADMIN', active: true }, select: { email: true, locale: true } })).map(recipient);

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
    const capacity = await capacityOf(competition);
    res.json({
      kind,
      id: competition.id,
      name: competition.name,
      parentName: competition.parentName,
      sport: competition.sport,
      state: formState(competition),
      deadline: window?.deadline ?? null,
      maxTeams: capacity.max,
      placesTaken: capacity.approved + capacity.pending,
      // A new application now would join the waiting list.
      full: capacity.free === 0,
      capacity,
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
    // The status link is not repeated: it was in the first answer and the receipt.
    const existing = await prisma.registration.findUnique({ where: { clientToken } });
    if (existing) {
      res.status(200).json(view(existing));
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
    const locale = localeOf(body.locale);

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

    const waitlisted = (await capacityOf(competition)).free === 0;
    // A tournament applicant may have no account, so they get a status link.
    const statusToken = kind === 'tournament' ? crypto.randomBytes(32).toString('base64url') : null;
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
        statusTokenHash: statusToken ? hashToken(statusToken) : null,
      },
    });
    const link = statusToken ? statusLink(statusToken) : null;

    // Mail is best effort: a failed send must not lose an application that arrived.
    void emailService
      .sendRegistrationReceivedEmail({
        to: email,
        contactName: contactName!,
        teamName: teamName!,
        competitionName: competition.name,
        waitlisted,
        link: competitionLink(competition),
        statusLink: link,
        locale,
      })
      .catch((error) => console.error('Registration receipt email error:', error));
    void Promise.all([managersOrAdmins(competition), capacityOf(competition)])
      .then(([recipients, capacity]) => Promise.all(recipients.map(({ email: to, locale: managerLocale }) => emailService.sendRegistrationNoticeEmail({
        to,
        locale: managerLocale,
        teamName: teamName!,
        contactName: contactName!,
        contactEmail: email,
        competitionName: competition.name,
        waitlisted,
        capacity,
        link: inboxLink(competition),
      }))))
      .catch((error) => console.error('Registration notice email error:', error));

    res.status(201).json({ ...view(registration), statusLink: link });
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
      ...view(row),
      competition: window.season
        ? { kind: 'season', id: window.season.id, name: `${window.season.league.name} – ${window.season.name}` }
        : { kind: 'tournament', id: window.tournament!.id, name: window.tournament!.name },
    })));
  } catch (error) {
    console.error('List my registrations error:', error);
    res.status(500).json({ error: 'Failed to load your applications' });
  }
};

/**
 * Takes back an application nobody has decided yet. A pending one frees its
 * place; nobody moves up by themselves, so the manager hears about it when
 * teams are waiting for that place.
 */
async function withdrawRegistration(registration: Registration, res: Response): Promise<void> {
  if (registration.status !== 'PENDING' && registration.status !== 'WAITLISTED') {
    res.status(409).json({ error: 'Only an application waiting for a decision can be withdrawn' });
    return;
  }
  const updated = await prisma.registration.update({
    where: { id: registration.id },
    data: { status: 'WITHDRAWN', withdrawnAt: new Date() },
  });

  if (registration.status === 'PENDING') {
    void (async () => {
      const competition = await competitionOfWindow(registration.windowId);
      if (!competition) return;
      const capacity = await capacityOf(competition);
      if (capacity.waitlisted === 0) return;
      const recipients = await managersOrAdmins(competition);
      await Promise.all(recipients.map(({ email: to, locale }) => emailService.sendRegistrationWithdrawnEmail({
        to,
        locale,
        teamName: registration.teamName,
        competitionName: competition.name,
        capacity,
        link: inboxLink(competition),
      })));
    })().catch((error) => console.error('Registration withdrawn email error:', error));
  }

  res.json(view(updated));
}

/** A signed-in applicant takes back their own application. */
export const withdraw = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const registration = await prisma.registration.findUnique({ where: { id: req.params.id } });
    if (!registration || registration.applicantId !== req.user!.id) {
      res.status(404).json({ error: 'Application not found' });
      return;
    }
    await withdrawRegistration(registration, res);
  } catch (error) {
    console.error('Withdraw registration error:', error);
    res.status(500).json({ error: 'Failed to withdraw the application' });
  }
};

/** The application a status link points to, or null once it answered for it. */
async function byStatusToken(req: AuthRequest, res: Response) {
  if (overRateLimit(`status:${req.ip ?? 'unknown'}`, STATUS_RATE_LIMIT)) {
    res.status(429).json({ error: 'Too many requests. Please try again later.' });
    return null;
  }
  const token = req.params.token;
  const registration = typeof token === 'string' && token.length >= 20 && token.length <= 100
    ? await prisma.registration.findUnique({ where: { statusTokenHash: hashToken(token) } })
    : null;
  if (!registration) {
    res.status(404).json({ error: 'Application not found' });
    return null;
  }
  const endedAt = registration.decidedAt ?? registration.withdrawnAt;
  if (endedAt && Date.now() - endedAt.getTime() > STATUS_LINK_DAYS * 24 * 60 * 60 * 1000) {
    res.status(410).json({ error: 'This status link has expired' });
    return null;
  }
  return registration;
}

/**
 * What a status link shows: the application as it was sent and where it
 * stands. Nothing about other applications or the organiser's inbox.
 */
export const getStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const registration = await byStatusToken(req, res);
    if (!registration) return;
    const competition = await competitionOfWindow(registration.windowId);
    if (!competition) {
      res.status(404).json({ error: 'Application not found' });
      return;
    }
    const waitlistPosition = registration.status === 'WAITLISTED'
      ? 1 + await prisma.registration.count({
          where: { windowId: registration.windowId, status: 'WAITLISTED', createdAt: { lt: registration.createdAt } },
        })
      : null;
    res.json({
      id: registration.id,
      status: registration.status,
      teamName: registration.teamName,
      primaryColor: registration.primaryColor,
      contactName: registration.contactName,
      email: registration.email,
      phone: registration.phone,
      note: registration.note,
      roster: registration.roster,
      reason: registration.reason,
      createdAt: registration.createdAt,
      decidedAt: registration.decidedAt,
      withdrawnAt: registration.withdrawnAt,
      waitlistPosition,
      competition: { kind: competition.kind, id: competition.id, name: competition.name },
    });
  } catch (error) {
    console.error('Get registration status error:', error);
    res.status(500).json({ error: 'Failed to load the application' });
  }
};

/** The holder of a status link takes the application back. */
export const withdrawByStatusToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const registration = await byStatusToken(req, res);
    if (!registration) return;
    await withdrawRegistration(registration, res);
  } catch (error) {
    console.error('Withdraw registration by link error:', error);
    res.status(500).json({ error: 'Failed to withdraw the application' });
  }
};

// ---------------------------------------------------------------- manager

/**
 * The form's settings as the manager edits them, with where it stands in its
 * life and its places; a competition with no form yet gets the defaults.
 */
const settingsView = async (competition: Competition) => {
  const capacity = await capacityOf(competition);
  return {
    ...(competition.window ?? {
      open: false, deadline: null, maxTeams: null, rules: null, rulesVersion: 1, fee: null, publishedAt: null, closedAt: null,
    }),
    lifecycle: lifecycleOf(competition, capacity),
    capacity,
    // A tournament's plan and its team limit, so the form can say why the
    // maximum stops where it does; null for a season.
    plan: competition.allowance,
    // For the publish confirmation and the ready-made share messages.
    competitionName: competition.name,
  };
};

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
    res.json(await settingsView(competition));
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
    // A plan waiting for payment already counts: the organiser may open its places.
    const planLimit = capacityLimit(competition.allowance);
    if (typeof data.maxTeams === 'number' && planLimit !== null && data.maxTeams > planLimit) {
      res.status(409).json(planLimitBody(new PlanLimitError(competition.allowance!)));
      return;
    }

    // Changed rules are a new version: later applicants accept the new text,
    // and the earlier ones keep the record of what they accepted.
    const rulesChanged = data.rules !== undefined && competition.window && data.rules !== competition.window.rules;
    // Publishing is remembered once, at the first opening; closing each time.
    const wasOpen = competition.window?.open ?? false;
    if (data.open === true && !wasOpen && !competition.window?.publishedAt) data.publishedAt = new Date();
    if (data.open === false && wasOpen) data.closedAt = new Date();
    const target = kind === 'season' ? { seasonId: competition.id } : { tournamentId: competition.id };
    const window = await prisma.registrationWindow.upsert({
      where: target,
      create: { ...target, ...(data as Prisma.RegistrationWindowUncheckedCreateInput) },
      update: { ...data, ...(rulesChanged && { rulesVersion: { increment: 1 } }) },
    });
    res.json(await settingsView({ ...competition, window }));
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
          include: {
            existingTeam: { select: { id: true, name: true } },
            promotedBy: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'asc' },
        })
      : [];
    const order: RegistrationStatus[] = ['PENDING', 'WAITLISTED', 'APPROVED', 'REJECTED', 'WITHDRAWN'];
    rows.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
    res.json({
      registrations: rows.map(view),
      capacity: await capacityOf(competition),
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
  decision: 'APPROVED' | 'REJECTED' | 'WAITLISTED' | 'PROMOTED'
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
      locale: localeOf(registration.locale),
    })
    .catch((error) => console.error('Registration decision email error:', error));
};

class Full extends Error {}
class AlreadyIn extends Error {}

const FULL_ERROR = 'The competition is full. Raise the maximum or remove a team first.';
const HELD_ERROR = 'The free places are held by pending applications. Decide those first or raise the maximum.';

/**
 * Accepts an application and puts the team in the competition, in one
 * transaction with the capacity check so two approvals cannot pass the
 * maximum between them. A pending application holds its place; one from the
 * waiting list may only take a place no pending application holds.
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
      // Approvals of one competition run one at a time, so each counts the
      // teams the one before it added.
      await lockCompetition(tx, competition.kind, competition.id);
      const teams = competition.kind === 'season'
        ? await tx.seasonTeam.count({ where: { seasonId: competition.id } })
        : await tx.tournamentTeam.count({ where: { tournamentId: competition.id } });
      const allowance = competition.kind === 'tournament' ? await teamAllowance(competition.id, tx) : null;
      const formMax = competition.window?.maxTeams ?? null;
      if (formMax !== null && teams >= formMax) throw new Full(FULL_ERROR);
      if (registration.status === 'WAITLISTED') {
        const max = maxOf({ ...competition, allowance });
        const pending = await tx.registration.count({ where: { windowId: registration.windowId, status: 'PENDING' } });
        if (max !== null && teams + pending >= max) throw new Full(HELD_ERROR);
      }
      // Places a plan waiting for payment opened can be applied for, not filled yet.
      if (allowance && allowance.limit !== null && teams >= allowance.limit) throw new PlanLimitError({ ...allowance, teams });

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
    res.json(view(updated));
  } catch (error) {
    if (error instanceof PlanLimitError) {
      res.status(409).json(planLimitBody(error));
      return;
    }
    if (error instanceof Full) {
      res.status(409).json({ error: error.message });
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
    res.json(view(updated));
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
    res.json(view(updated));
  } catch (error) {
    console.error('Waitlist registration error:', error);
    res.status(500).json({ error: 'Failed to move the application to the waiting list' });
  }
};

/**
 * Moves an application up from the waiting list into the queue, once a place
 * is free. Nobody moves up by themselves: the manager picks, usually the
 * oldest, and picking another one is recorded.
 */
export const promote = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const found = await forDecision(req, res);
    if (!found) return;
    const { registration, competition } = found;
    if (registration.status !== 'WAITLISTED') {
      res.status(409).json({ error: 'Only an application on the waiting list can be moved up' });
      return;
    }
    if (competition.archived) {
      res.status(400).json({ error: 'The competition is finished' });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      await lockCompetition(tx, competition.kind, competition.id);
      const capacity = await capacityOf(competition, tx);
      if (capacity.free === 0) throw new Full('No place is free. Decide a pending application or raise the maximum first.');
      const oldest = await tx.registration.findFirst({
        where: { windowId: registration.windowId, status: 'WAITLISTED' },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      return tx.registration.update({
        where: { id: registration.id },
        data: {
          status: 'PENDING',
          promotedAt: new Date(),
          promotedById: req.user!.id,
          promotedOutOfOrder: oldest?.id !== registration.id,
        },
      });
    });

    notifyDecision(updated, competition, 'PROMOTED');
    res.json(view(updated));
  } catch (error) {
    if (error instanceof Full) {
      res.status(409).json({ error: error.message });
      return;
    }
    console.error('Promote registration error:', error);
    res.status(500).json({ error: 'Failed to move the application up' });
  }
};

// ---------------------------------------------------------------- funnel

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const HOUR_MS = 60 * 60 * 1000;

/**
 * For the admin: whether organisers find the forms and teams use them, worked
 * out from what the database already holds. The figure that matters most is
 * the share of published forms that brought at least one application.
 */
export const getFunnel = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [seasons, tournaments, windows] = await Promise.all([
      prisma.season.count(),
      prisma.tournament.count(),
      prisma.registrationWindow.findMany({
        where: { publishedAt: { not: null } },
        select: {
          publishedAt: true,
          season: { select: { createdAt: true } },
          tournament: { select: { createdAt: true } },
          registrations: { select: { status: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
        },
      }),
    ]);
    const withApplications = windows.filter((window) => window.registrations.length > 0);
    const statuses = windows.flatMap((window) => window.registrations.map((row) => row.status));
    const approved = statuses.filter((status) => status === 'APPROVED').length;
    const decided = approved + statuses.filter((status) => status === 'REJECTED').length;
    res.json({
      competitions: seasons + tournaments,
      published: windows.length,
      publishedWithApplications: withApplications.length,
      applications: statuses.length,
      approvalRate: decided > 0 ? approved / decided : null,
      medianHoursToPublish: median(windows.map((window) =>
        (window.publishedAt!.getTime() - (window.season ?? window.tournament)!.createdAt.getTime()) / HOUR_MS)),
      medianHoursToFirstApplication: median(withApplications.map((window) =>
        (window.registrations[0].createdAt.getTime() - window.publishedAt!.getTime()) / HOUR_MS)),
    });
  } catch (error) {
    console.error('Registration funnel error:', error);
    res.status(500).json({ error: 'Failed to load the registration funnel' });
  }
};

const MANAGED_LIMIT = 30;

/**
 * The running seasons and tournaments the caller runs, with where their sign-up
 * form stands and how many applications wait for a decision, for the
 * dashboard. Ownership is the manager relation even for an admin, who would
 * otherwise see every competition there is.
 */
export const listManaged = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const [seasons, tournaments] = await Promise.all([
      prisma.season.findMany({
        where: { league: { managerId: userId }, archivedAt: null, status: { not: 'COMPLETED' } },
        include: { league: { select: { name: true } }, registrationWindow: true, _count: { select: { seasonTeams: true } } },
      }),
      prisma.tournament.findMany({
        where: { series: { managerId: userId }, status: { not: 'COMPLETED' } },
        include: { series: { select: { name: true } }, registrationWindow: true, _count: { select: { teams: true } } },
      }),
    ]);
    const competitions: Competition[] = [
      ...seasons.map((season): Competition => ({
        kind: 'season',
        id: season.id,
        name: season.name,
        parentName: season.league.name,
        sport: '',
        archived: false,
        teamCount: season._count.seasonTeams,
        managers: [],
        window: season.registrationWindow,
        allowance: null,
      })),
      ...(await Promise.all(tournaments.map(async (tournament): Promise<Competition> => ({
        kind: 'tournament',
        id: tournament.id,
        name: tournament.name,
        parentName: tournament.series.name,
        sport: '',
        archived: false,
        teamCount: tournament._count.teams,
        managers: [],
        window: tournament.registrationWindow,
        allowance: await teamAllowance(tournament.id),
      })))),
    ];
    const windowIds = competitions.flatMap((competition) => (competition.window ? [competition.window.id] : []));
    const counts = windowIds.length > 0
      ? await prisma.registration.groupBy({
          by: ['windowId', 'status'],
          where: { windowId: { in: windowIds }, status: { in: ['PENDING', 'WAITLISTED'] } },
          _count: { _all: true },
        })
      : [];
    const count = (windowId: string | undefined, status: RegistrationStatus) =>
      counts.find((row) => row.windowId === windowId && row.status === status)?._count._all ?? 0;

    const rows = competitions.map((competition) => {
      const pending = count(competition.window?.id, 'PENDING');
      const waitlisted = count(competition.window?.id, 'WAITLISTED');
      const capacity = capacityFrom(competition.teamCount, pending, waitlisted, maxOf(competition));
      return {
        kind: competition.kind,
        id: competition.id,
        name: competition.name,
        parentName: competition.parentName,
        lifecycle: lifecycleOf(competition, capacity),
        pending,
        waitlisted,
        inboxPath: inboxLink(competition).slice(appUrl().length),
      };
    });
    // Work waiting first, then the forms still to publish, then the rest.
    const rank = (row: (typeof rows)[number]) => (row.pending > 0 ? 0 : row.lifecycle === 'DRAFT' ? 2 : 1);
    rows.sort((a, b) => rank(a) - rank(b) || b.pending - a.pending || a.name.localeCompare(b.name));
    res.json(rows.slice(0, MANAGED_LIMIT));
  } catch (error) {
    console.error('List managed registrations error:', error);
    res.status(500).json({ error: 'Failed to load your competitions' });
  }
};
