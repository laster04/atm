import type { GameStatus, SportType } from '@prisma/client';
import prisma, { type DbClient } from '../../config/database.js';
import { auditSnapshot, recordAudit } from '../audit/record.js';

/**
 * Both teams say how a league game ended; when they say the same thing, the
 * season manager has nothing left to check.
 *
 * Each team's manager sends one claim per game, which a second send replaces.
 * Two claims with the same score complete and confirm the game at once, if the
 * season allows it. Two that differ, or a claim that contradicts a score
 * already on the game, leave the game alone: the season manager sees both and
 * decides, as before.
 */

/** Sports whose result is more than a score. Their tables need sets and balls. */
const NOT_CLAIMABLE_SPORTS: SportType[] = ['VOLLEYBALL', 'TENNIS'];

export type ClaimBlock = 'SPORT' | 'CONFIRMED' | 'ARCHIVED' | 'NOT_PLAYED_YET' | 'NOT_PLAYED';

export type ClaimOutcome =
  /** Only one team has sent its score. */
  | 'WAITING'
  /** Both agree and the game is now confirmed. */
  | 'CONFIRMED'
  /** Both agree, but the season leaves confirmation to its manager. */
  | 'AGREED'
  /** The two teams report different scores. */
  | 'DISAGREE'
  /** Both agree, but the game already holds another score: its event log, or one entered by hand. */
  | 'CONFLICTS_WITH_GAME'
  /** Both agree on a draw, which a play-off game cannot end in. */
  | 'NEEDS_WINNER';

interface ClaimableGame {
  date: Date | null;
  status: GameStatus;
  confirmedAt: Date | null;
  season: { archivedAt: Date | null; league: { sportType: SportType } };
}

/** Why a team cannot send a score for this game now, or null when it can. */
export const claimBlock = (game: ClaimableGame, now = new Date()): ClaimBlock | null => {
  if (NOT_CLAIMABLE_SPORTS.includes(game.season.league.sportType)) return 'SPORT';
  if (game.season.archivedAt) return 'ARCHIVED';
  if (game.confirmedAt) return 'CONFIRMED';
  if (game.status === 'POSTPONED' || game.status === 'CANCELLED') return 'NOT_PLAYED';
  // A result can only be reported for a game that has started.
  if (!game.date || game.date > now) return 'NOT_PLAYED_YET';
  return null;
};

const GAME_AUDIT_FIELDS = ['homeScore', 'awayScore', 'status', 'confirmedAt'] as const;

/**
 * Compares the two claims on a game and, when they agree, settles it. Runs in
 * the transaction that wrote the claim, so the game and the claim that settled
 * it commit together. The caller syncs the play-off and calendar afterwards.
 */
export const settleClaims = async (
  tx: DbClient,
  gameId: string,
  actorId: string | null
): Promise<ClaimOutcome> => {
  const game = await tx.game.findUniqueOrThrow({
    where: { id: gameId },
    include: {
      season: { select: { autoConfirmAgreed: true } },
      resultClaims: true,
    },
  });

  const state = claimState(game, game.season.autoConfirmAgreed);
  if (state !== 'CONFIRMED') return state ?? 'WAITING';

  const { homeScore, awayScore } = game.resultClaims[0];
  const updated = await tx.game.update({
    where: { id: gameId },
    data: {
      ...(!game.eventsAuthoritative && { homeScore, awayScore }),
      status: 'COMPLETED',
      confirmedAt: new Date(),
      // Nobody confirmed it by hand; the trail names who sent the deciding claim.
      confirmedById: null,
    },
  });
  await recordAudit(
    {
      entityType: 'Game',
      entityId: gameId,
      action: 'AUTO_CONFIRM',
      before: auditSnapshot(game, [...GAME_AUDIT_FIELDS]),
      after: auditSnapshot(updated, [...GAME_AUDIT_FIELDS]),
      actorId,
    },
    tx
  );
  return 'CONFIRMED';
};

/** How the claims on a game stand, worked out without changing anything. */
export const claimState = (game: {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  status: GameStatus;
  eventsAuthoritative: boolean;
  playoffSeriesId: string | null;
  confirmedAt: Date | null;
  resultClaims: { teamId: string; homeScore: number; awayScore: number }[];
}, autoConfirmAgreed: boolean): ClaimOutcome | null => {
  const home = game.resultClaims.find(c => c.teamId === game.homeTeamId);
  const away = game.resultClaims.find(c => c.teamId === game.awayTeamId);
  if (!home && !away) return null;
  if (game.confirmedAt) return home && away ? 'CONFIRMED' : null;
  if (!home || !away) return 'WAITING';
  if (home.homeScore !== away.homeScore || home.awayScore !== away.awayScore) return 'DISAGREE';
  // A score the game already carries - derived from its event log, or entered
  // by the season manager - is not overwritten by the teams' word.
  const hasScore = game.eventsAuthoritative || (game.status === 'COMPLETED' && game.homeScore !== null);
  if (hasScore && (game.homeScore !== home.homeScore || game.awayScore !== home.awayScore)) return 'CONFLICTS_WITH_GAME';
  if (game.playoffSeriesId && home.homeScore === home.awayScore) return 'NEEDS_WINNER';
  return autoConfirmAgreed ? 'CONFIRMED' : 'AGREED';
};

/** The claims of every unsettled game in a season, for the season manager's list. */
export const seasonClaims = async (seasonId: string) => {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: { autoConfirmAgreed: true },
  });
  if (!season) return null;
  const games = await prisma.game.findMany({
    where: { seasonId, resultClaims: { some: {} } },
    select: {
      id: true, homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true,
      status: true, eventsAuthoritative: true, playoffSeriesId: true, confirmedAt: true,
      resultClaims: { select: { teamId: true, homeScore: true, awayScore: true, updatedAt: true } },
    },
  });
  return games.map(game => ({
    gameId: game.id,
    state: claimState(game, season.autoConfirmAgreed),
    claims: game.resultClaims,
  }));
};
