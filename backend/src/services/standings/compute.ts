import { ScoringPolicy, Tiebreaker } from '../scoring/policy.js';
import { type PartScore, decidedAfterRegulation, profileFor } from '../sports/profile.js';

/**
 * One decided fixture, reduced to what a table needs. Both league games and
 * tournament group games map onto this, which is the whole point: the ranking
 * rules live here once instead of once per competition tree.
 */
export interface StandingResult {
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore: number | null;
  awayScore: number | null;
  /** Set by a caller that knows; otherwise worked out from periodScores where the sport allows. */
  decidedAfterRegulation?: boolean;
  /** League games carry their part scores; a volleyball fifth set is read from them. */
  periodScores?: unknown;
}

export interface StandingRow<TTeam> {
  teamId: string;
  team: TTeam;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  /**
   * Of wins and losses, those decided after regulation: a volleyball 3:2 / 2:3.
   * The volleyball table splits wins and losses by them (V3 V2 P1 P0).
   */
  otWins: number;
  otLosses: number;
  /** Points scored inside the parts, summed: volleyball balls (míče). Zero where parts are not recorded. */
  partPointsFor: number;
  partPointsAgainst: number;
}

interface TeamRef {
  id: string;
}

const headToHeadKey = (a: string, b: string): string => [a, b].sort().join('-');

/** Won over lost, as volleyball ranks sets and balls. Nothing lost beats any ratio. */
const ratio = (won: number, lost: number): number => (lost === 0 ? (won === 0 ? 0 : Infinity) : won / lost);

/** Higher ratio first; written out because Infinity - Infinity is NaN. */
const byRatio = (a: number, b: number): number => (a === b ? 0 : a > b ? -1 : 1);

const partPoints = (periodScores: unknown): { home: number; away: number } | null => {
  if (!Array.isArray(periodScores)) return null;
  return (periodScores as PartScore[]).reduce(
    (sum, part) => ({ home: sum.home + (part?.home ?? 0), away: sum.away + (part?.away ?? 0) }),
    { home: 0, away: 0 }
  );
};

/**
 * A result only counts once both teams and both scores are known. A fixture
 * marked complete with an empty score is an unfinished report, not a goalless
 * draw, and must not hand out a point.
 */
const isCounted = (
  result: StandingResult
): result is StandingResult & { homeTeamId: string; awayTeamId: string; homeScore: number; awayScore: number } =>
  result.homeTeamId != null &&
  result.awayTeamId != null &&
  result.homeScore != null &&
  result.awayScore != null;

/**
 * Only sports scored in parts read this from the part scores: a volleyball
 * match decided in the fifth set. Hockey overtime is not counted this way yet,
 * because it would change the points of tables already played.
 */
const playedPastRegulation = (result: StandingResult, policy: ScoringPolicy): boolean => {
  if (!policy.sport || !Array.isArray(result.periodScores)) return false;
  const profile = profileFor(policy.sport);
  return profile.scoreIsPartsWon && decidedAfterRegulation(result.periodScores as PartScore[], profile, policy.setFormat);
};

export function buildTable<TTeam extends TeamRef>(
  teams: TTeam[],
  results: StandingResult[],
  policy: ScoringPolicy
): StandingRow<TTeam>[] {
  const rows = new Map<string, StandingRow<TTeam>>();
  for (const team of teams) {
    rows.set(team.id, {
      teamId: team.id,
      team,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
      otWins: 0,
      otLosses: 0,
      partPointsFor: 0,
      partPointsAgainst: 0,
    });
  }

  for (const result of results) {
    if (!isCounted(result)) continue;

    const home = rows.get(result.homeTeamId);
    const away = rows.get(result.awayTeamId);
    // A game against a team that has since left the competition still happened,
    // but it cannot be credited to a row that is not in this table.
    if (!home || !away) continue;

    home.played++;
    away.played++;
    home.goalsFor += result.homeScore;
    home.goalsAgainst += result.awayScore;
    away.goalsFor += result.awayScore;
    away.goalsAgainst += result.homeScore;
    const balls = partPoints(result.periodScores);
    if (balls) {
      home.partPointsFor += balls.home;
      home.partPointsAgainst += balls.away;
      away.partPointsFor += balls.away;
      away.partPointsAgainst += balls.home;
    }

    const overtime = result.decidedAfterRegulation ?? playedPastRegulation(result, policy);
    const winPoints = overtime ? policy.otWinPoints : policy.winPoints;
    const losePoints = overtime ? policy.otLossPoints : policy.lossPoints;

    if (result.homeScore > result.awayScore) {
      home.wins++;
      home.points += winPoints;
      away.losses++;
      away.points += losePoints;
      if (overtime) {
        home.otWins++;
        away.otLosses++;
      }
    } else if (result.homeScore < result.awayScore) {
      away.wins++;
      away.points += winPoints;
      home.losses++;
      home.points += losePoints;
      if (overtime) {
        away.otWins++;
        home.otLosses++;
      }
    } else {
      // Sports that cannot end level should never reach here; if a level score
      // is recorded anyway it is counted as played but awards nothing.
      home.draws++;
      away.draws++;
      if (policy.allowDraws) {
        home.points += policy.drawPoints;
        away.points += policy.drawPoints;
      }
    }
  }

  for (const row of rows.values()) {
    row.goalDifference = row.goalsFor - row.goalsAgainst;
  }

  return Array.from(rows.values());
}

/**
 * Ranks a built table by points, then by the policy's tiebreaker chain in order.
 * Head-to-head only separates two teams that actually met and did not draw;
 * anything it cannot settle falls through to the next tiebreaker.
 */
export function rankTable<TTeam>(
  rows: StandingRow<TTeam>[],
  results: StandingResult[],
  policy: ScoringPolicy
): StandingRow<TTeam>[] {
  const headToHead = new Map<string, string>();
  if (policy.tiebreakers.includes('HEAD_TO_HEAD')) {
    for (const result of results) {
      if (!isCounted(result)) continue;
      if (result.homeScore === result.awayScore) continue;
      const winnerId = result.homeScore > result.awayScore ? result.homeTeamId : result.awayTeamId;
      const key = headToHeadKey(result.homeTeamId, result.awayTeamId);
      // Teams that met more than once and split the games settle nothing here.
      const existing = headToHead.get(key);
      if (existing && existing !== winnerId) {
        headToHead.set(key, '');
        continue;
      }
      if (existing === '') continue;
      headToHead.set(key, winnerId);
    }
  }

  const applyTiebreaker = (
    tiebreaker: Tiebreaker,
    a: StandingRow<TTeam>,
    b: StandingRow<TTeam>
  ): number => {
    switch (tiebreaker) {
      case 'HEAD_TO_HEAD': {
        const winnerId = headToHead.get(headToHeadKey(a.teamId, b.teamId));
        if (!winnerId) return 0;
        if (winnerId === a.teamId) return -1;
        if (winnerId === b.teamId) return 1;
        return 0;
      }
      case 'GOAL_DIFF':
        return b.goalDifference - a.goalDifference;
      case 'GOALS_FOR':
        return b.goalsFor - a.goalsFor;
      case 'WINS':
        return b.wins - a.wins;
      case 'SET_RATIO':
        return byRatio(ratio(a.goalsFor, a.goalsAgainst), ratio(b.goalsFor, b.goalsAgainst));
      case 'BALL_RATIO':
        return byRatio(ratio(a.partPointsFor, a.partPointsAgainst), ratio(b.partPointsFor, b.partPointsAgainst));
      // Fewer games played ranks higher when everything else is level, so a team
      // with a game in hand is not shown below one that has already played it.
      case 'PLAYED':
        return a.played - b.played;
      default:
        return 0;
    }
  };

  return [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    for (const tiebreaker of policy.tiebreakers) {
      const decided = applyTiebreaker(tiebreaker, a, b);
      if (decided !== 0) return decided;
    }
    return 0;
  });
}

export function computeTable<TTeam extends TeamRef>(
  teams: TTeam[],
  results: StandingResult[],
  policy: ScoringPolicy
): StandingRow<TTeam>[] {
  return rankTable(buildTable(teams, results, policy), results, policy);
}
