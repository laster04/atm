import { ScoringPolicy, Tiebreaker } from '../scoring/policy.js';

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
  /** Reserved for overtime/shootout, which games do not carry yet. */
  decidedAfterRegulation?: boolean;
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
}

interface TeamRef {
  id: string;
}

const headToHeadKey = (a: string, b: string): string => [a, b].sort().join('-');

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

    const overtime = result.decidedAfterRegulation === true;
    const winPoints = overtime ? policy.otWinPoints : policy.winPoints;
    const losePoints = overtime ? policy.otLossPoints : policy.lossPoints;

    if (result.homeScore > result.awayScore) {
      home.wins++;
      home.points += winPoints;
      away.losses++;
      away.points += losePoints;
    } else if (result.homeScore < result.awayScore) {
      away.wins++;
      away.points += winPoints;
      home.losses++;
      home.points += losePoints;
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
