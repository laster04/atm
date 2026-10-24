import { MatchEventType, SportType } from '@prisma/client';

/** A number a player line can carry. Each sport keeps a few of them. */
export type StatKey = 'goals' | 'assists' | 'penaltyMinutes' | 'yellowCards' | 'redCards' | 'points' | 'fouls';

export const STAT_KEYS: StatKey[] = ['goals', 'assists', 'penaltyMinutes', 'yellowCards', 'redCards', 'points', 'fouls'];

/** What one part of a game is called: hockey periods, football halves, basketball quarters, volleyball sets. */
export type PartKind = 'PERIOD' | 'HALF' | 'QUARTER' | 'SET';

export interface SportProfile {
  parts: {
    kind: PartKind;
    /** Parts in regulation. */
    regulation: number;
    /** Most parts a game can have, overtime included. */
    max: number;
  };
  /**
   * True when the final score is the parts won rather than goals or points
   * summed (volleyball: 3:1 in sets). The score is then worked out from the parts.
   */
  scoreIsPartsWon: boolean;
  /** The numbers a player line keeps, in the order tables show them. */
  stats: StatKey[];
  /** What a leaderboard ranks by: the sum of these, e.g. goals + assists for hockey. */
  rankBy: StatKey[];
  /** Event types the match report offers; empty when the sport has no event log yet. */
  events: MatchEventType[];
}

const HOCKEY_EVENTS: MatchEventType[] = ['GOAL', 'PENALTY', 'GOALIE_CHANGE', 'TIMEOUT', 'PERIOD_START', 'PERIOD_END', 'SHOOTOUT_ATTEMPT'];

const hockeyLike: SportProfile = {
  parts: { kind: 'PERIOD', regulation: 3, max: 5 },
  scoreIsPartsWon: false,
  stats: ['goals', 'assists', 'penaltyMinutes'],
  rankBy: ['goals', 'assists'],
  events: HOCKEY_EVENTS,
};

/**
 * How each sport is played and recorded. Every screen and query reads this
 * instead of assuming hockey; adding a sport is adding a row.
 *
 * Handball, tennis and "other" keep the hockey shape they always had until a
 * league asks for their own.
 *
 * Mirrored in frontend/src/utils/sportProfiles.ts; keep the two in step.
 */
export const SPORT_PROFILES: Record<SportType, SportProfile> = {
  HOCKEY: hockeyLike,
  FLOORBALL: hockeyLike,
  FOOTBALL: {
    parts: { kind: 'HALF', regulation: 2, max: 3 },
    scoreIsPartsWon: false,
    stats: ['goals', 'assists', 'yellowCards', 'redCards'],
    rankBy: ['goals'],
    events: ['GOAL', 'CARD', 'PERIOD_START', 'PERIOD_END', 'SHOOTOUT_ATTEMPT'],
  },
  BASKETBALL: {
    parts: { kind: 'QUARTER', regulation: 4, max: 7 },
    scoreIsPartsWon: false,
    stats: ['points', 'fouls'],
    rankBy: ['points'],
    events: [],
  },
  VOLLEYBALL: {
    parts: { kind: 'SET', regulation: 5, max: 5 },
    scoreIsPartsWon: true,
    stats: [],
    rankBy: [],
    events: [],
  },
  HANDBALL: hockeyLike,
  TENNIS: hockeyLike,
  OTHER: hockeyLike,
};

export const profileFor = (sport: SportType | null | undefined): SportProfile =>
  SPORT_PROFILES[sport ?? 'OTHER'];

/** The score of one part: a period, half, quarter or set. */
export interface PartScore {
  home: number;
  away: number;
}

export type PartsCheck = { ok: true; value: PartScore[] | null | undefined } | { ok: false; error: string };

/**
 * Validates the part scores sent for a game of this sport. Undefined means "not
 * sent" and leaves them alone; null or an empty list clears them.
 */
export function checkParts(value: unknown, profile: SportProfile): PartsCheck {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null || (Array.isArray(value) && value.length === 0)) return { ok: true, value: null };
  if (!Array.isArray(value) || value.length > profile.parts.max) {
    return { ok: false, error: `A game of this sport has at most ${profile.parts.max} parts` };
  }
  const parts: PartScore[] = [];
  for (const entry of value) {
    const home = (entry as Partial<PartScore> | null)?.home;
    const away = (entry as Partial<PartScore> | null)?.away;
    if (typeof home !== 'number' || typeof away !== 'number'
        || !Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0) {
      return { ok: false, error: 'Each part needs a whole, non-negative home and away score' };
    }
    parts.push({ home, away });
  }
  return { ok: true, value: parts };
}

/** Parts won by each side, for a sport scored in parts (volleyball sets). A level part is won by neither. */
export function partsWon(parts: PartScore[]): { home: number; away: number } {
  return parts.reduce(
    (won, part) => ({
      home: won.home + (part.home > part.away ? 1 : 0),
      away: won.away + (part.away > part.home ? 1 : 0),
    }),
    { home: 0, away: 0 }
  );
}

/**
 * How a volleyball match is played, set in the competition's scoring:
 * to three won sets (the federation's championships), to two (tournaments may),
 * or exactly two sets, where 1:1 is a draw (hobby tournaments). A play-off game
 * needs a winner, so in the two-set format it goes to a third set.
 */
export type SetFormat = 'BEST_OF_5' | 'BEST_OF_3' | 'TWO_SETS';

export const SET_FORMATS: readonly SetFormat[] = ['BEST_OF_5', 'BEST_OF_3', 'TWO_SETS'];

/** Sets a side must win; the two-set format has no such number, a play-off game in it goes to two. */
export const setsToWin = (format: SetFormat | undefined): number => (format === 'BEST_OF_5' || !format ? 3 : 2);

/**
 * Whether a game went beyond regulation: overtime, extra time or the deciding
 * set of a volleyball match (the fifth, or the third when played to two won
 * sets). Scoring can then award different points (services/scoring/policy.ts,
 * otWinPoints / otLossPoints). Two fixed sets have no deciding set.
 */
export function decidedAfterRegulation(
  parts: PartScore[] | null | undefined,
  profile: SportProfile,
  format?: SetFormat
): boolean {
  if (!parts) return false;
  if (profile.scoreIsPartsWon) {
    if (format === 'TWO_SETS') return false;
    return parts.length === setsToWin(format) * 2 - 1;
  }
  return parts.length > profile.parts.regulation;
}

export type StatsCheck = { ok: true; value: Partial<Record<StatKey, number | null>> } | { ok: false; error: string };

/**
 * Keeps only the numbers this sport records from a request body. A number the
 * sport does not keep (a card on a hockey line) is refused rather than ignored,
 * so a client that sends the wrong shape finds out.
 */
export function checkStats(body: Record<string, unknown>, profile: SportProfile): StatsCheck {
  const value: Partial<Record<StatKey, number | null>> = {};
  for (const key of STAT_KEYS) {
    const raw = body[key];
    if (raw === undefined) continue;
    if (!profile.stats.includes(key)) {
      return { ok: false, error: `${key} is not recorded in this sport` };
    }
    if (raw === null) {
      value[key] = null;
      continue;
    }
    if (!Number.isInteger(raw) || (raw as number) < 0) {
      return { ok: false, error: `${key} must be a whole, non-negative number` };
    }
    value[key] = raw as number;
  }
  return { ok: true, value };
}
