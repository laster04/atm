import crypto from 'crypto';
import type { SportType } from '@prisma/client';
import prisma from '../../config/database.js';
import { profileFor } from '../sports/profile.js';

/**
 * A link that lets someone without an account keep the report of one game:
 * the scorekeeper at the rink, a referee, a parent with a phone. Only the
 * season manager creates one; it opens a page that records goals for both
 * teams, and the score follows from them as it does for the manager.
 *
 * The link carries a random token and only its SHA-256 is stored, so a lost
 * link is replaced, never read back. Each game has at most one live link: a
 * new one cancels the old. It stops working two days after the game starts, or
 * when the season manager cancels it, and writes nothing once the game is
 * confirmed.
 */

/** How long after the start of the game the link keeps working. */
export const SCORER_LINK_HOURS = 48;

export const MAX_LABEL_LENGTH = 80;

export type ScorerLinkStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED';

/** Why the page cannot change the report now, or null when it can. */
export type ScorerBlock = 'CONFIRMED' | 'ARCHIVED' | 'HAND_STATS' | 'NOT_PLAYED';

export const hashToken = (token: string): string => crypto.createHash('sha256').update(token).digest('hex');

export const newToken = (): { token: string; tokenHash: string } => {
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, tokenHash: hashToken(token) };
};

export const scorerLinkUrl = (token: string): string =>
  `${process.env.APP_URL || 'http://localhost:5173'}/zapis/${token}`;

/**
 * Sports whose report a link can keep: those that record goals in their event
 * log. Tennis is left out, as for the results teams report, until its table
 * counts sets.
 */
export const scorerLinkSupported = (sport: SportType): boolean =>
  sport !== 'TENNIS' && profileFor(sport).events.includes('GOAL');

/** Two days after the game starts; for a game without a date, two days from now. */
export const linkExpiry = (gameDate: Date | null, now = new Date()): Date =>
  new Date(Math.max(now.getTime(), gameDate?.getTime() ?? 0) + SCORER_LINK_HOURS * 60 * 60 * 1000);

export const linkStatus = (
  link: { revokedAt: Date | null; expiresAt: Date },
  now = new Date()
): ScorerLinkStatus => {
  if (link.revokedAt) return 'REVOKED';
  if (link.expiresAt <= now) return 'EXPIRED';
  return 'ACTIVE';
};

/** What the season manager sees of a link. Never carries the token. */
export const toLinkSummary = (link: {
  id: string;
  label: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
}) => ({
  id: link.id,
  label: link.label,
  expiresAt: link.expiresAt,
  lastUsedAt: link.lastUsedAt,
  createdAt: link.createdAt,
  status: linkStatus(link),
});

/** The newest link of a game that was not cancelled; it may have expired. */
export const currentLink = (gameId: string) =>
  prisma.scorerLink.findFirst({
    where: { gameId, revokedAt: null },
    orderBy: { createdAt: 'desc' },
  });

export const findByToken = (token: string) =>
  prisma.scorerLink.findUnique({ where: { tokenHash: hashToken(token) } });

/** What the trail says about a change made through a link, since no account made it. */
export const viaLink = (link: { id: string; label: string | null }) => ({
  via: 'SCORER_LINK',
  scorerLinkId: link.id,
  scorer: link.label,
});
