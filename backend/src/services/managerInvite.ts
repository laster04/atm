import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import prisma from '../config/database.js';
import emailService from './emailService.js';
import { normalizeEmail } from '../utils/email.js';

/**
 * Inviting someone to manage a team or a league.
 *
 * Nothing is granted when the invite is sent: the manager relation is written
 * only when the invitee opens the link and accepts it, signing in or creating
 * their account on the way. Until then the inviter sees the team as "Invited"
 * and may resend or cancel it.
 *
 * The link carries a random token; only its SHA-256 is stored, so a link that
 * was lost is replaced by resending, never read back.
 */

export const INVITE_TTL_DAYS = 7;

export type InviteTarget = { teamId: string } | { leagueId: string };

export type InviteStatus = 'PENDING' | 'EXPIRED' | 'ACCEPTED' | 'REVOKED';

const hashToken = (token: string): string => crypto.createHash('sha256').update(token).digest('hex');

const newToken = (): { token: string; tokenHash: string } => {
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, tokenHash: hashToken(token) };
};

const expiryFromNow = (): Date => new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

export const inviteLink = (token: string): string =>
  `${process.env.APP_URL || 'http://localhost:5173'}/invite/${token}`;

const inviteInclude = {
  team: {
    select: {
      id: true,
      name: true,
      primaryColor: true,
      managerId: true,
      seasonTeams: {
        select: { season: { select: { name: true, startDate: true, league: { select: { name: true } } } } },
      },
    },
  },
  league: { select: { id: true, name: true, managerId: true } },
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

/** The newest season a team plays in, which is what the invite is "for". */
const latestSeason = (invite: InviteRow) =>
  invite.team?.seasonTeams
    .map((st) => st.season)
    .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())[0] ?? null;

/** What the inviter sees about an invite they sent. Never carries the token. */
export const toInviteSummary = (invite: {
  id: string;
  teamId: string | null;
  leagueId: string | null;
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
    kind: invite.team ? 'TEAM' : 'LEAGUE',
    targetName: invite.team?.name ?? invite.league!.name,
    contextName: season ? `${season.league.name} · ${season.name}` : null,
    inviterName: invite.invitedBy?.name ?? null,
    inviterEmail: invite.invitedBy?.email ?? null,
    link: inviteLink(token),
    expiresAt: invite.expiresAt,
    hasAccount,
    locale: invite.locale,
  });
};

/**
 * Starts a new invitation for a team or league. Any invite still pending for
 * the same target is cancelled, so there is only ever one live link per team.
 */
export const createInvite = async (params: {
  target: InviteTarget;
  email: string;
  name: string;
  locale?: string;
  invitedById: string;
}) => {
  const { token, tokenHash } = newToken();
  const targetWhere = 'teamId' in params.target ? { teamId: params.target.teamId } : { leagueId: params.target.leagueId };

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
        locale: params.locale === 'en' ? 'en' : 'cs',
        tokenHash,
        expiresAt: expiryFromNow(),
        invitedById: params.invitedById,
      },
    });
  });

  const invite = (await findInvite({ id: created.id }))!;
  sendInviteEmail(invite, token).catch((err) => console.error('Failed to send manager invitation:', err));
  return { invite: toInviteSummary(invite), link: inviteLink(token) };
};

/** The invite as it stands, for permission checks on resend/cancel. */
export const getInviteTarget = (id: string) =>
  prisma.managerInvite.findUnique({ where: { id }, select: { id: true, teamId: true, leagueId: true, acceptedAt: true, revokedAt: true, expiresAt: true } });

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
  sendInviteEmail(invite, token).catch((err) => console.error('Failed to resend manager invitation:', err));
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
  return {
    status: inviteStatus(invite),
    kind: invite.team ? ('TEAM' as const) : ('LEAGUE' as const),
    email: invite.email,
    name: invite.name,
    team: invite.team ? { id: invite.team.id, name: invite.team.name, primaryColor: invite.team.primaryColor } : null,
    league: invite.league ? { id: invite.league.id, name: invite.league.name } : null,
    seasonName: season?.name ?? null,
    leagueName: season?.league.name ?? invite.league?.name ?? null,
    invitedByName: invite.invitedBy?.name ?? null,
    expiresAt: invite.expiresAt,
    hasAccount,
  };
};

/**
 * Hands the team or league to the accepting user and closes the invite, in one
 * transaction so a link cannot be used twice. `resolveUser` runs inside it and
 * returns the user's id; for someone new it creates the account, which is then
 * rolled back if the invite turns out to be gone.
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
    }
    return userId;
  });

export class InviteUnavailableError extends Error {
  constructor() {
    super('This invitation is no longer valid');
  }
}
