import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import prisma from '../config/database.js';
import emailService from './emailService.js';
import { normalizeEmail } from '../utils/email.js';
import { localeOf } from '../i18n/index.js';

/**
 * Inviting someone to manage a team or a league, or a player to take their
 * spot on a roster.
 *
 * Nothing is granted when the invite is sent: the manager relation (or the
 * player's account link) is written only when the invitee opens the link and
 * accepts it, signing in or creating their account on the way. Until then the
 * inviter sees the team or player as "Invited" and may resend or cancel it.
 *
 * The link carries a random token; only its SHA-256 is stored, so a link that
 * was lost is replaced by resending, never read back.
 */

export const INVITE_TTL_DAYS = 7;

export type InviteTarget = { teamId: string } | { leagueId: string } | { playerId: string };

export type InviteKind = 'TEAM' | 'LEAGUE' | 'PLAYER';

export type InviteStatus = 'PENDING' | 'EXPIRED' | 'ACCEPTED' | 'REVOKED';

const hashToken = (token: string): string => crypto.createHash('sha256').update(token).digest('hex');

const newToken = (): { token: string; tokenHash: string } => {
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, tokenHash: hashToken(token) };
};

const expiryFromNow = (): Date => new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

export const inviteLink = (token: string): string =>
  `${process.env.APP_URL || 'http://localhost:5173'}/invite/${token}`;

const teamSelect = {
  id: true,
  name: true,
  primaryColor: true,
  managerId: true,
  seasonTeams: {
    select: { season: { select: { name: true, startDate: true, league: { select: { name: true } } } } },
  },
} as const;

const inviteInclude = {
  team: { select: teamSelect },
  league: { select: { id: true, name: true, managerId: true } },
  player: { select: { id: true, name: true, number: true, userId: true, team: { select: teamSelect } } },
  invitedBy: { select: { id: true, name: true, email: true } },
} as const;

type InviteRow = NonNullable<Awaited<ReturnType<typeof findInvite>>>;

const findInvite = (where: { id: string } | { tokenHash: string }) =>
  prisma.managerInvite.findUnique({ where, include: inviteInclude });

export const inviteStatus = (invite: { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date }): InviteStatus => {
  if (invite.acceptedAt) return 'ACCEPTED';
  if (invite.revokedAt) return 'REVOKED';
  if (invite.expiresAt < new Date()) return 'EXPIRED';
  return 'PENDING';
};

const inviteKind = (invite: { teamId: string | null; playerId: string | null }): InviteKind =>
  invite.playerId ? 'PLAYER' : invite.teamId ? 'TEAM' : 'LEAGUE';

/** The team an invite is about: the one to manage, or the player's. */
const inviteTeam = (invite: InviteRow) => invite.team ?? invite.player?.team ?? null;

/** The newest season the team plays in, which is what the invite is "for". */
const latestSeason = (invite: InviteRow) =>
  inviteTeam(invite)?.seasonTeams
    .map((st) => st.season)
    .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())[0] ?? null;

/** What the inviter sees about an invite they sent. Never carries the token. */
export const toInviteSummary = (invite: {
  id: string;
  teamId: string | null;
  leagueId: string | null;
  playerId: string | null;
  email: string;
  name: string;
  locale: string;
  sentAt: Date;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
}) => ({
  id: invite.id,
  teamId: invite.teamId,
  leagueId: invite.leagueId,
  playerId: invite.playerId,
  email: invite.email,
  name: invite.name,
  locale: invite.locale,
  sentAt: invite.sentAt,
  expiresAt: invite.expiresAt,
  status: inviteStatus(invite),
});

const sendInviteEmail = async (invite: InviteRow, token: string): Promise<void> => {
  const hasAccount = !!(await prisma.user.findUnique({ where: { email: invite.email }, select: { id: true } }));
  const season = latestSeason(invite);
  await emailService.sendManagerInvitationEmail({
    to: invite.email,
    inviteeName: invite.name,
    kind: inviteKind(invite),
    targetName: inviteTeam(invite)?.name ?? invite.league!.name,
    contextName: season ? `${season.league.name} · ${season.name}` : null,
    inviterName: invite.invitedBy?.name ?? null,
    inviterEmail: invite.invitedBy?.email ?? null,
    link: inviteLink(token),
    expiresAt: invite.expiresAt,
    hasAccount,
    locale: localeOf(invite.locale),
  });
};

/**
 * Starts a new invitation for a team, league or player. Any invite still
 * pending for the same target is cancelled, so there is only ever one live
 * link per team (or player).
 */
export const createInvite = async (params: {
  target: InviteTarget;
  email: string;
  name: string;
  locale?: string;
  invitedById: string;
}) => {
  const { token, tokenHash } = newToken();
  const targetWhere =
    'teamId' in params.target ? { teamId: params.target.teamId }
    : 'leagueId' in params.target ? { leagueId: params.target.leagueId }
    : { playerId: params.target.playerId };

  const created = await prisma.$transaction(async (tx) => {
    await tx.managerInvite.updateMany({
      where: { ...targetWhere, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return tx.managerInvite.create({
      data: {
        ...targetWhere,
        email: normalizeEmail(params.email),
        name: params.name.trim(),
        locale: localeOf(params.locale),
        tokenHash,
        expiresAt: expiryFromNow(),
        invitedById: params.invitedById,
      },
    });
  });

  const invite = (await findInvite({ id: created.id }))!;
  sendInviteEmail(invite, token).catch((err) => console.error('Failed to send invitation:', err));
  return { invite: toInviteSummary(invite), link: inviteLink(token) };
};

/** The invite as it stands, for permission checks on resend/cancel. */
export const getInviteTarget = (id: string) =>
  prisma.managerInvite.findUnique({ where: { id }, select: { id: true, teamId: true, leagueId: true, playerId: true, acceptedAt: true, revokedAt: true, expiresAt: true } });

/**
 * Issues a fresh link for an invite that has not been accepted or cancelled.
 * The old link stops working and the week starts again.
 */
export const resendInvite = async (id: string) => {
  const { token, tokenHash } = newToken();
  await prisma.managerInvite.update({
    where: { id },
    data: { tokenHash, expiresAt: expiryFromNow(), sentAt: new Date() },
  });
  const invite = (await findInvite({ id }))!;
  sendInviteEmail(invite, token).catch((err) => console.error('Failed to resend invitation:', err));
  return { invite: toInviteSummary(invite), link: inviteLink(token) };
};

export const revokeInvite = async (id: string) => {
  const invite = await prisma.managerInvite.update({ where: { id }, data: { revokedAt: new Date() } });
  return toInviteSummary(invite);
};

/** Invites still waiting for an answer (pending or expired, not cancelled). */
export const openInvitesWhere = { acceptedAt: null, revokedAt: null } as const;

export const findByToken = (token: string) => findInvite({ tokenHash: hashToken(token) });

/** What the person holding the link may see before accepting. */
export const toPublicInvite = async (invite: InviteRow) => {
  const season = latestSeason(invite);
  const hasAccount = !!(await prisma.user.findUnique({ where: { email: invite.email }, select: { id: true } }));
  const team = inviteTeam(invite);
  return {
    status: inviteStatus(invite),
    kind: inviteKind(invite),
    email: invite.email,
    name: invite.name,
    team: team ? { id: team.id, name: team.name, primaryColor: team.primaryColor } : null,
    league: invite.league ? { id: invite.league.id, name: invite.league.name } : null,
    player: invite.player ? { name: invite.player.name, number: invite.player.number } : null,
    seasonName: season?.name ?? null,
    leagueName: season?.league.name ?? invite.league?.name ?? null,
    invitedByName: invite.invitedBy?.name ?? null,
    expiresAt: invite.expiresAt,
    hasAccount,
  };
};

/**
 * Hands the team or league (or the roster spot) to the accepting user and
 * closes the invite, in one transaction so a link cannot be used twice.
 * `resolveUser` runs inside it and returns the user's id; for someone new it
 * creates the account, which is then rolled back if the invite turns out to be
 * gone or the roster spot cannot be taken.
 */
export const acceptInvite = async (
  inviteId: string,
  resolveUser: (tx: Prisma.TransactionClient) => Promise<string>,
): Promise<string> =>
  prisma.$transaction(async (tx) => {
    const claimed = await tx.managerInvite.updateMany({
      where: { id: inviteId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { acceptedAt: new Date() },
    });
    if (claimed.count !== 1) throw new InviteUnavailableError();

    const userId = await resolveUser(tx);
    const invite = await tx.managerInvite.findUniqueOrThrow({ where: { id: inviteId } });
    if (invite.teamId) {
      await tx.team.update({ where: { id: invite.teamId }, data: { managerId: userId } });
    } else if (invite.leagueId) {
      await tx.league.update({ where: { id: invite.leagueId }, data: { managerId: userId } });
    } else if (invite.playerId) {
      // The same rules as linking by hand: the spot is still free, and one
      // person holds at most one spot per team.
      const player = await tx.player.findUniqueOrThrow({ where: { id: invite.playerId }, select: { teamId: true, userId: true } });
      if (player.userId && player.userId !== userId) throw new InviteConflictError('PLAYER_TAKEN');
      const elsewhere = await tx.player.findFirst({
        where: { teamId: player.teamId, userId, id: { not: invite.playerId } },
        select: { id: true },
      });
      if (elsewhere) throw new InviteConflictError('ALREADY_ON_TEAM');
      await tx.player.update({ where: { id: invite.playerId }, data: { userId } });
    }
    return userId;
  });

export class InviteUnavailableError extends Error {
  constructor() {
    super('This invitation is no longer valid');
  }
}

/** The invite is valid, but the roster spot it offers cannot be taken. */
export class InviteConflictError extends Error {
  constructor(public readonly code: 'PLAYER_TAKEN' | 'ALREADY_ON_TEAM') {
    super(
      code === 'PLAYER_TAKEN'
        ? 'This player is already linked to another account'
        : 'Your account already holds a different spot on this team',
    );
  }
}
