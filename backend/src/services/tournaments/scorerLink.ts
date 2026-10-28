import type { Prisma, SportType } from '@prisma/client';
import prisma from '../../config/database.js';
import { profileFor } from '../sports/profile.js';
import { hashToken, scorerLinkSupported } from '../games/scorerLink.js';

/**
 * Scorer links for tournaments. At a one-day tournament the organiser cannot
 * write every result, so they hand a volunteer at each court a link to the
 * games played there (the games sharing a location). It works like the league
 * link: no account, only a SHA-256 of the token is stored, one live link per
 * court, and a new one cancels the old.
 *
 * The volunteer adds goals, each with its scorer and assist when known; the
 * score and the players' statistics are counted from them. A volleyball court
 * keeps set scores instead. Only paid tournament plans can hand links out.
 */

/** How long after the last game on the court the link keeps working. */
export const TOURNAMENT_LINK_HOURS_AFTER = 12;
/** For a court whose games have no dates yet. */
export const TOURNAMENT_LINK_HOURS_UNDATED = 48;

/** What a court's link records: goals, set scores, or nothing for this sport. */
export type ScorerMode = 'GOALS' | 'SETS';

/** Why the link cannot change a game now, or null when it can. */
export type TournamentScorerBlock = 'HAND_RESULT' | 'NOT_PLAYED' | 'TEAMS_UNKNOWN';

export const scorerModeFor = (sport: SportType): ScorerMode | null => {
  if (scorerLinkSupported(sport)) return 'GOALS';
  if (profileFor(sport).scoreIsPartsWon) return 'SETS';
  return null;
};

export const tournamentScorerLinkUrl = (token: string): string =>
  `${process.env.APP_URL || 'http://localhost:5173'}/zapis/t/${token}`;

const HOUR = 60 * 60 * 1000;

/**
 * Twelve hours after the last game on the court starts. Without game times the
 * tournament's last day stands in for them, and without that, two days from now.
 */
export const courtLinkExpiry = (lastGame: Date | null, endDate: Date | null, now = new Date()): Date => {
  const base = lastGame ?? (endDate ? new Date(endDate.getTime() + 24 * HOUR) : null);
  if (!base) return new Date(now.getTime() + TOURNAMENT_LINK_HOURS_UNDATED * HOUR);
  return new Date(Math.max(now.getTime(), base.getTime()) + TOURNAMENT_LINK_HOURS_AFTER * HOUR);
};

/** The newest link of a court that was not cancelled; it may have expired. */
export const currentCourtLink = (tournamentId: string, location: string) =>
  prisma.tournamentScorerLink.findFirst({
    where: { tournamentId, location, revokedAt: null },
    orderBy: { createdAt: 'desc' },
  });

export const findCourtLinkByToken = (token: string) =>
  prisma.tournamentScorerLink.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      tournament: {
        select: { id: true, name: true, endDate: true, scoring: true, series: { select: { name: true, sportType: true } } },
      },
    },
  });

export const blockFor = (game: {
  status: string;
  keptByLink: boolean;
  homeScore: number | null;
  awayScore: number | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
  _count: { statistics: number };
}): TournamentScorerBlock | null => {
  if (game.homeTeamId == null || game.awayTeamId == null) return 'TEAMS_UNKNOWN';
  if (game.status === 'POSTPONED' || game.status === 'CANCELLED') return 'NOT_PLAYED';
  // What the organiser entered by hand stays theirs; the link would overwrite it.
  if (!game.keptByLink && (game.homeScore != null || game.awayScore != null || game._count.statistics > 0)) {
    return 'HAND_RESULT';
  }
  return null;
};

/**
 * Counts the game's score and its players' goals and assists from the goals the
 * link wrote. The statistics of a game the link keeps are all its own, so they
 * are replaced whole.
 */
export async function recomputeFromGoals(
  tx: Prisma.TransactionClient,
  game: { id: string; homeTeamId: string; awayTeamId: string }
): Promise<void> {
  const goals = await tx.tournamentGoal.findMany({ where: { gameId: game.id } });

  const lines = new Map<string, { goals: number; assists: number }>();
  const line = (playerId: string) => {
    const existing = lines.get(playerId) ?? { goals: 0, assists: 0 };
    lines.set(playerId, existing);
    return existing;
  };
  for (const goal of goals) {
    if (goal.playerId) line(goal.playerId).goals += 1;
    if (goal.assistPlayerId) line(goal.assistPlayerId).assists += 1;
  }

  await tx.tournamentGameStatistic.deleteMany({ where: { gameId: game.id } });
  if (lines.size > 0) {
    await tx.tournamentGameStatistic.createMany({
      data: [...lines].map(([playerId, counts]) => ({ gameId: game.id, playerId, ...counts })),
    });
  }
  await tx.tournamentGame.update({
    where: { id: game.id },
    data: {
      keptByLink: true,
      homeScore: goals.filter(goal => goal.teamId === game.homeTeamId).length,
      awayScore: goals.filter(goal => goal.teamId === game.awayTeamId).length,
    },
  });
}
