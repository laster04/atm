import { SportType } from '@prisma/client';
import { SET_FORMATS, type SetFormat } from '../sports/profile.js';

/**
 * How a competition turns results into table points, and how it breaks ties.
 *
 * Nothing outside this module is allowed to know that a win is worth two points
 * or three: league standings and tournament group standings both resolve a
 * policy first and compute from it. Adding a sport, or letting an organiser run
 * a league on non-standard points, is a data change rather than a code change.
 */
export interface ScoringPolicy {
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  /**
   * Points for a win/loss decided after regulation. Overtime is not modelled on
   * games yet, so these stay unused until it is; they exist so that the shape of
   * the policy does not have to change when it lands.
   */
  otWinPoints: number;
  otLossPoints: number;
  /** Sports where a level score is impossible (tennis) rank draws out entirely. */
  allowDraws: boolean;
  tiebreakers: Tiebreaker[];
  /** Volleyball only: how many sets a match has; see sports/profile. Absent elsewhere. */
  setFormat?: SetFormat;
  /**
   * The sport the policy was resolved for. Not stored; it lets the table tell
   * a volleyball match that went to a fifth set (scored with otWin/otLoss) from
   * a regular win.
   */
  sport?: SportType;
}

/**
 * SET_RATIO and BALL_RATIO are volleyball's: sets won over sets lost (the score
 * of a volleyball game is its sets) and balls won over balls lost, summed from
 * the set scores. Ratios, not differences, as the Czech rules have it.
 */
export type Tiebreaker = 'HEAD_TO_HEAD' | 'GOAL_DIFF' | 'GOALS_FOR' | 'WINS' | 'PLAYED' | 'SET_RATIO' | 'BALL_RATIO';

const goalBased = (winPoints: number, drawPoints: number): ScoringPolicy => ({
  winPoints,
  drawPoints,
  lossPoints: 0,
  otWinPoints: winPoints,
  otLossPoints: drawPoints,
  allowDraws: true,
  tiebreakers: ['GOAL_DIFF', 'GOALS_FOR', 'HEAD_TO_HEAD'],
});

/**
 * Leagues and one-off tournaments are different products and have always been
 * scored differently here, so the default a competition falls back to depends on
 * which it is.
 */
export type CompetitionKind = 'LEAGUE' | 'TOURNAMENT';

/**
 * Volleyball by the Czech federation's rules (Soutěžní řád volejbalu, čl. 28):
 * 3:0 and 3:1 earn three points, 3:2 two, 2:3 one, a lost match nothing. On a
 * level points total: more wins, then the set ratio, then the ball ratio, then
 * the match between the two.
 */
export const VOLLEYBALL_POLICY: ScoringPolicy = {
  winPoints: 3,
  drawPoints: 1,
  lossPoints: 0,
  otWinPoints: 2,
  otLossPoints: 1,
  allowDraws: false,
  tiebreakers: ['WINS', 'SET_RATIO', 'BALL_RATIO', 'HEAD_TO_HEAD'],
  setFormat: 'BEST_OF_5',
};

/**
 * Per-sport defaults for a tournament. Existing tournaments carry an explicit
 * override written by the migration that introduced this module, so changing a
 * default here never rewrites a table that has already been played.
 */
export const SPORT_DEFAULTS: Record<SportType, ScoringPolicy> = {
  FOOTBALL: goalBased(3, 1),
  BASKETBALL: { ...goalBased(2, 0), allowDraws: false, tiebreakers: ['HEAD_TO_HEAD', 'GOAL_DIFF', 'GOALS_FOR'] },
  // Tournaments play shorter matches; the rules allow two won sets there.
  VOLLEYBALL: { ...VOLLEYBALL_POLICY, setFormat: 'BEST_OF_3' },
  HOCKEY: goalBased(3, 1),
  HANDBALL: goalBased(2, 1),
  FLOORBALL: goalBased(3, 1),
  // Win/loss only. Margin carries no weight, so a points tie is settled by who
  // beat whom rather than by games won.
  TENNIS: {
    winPoints: 1,
    drawPoints: 0,
    lossPoints: 0,
    otWinPoints: 1,
    otLossPoints: 0,
    allowDraws: false,
    tiebreakers: ['HEAD_TO_HEAD', 'GOAL_DIFF', 'GOALS_FOR'],
  },
  OTHER: goalBased(3, 1),
};

/**
 * Every season, in every sport, scored two points for a win and one for a draw
 * before scoring became configurable. That stays the league default so no season
 * changes point totals under an organiser who never asked for a change; a league
 * that wants 3/1/0 sets it explicitly.
 *
 * Volleyball is the exception: its leagues came with the sport profiles, never
 * ran on the old two points, and default to the federation's rules.
 */
export const LEAGUE_DEFAULT: ScoringPolicy = {
  winPoints: 2,
  drawPoints: 1,
  lossPoints: 0,
  otWinPoints: 2,
  otLossPoints: 1,
  allowDraws: true,
  tiebreakers: ['GOAL_DIFF', 'GOALS_FOR'],
};

export const defaultPolicy = (
  sportType: SportType | null | undefined,
  kind: CompetitionKind
): ScoringPolicy =>
  kind === 'LEAGUE'
    ? sportType === 'VOLLEYBALL' ? VOLLEYBALL_POLICY : LEAGUE_DEFAULT
    : SPORT_DEFAULTS[sportType ?? 'OTHER'] ?? SPORT_DEFAULTS.OTHER;

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const TIEBREAKERS: readonly Tiebreaker[] = ['HEAD_TO_HEAD', 'GOAL_DIFF', 'GOALS_FOR', 'WINS', 'PLAYED', 'SET_RATIO', 'BALL_RATIO'];

const parseTiebreakers = (value: unknown, fallback: Tiebreaker[]): Tiebreaker[] => {
  if (!Array.isArray(value)) return fallback;
  const parsed = value.filter((entry): entry is Tiebreaker =>
    typeof entry === 'string' && (TIEBREAKERS as readonly string[]).includes(entry)
  );
  return parsed.length > 0 ? parsed : fallback;
};

export type OverrideCheck =
  | { ok: true; value: Record<string, unknown> | null | undefined }
  | { ok: false; error: string };

const POINT_FIELDS = ['winPoints', 'drawPoints', 'lossPoints', 'otWinPoints', 'otLossPoints'] as const;

/**
 * Validates a scoring override sent by an organiser. Undefined leaves the stored
 * one alone, null drops it so the competition inherits again. Only the known
 * fields are kept, so the stored JSON never carries anything resolvePolicy
 * would have to ignore.
 */
export const checkScoringOverride = (value: unknown): OverrideCheck => {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null) return { ok: true, value: null };
  if (typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'scoring must be an object or null' };
  }
  const raw = value as Record<string, unknown>;
  const kept: Record<string, unknown> = {};
  for (const field of POINT_FIELDS) {
    if (raw[field] === undefined) continue;
    if (!Number.isInteger(raw[field]) || (raw[field] as number) < 0 || (raw[field] as number) > 10) {
      return { ok: false, error: `${field} must be a whole number from 0 to 10` };
    }
    kept[field] = raw[field];
  }
  if (raw.allowDraws !== undefined) {
    if (typeof raw.allowDraws !== 'boolean') return { ok: false, error: 'allowDraws must be true or false' };
    kept.allowDraws = raw.allowDraws;
  }
  if (raw.setFormat !== undefined) {
    if (!(SET_FORMATS as readonly unknown[]).includes(raw.setFormat)) {
      return { ok: false, error: `setFormat must be one of ${SET_FORMATS.join(', ')}` };
    }
    kept.setFormat = raw.setFormat;
  }
  if (raw.tiebreakers !== undefined) {
    const parsed = parseTiebreakers(raw.tiebreakers, []);
    if (!Array.isArray(raw.tiebreakers) || parsed.length !== raw.tiebreakers.length) {
      return { ok: false, error: `tiebreakers must be a list of ${TIEBREAKERS.join(', ')}` };
    }
    kept.tiebreakers = parsed;
  }
  return { ok: true, value: kept };
};

/**
 * Resolves the policy a competition runs on: its own stored override where it
 * has one, otherwise the default for its sport. The override is persisted as
 * JSON, so every field is validated individually and anything missing or
 * malformed falls back rather than poisoning a table with NaN.
 */
export const resolvePolicy = (
  override: unknown,
  sportType: SportType | null | undefined,
  kind: CompetitionKind
): ScoringPolicy => {
  const base = defaultPolicy(sportType, kind);
  if (!override || typeof override !== 'object' || Array.isArray(override)) {
    return sportType ? { ...base, sport: sportType } : base;
  }

  const raw = override as Record<string, unknown>;
  const setFormat = (SET_FORMATS as readonly unknown[]).includes(raw.setFormat) ? raw.setFormat as SetFormat : base.setFormat;
  return {
    winPoints: isNumber(raw.winPoints) ? raw.winPoints : base.winPoints,
    drawPoints: isNumber(raw.drawPoints) ? raw.drawPoints : base.drawPoints,
    lossPoints: isNumber(raw.lossPoints) ? raw.lossPoints : base.lossPoints,
    otWinPoints: isNumber(raw.otWinPoints) ? raw.otWinPoints : base.otWinPoints,
    otLossPoints: isNumber(raw.otLossPoints) ? raw.otLossPoints : base.otLossPoints,
    // Two fixed sets end 1:1 as often as not; such a match is a draw, whatever the stored flag says.
    allowDraws: setFormat === 'TWO_SETS' ? true : typeof raw.allowDraws === 'boolean' ? raw.allowDraws : base.allowDraws,
    tiebreakers: parseTiebreakers(raw.tiebreakers, base.tiebreakers),
    ...(setFormat && { setFormat }),
    ...(sportType && { sport: sportType }),
  };
};
