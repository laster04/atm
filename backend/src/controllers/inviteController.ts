import { Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/database.js';
import { canAdministerTeam, isAdmin } from '../services/access.js';
import {
  acceptInvite,
  createInvite,
  findByToken,
  getInviteTarget,
  inviteStatus,
  InviteUnavailableError,
  openInvitesWhere,
  resendInvite,
  revokeInvite,
  toInviteSummary,
  toPublicInvite,
} from '../services/managerInvite.js';
import { startSession } from './authController.js';
import { AuthRequest, AuthUser, InviteManagerRequest } from '../types/index.js';

const MIN_PASSWORD_LENGTH = 6;

const readInviteBody = (req: AuthRequest, res: Response): InviteManagerRequest | null => {
  const { email, name, locale } = req.body as InviteManagerRequest;
  if (!email?.trim() || !name?.trim()) {
    res.status(400).json({ error: 'Email and name are required' });
    return null;
  }
  return { email, name, locale };
};

/** POST /teams/:id/invite-manager — guarded by requireTeamAdmin. */
export const inviteTeamManager = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const body = readInviteBody(req, res);
    if (!body) return;
    const team = await prisma.team.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }
    const result = await createInvite({ target: { teamId: team.id }, ...body, invitedById: req.user!.id });
    res.status(201).json(result);
  } catch (error) {
    console.error('Invite team manager error:', error);
    res.status(500).json({ error: 'Failed to invite manager' });
  }
};

/** POST /leagues/:id/invite-manager — administrators only. */
export const inviteLeagueManager = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const body = readInviteBody(req, res);
    if (!body) return;
    const league = await prisma.league.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!league) {
      res.status(404).json({ error: 'League not found' });
      return;
    }
    const result = await createInvite({ target: { leagueId: league.id }, ...body, invitedById: req.user!.id });
    res.status(201).json(result);
  } catch (error) {
    console.error('Invite season manager error:', error);
    res.status(500).json({ error: 'Failed to invite manager' });
  }
};

/** Open invites (pending or expired) for every team in a season. */
export const getSeasonInvites = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const invites = await prisma.managerInvite.findMany({
      where: { ...openInvitesWhere, team: { seasonTeams: { some: { seasonId: req.params.seasonId } } } },
      orderBy: { sentAt: 'desc' },
    });
    res.json(invites.map(toInviteSummary));
  } catch (error) {
    console.error('Get season invites error:', error);
    res.status(500).json({ error: 'Failed to fetch invitations' });
  }
};

/** The open invite for one team, if any. */
export const getTeamInvite = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const invite = await prisma.managerInvite.findFirst({
      where: { ...openInvitesWhere, teamId: req.params.id },
      orderBy: { sentAt: 'desc' },
    });
    res.json(invite ? toInviteSummary(invite) : null);
  } catch (error) {
    console.error('Get team invite error:', error);
    res.status(500).json({ error: 'Failed to fetch invitation' });
  }
};

/** Open season-manager invites across every league; administrators only. */
export const getLeagueInvites = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const invites = await prisma.managerInvite.findMany({
      where: { ...openInvitesWhere, leagueId: { not: null } },
      orderBy: { sentAt: 'desc' },
    });
    res.json(invites.map(toInviteSummary));
  } catch (error) {
    console.error('Get league invites error:', error);
    res.status(500).json({ error: 'Failed to fetch invitations' });
  }
};

/**
 * Whoever may send an invite may also resend or cancel it: the season side for
 * a team, an administrator for a league.
 */
const canHandleInvite = async (user: AuthUser, invite: { teamId: string | null; leagueId: string | null }) => {
  if (invite.teamId) return canAdministerTeam(user, invite.teamId);
  return isAdmin(user);
};

const loadHandledInvite = async (req: AuthRequest, res: Response) => {
  const invite = await getInviteTarget(req.params.id);
  if (!invite) {
    res.status(404).json({ error: 'Invitation not found' });
    return null;
  }
  if (!(await canHandleInvite(req.user!, invite))) {
    res.status(403).json({ error: 'Access denied' });
    return null;
  }
  if (invite.acceptedAt || invite.revokedAt) {
    res.status(409).json({ error: 'This invitation was already accepted or cancelled' });
    return null;
  }
  return invite;
};

export const resend = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const invite = await loadHandledInvite(req, res);
    if (!invite) return;
    res.json(await resendInvite(invite.id));
  } catch (error) {
    console.error('Resend invite error:', error);
    res.status(500).json({ error: 'Failed to resend invitation' });
  }
};

export const revoke = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const invite = await loadHandledInvite(req, res);
    if (!invite) return;
    res.json(await revokeInvite(invite.id));
  } catch (error) {
    console.error('Revoke invite error:', error);
    res.status(500).json({ error: 'Failed to cancel invitation' });
  }
};

/** GET /invites/token/:token — public; the link itself is the credential. */
export const getByToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const invite = await findByToken(req.params.token);
    if (!invite) {
      res.status(404).json({ error: 'Invitation not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(await toPublicInvite(invite));
  } catch (error) {
    console.error('Get invite by token error:', error);
    res.status(500).json({ error: 'Failed to load invitation' });
  }
};

/**
 * POST /invites/token/:token/accept
 *
 * Someone who already has an account must be signed in as that account. Anyone
 * else sends a name and password; the account is created already verified,
 * because opening the emailed link proves the address.
 */
export const accept = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const invite = await findByToken(req.params.token);
    if (!invite) {
      res.status(404).json({ error: 'Invitation not found', code: 'NOT_FOUND' });
      return;
    }
    const status = inviteStatus(invite);
    if (status !== 'PENDING') {
      res.status(410).json({ error: 'This invitation is no longer valid', code: status });
      return;
    }

    const target = { kind: invite.teamId ? 'TEAM' : 'LEAGUE', teamId: invite.teamId, leagueId: invite.leagueId };
    const existing = await prisma.user.findUnique({ where: { email: invite.email }, select: { id: true, active: true } });

    if (existing) {
      if (!req.user) {
        res.status(401).json({ error: 'Sign in to accept this invitation', code: 'SIGN_IN_REQUIRED' });
        return;
      }
      if (req.user.id !== existing.id) {
        res.status(403).json({ error: 'This invitation is for a different account', code: 'WRONG_ACCOUNT' });
        return;
      }
      await acceptInvite(invite.id, async () => existing.id);
      res.json({ ...target, session: null });
      return;
    }

    const { name, password } = req.body as { name?: string; password?: string };
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`, code: 'WEAK_PASSWORD' });
      return;
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = await acceptInvite(invite.id, async (tx) => {
      const user = await tx.user.create({
        data: {
          email: invite.email,
          password: hashedPassword,
          name: name?.trim() || invite.name,
          active: true,
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
        select: { id: true },
      });
      return user.id;
    });
    res.status(201).json({ ...target, session: await startSession(userId) });
  } catch (error) {
    if (error instanceof InviteUnavailableError) {
      res.status(410).json({ error: error.message, code: 'UNAVAILABLE' });
      return;
    }
    console.error('Accept invite error:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
};
