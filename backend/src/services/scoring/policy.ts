import { SportType } from '@prisma/client';

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
}

export type Tiebreaker = 'HEAD_TO_HEAD' | 'GOAL_DIFF' | 'GOALS_FOR' | 'WINS' | 'PLAYED';

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
 * Per-sport defaults for a tournament. Existing tournaments carry an explicit
 * override written by the migration that introduced this module, so changing a
 * default here never rewrites a table that has already been played.
 */
export const SPORT_DEFAULTS: Record<SportType, ScoringPolicy> = {
  FOOTBALL: goalBased(3, 1),
  BASKETBALL: { ...goalBased(2, 0), allowDraws: false, tiebreakers: ['HEAD_TO_HEAD', 'GOAL_DIFF', 'GOALS_FOR'] },
  VOLLEYBALL: { ...goalBased(3, 0), allowDraws: false, tiebreakers: ['HEAD_TO_HEAD', 'GOAL_DIFF', 'GOALS_FOR'] },
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
    ? LEAGUE_DEFAULT
    : SPORT_DEFAULTS[sportType ?? 'OTHER'] ?? SPORT_DEFAULTS.OTHER;

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const TIEBREAKERS: readonly Tiebreaker[] = ['HEAD_TO_HEAD', 'GOAL_DIFF', 'GOALS_FOR', 'WINS', 'PLAYED'];

const parseTiebreakers = (value: unknown, fallback: Tiebreaker[]): Tiebreaker[] => {
  if (!Array.isArray(value)) return fallback;
  const parsed = value.filter((entry): entry is Tiebreaker =>
    typeof entry === 'string' && (TIEBREAKERS as readonly string[]).includes(entry)
  );
  return parsed.length > 0 ? parsed : fallback;
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
  if (!override || typeof override !== 'object' || Array.isArray(override)) return base;

  const raw = override as Record<string, unknown>;
  return {
    winPoints: isNumber(raw.winPoints) ? raw.winPoints : base.winPoints,
    drawPoints: isNumber(raw.drawPoints) ? raw.drawPoints : base.drawPoints,
    lossPoints: isNumber(raw.lossPoints) ? raw.lossPoints : base.lossPoints,
    otWinPoints: isNumber(raw.otWinPoints) ? raw.otWinPoints : base.otWinPoints,
    otLossPoints: isNumber(raw.otLossPoints) ? raw.otLossPoints : base.otLossPoints,
    allowDraws: typeof raw.allowDraws === 'boolean' ? raw.allowDraws : base.allowDraws,
    tiebreakers: parseTiebreakers(raw.tiebreakers, base.tiebreakers),
  };
};
