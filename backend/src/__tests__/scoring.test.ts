import { LEAGUE_DEFAULT, resolvePolicy, SPORT_DEFAULTS, ScoringPolicy } from '../services/scoring/policy.js';
import { buildTable, computeTable, StandingResult } from '../services/standings/compute.js';

const team = (id: string) => ({ id, name: id });

// The points rules that were hard-coded in the two controllers before the
// shared service existed. Every existing season and tournament carries these as
// a stored override, so these two constants are what "no behaviour change"
// means in practice.
const LEGACY_LEAGUE: ScoringPolicy = {
  winPoints: 2, drawPoints: 1, lossPoints: 0, otWinPoints: 2, otLossPoints: 1,
  allowDraws: true, tiebreakers: ['GOAL_DIFF', 'GOALS_FOR'],
};
const LEGACY_TOURNAMENT: ScoringPolicy = {
  winPoints: 3, drawPoints: 1, lossPoints: 0, otWinPoints: 3, otLossPoints: 1,
  allowDraws: true, tiebreakers: ['GOAL_DIFF', 'GOALS_FOR'],
};

const game = (
  homeTeamId: string, awayTeamId: string, homeScore: number | null, awayScore: number | null
): StandingResult => ({ homeTeamId, awayTeamId, homeScore, awayScore });

describe('resolvePolicy', () => {
  it('falls back to the sport default when there is no override', () => {
    expect(resolvePolicy(null, 'HOCKEY', 'TOURNAMENT')).toEqual(SPORT_DEFAULTS.HOCKEY);
    expect(resolvePolicy(undefined, 'TENNIS', 'TOURNAMENT')).toEqual(SPORT_DEFAULTS.TENNIS);
  });

  it('falls back to OTHER for an unknown or missing sport', () => {
    expect(resolvePolicy(null, null, 'TOURNAMENT')).toEqual(SPORT_DEFAULTS.OTHER);
  });

  // Guards the promise the migration makes: a season created after this refactor
  // must score exactly as every season did before it.
  it('defaults a league to two points for a win in every sport', () => {
    expect(resolvePolicy(null, 'HOCKEY', 'LEAGUE')).toEqual(LEAGUE_DEFAULT);
    expect(resolvePolicy(null, 'TENNIS', 'LEAGUE')).toEqual(LEAGUE_DEFAULT);
    expect(LEAGUE_DEFAULT.winPoints).toBe(2);
    expect(LEAGUE_DEFAULT.drawPoints).toBe(1);
  });

  it('applies an override field by field, keeping defaults for the rest', () => {
    const policy = resolvePolicy({ winPoints: 2, drawPoints: 1 }, 'HOCKEY', 'TOURNAMENT');
    expect(policy.winPoints).toBe(2);
    expect(policy.drawPoints).toBe(1);
    expect(policy.tiebreakers).toEqual(SPORT_DEFAULTS.HOCKEY.tiebreakers);
  });

  it('ignores malformed stored JSON rather than producing NaN points', () => {
    const policy = resolvePolicy({ winPoints: 'three', tiebreakers: ['NONSENSE'] }, 'HOCKEY', 'TOURNAMENT');
    expect(policy.winPoints).toBe(SPORT_DEFAULTS.HOCKEY.winPoints);
    expect(policy.tiebreakers).toEqual(SPORT_DEFAULTS.HOCKEY.tiebreakers);
  });

  it('ignores a non-object override', () => {
    expect(resolvePolicy('garbage', 'HOCKEY', 'TOURNAMENT')).toEqual(SPORT_DEFAULTS.HOCKEY);
    expect(resolvePolicy([1, 2], 'HOCKEY', 'TOURNAMENT')).toEqual(SPORT_DEFAULTS.HOCKEY);
  });
});

describe('buildTable', () => {
  it('awards points from the policy, not from a built-in rule', () => {
    const results = [game('a', 'b', 3, 1), game('a', 'c', 2, 2)];
    const [a] = buildTable([team('a'), team('b'), team('c')], results, LEGACY_LEAGUE)
      .filter(r => r.teamId === 'a');
    expect(a.points).toBe(3); // 2 for the win + 1 for the draw
    expect(a.wins).toBe(1);
    expect(a.draws).toBe(1);
    expect(a.goalsFor).toBe(5);
    expect(a.goalsAgainst).toBe(3);
    expect(a.goalDifference).toBe(2);

    const [aTournament] = buildTable([team('a'), team('b'), team('c')], results, LEGACY_TOURNAMENT)
      .filter(r => r.teamId === 'a');
    expect(aTournament.points).toBe(4); // 3 for the win + 1 for the draw
  });

  it('does not count a result with a missing score as a goalless draw', () => {
    const rows = buildTable([team('a'), team('b')], [game('a', 'b', null, null)], LEGACY_LEAGUE);
    expect(rows.every(r => r.played === 0)).toBe(true);
    expect(rows.every(r => r.points === 0)).toBe(true);
  });

  it('skips a result involving a team that is not in the table', () => {
    const rows = buildTable([team('a')], [game('a', 'gone', 5, 0)], LEGACY_LEAGUE);
    expect(rows[0].played).toBe(0);
  });

  it('awards no points for a level score when the sport forbids draws', () => {
    const rows = buildTable([team('a'), team('b')], [game('a', 'b', 1, 1)], SPORT_DEFAULTS.TENNIS);
    expect(rows.every(r => r.played === 1)).toBe(true);
    expect(rows.every(r => r.points === 0)).toBe(true);
  });
});

describe('computeTable ranking', () => {
  it('ranks by points, then goal difference, then goals for', () => {
    const teams = [team('a'), team('b'), team('c')];
    const results = [
      game('a', 'b', 1, 0), // a 2pts, gd +1
      game('c', 'b', 5, 0), // c 2pts, gd +5
      game('a', 'c', 0, 0), // both draw
    ];
    const table = computeTable(teams, results, LEGACY_LEAGUE);
    expect(table.map(r => r.teamId)).toEqual(['c', 'a', 'b']);
  });

  it('breaks a tie head-to-head when the policy asks for it', () => {
    const teams = [team('a'), team('b')];
    // Level on points; b won the meeting, so b ranks first despite equal records.
    const results = [game('a', 'b', 0, 1), game('a', 'b', 0, 1)];
    const table = computeTable(teams, results, SPORT_DEFAULTS.TENNIS);
    expect(table.map(r => r.teamId)).toEqual(['b', 'a']);
  });

  it('leaves head-to-head undecided when the teams split their meetings', () => {
    const teams = [team('a'), team('b')];
    const results = [game('a', 'b', 1, 0), game('a', 'b', 0, 1)];
    const table = computeTable(teams, results, SPORT_DEFAULTS.TENNIS);
    // One win each, head-to-head settles nothing, so neither is promoted over
    // the other and the order stays stable.
    expect(table.map(r => r.teamId)).toEqual(['a', 'b']);
  });

  it('ranks a team with a game in hand above an equal team that has played it', () => {
    const policy: ScoringPolicy = { ...LEGACY_LEAGUE, tiebreakers: ['PLAYED'] };
    const teams = [team('a'), team('b'), team('c')];
    // a: two draws -> 2pts from 2 games. b: one win -> 2pts from 1 game.
    const results = [game('a', 'c', 1, 1), game('a', 'c', 1, 1), game('b', 'c', 2, 1)];
    const table = computeTable(teams, results, policy);
    const a = table.findIndex(r => r.teamId === 'a');
    const b = table.findIndex(r => r.teamId === 'b');
    expect(table[a].points).toBe(table[b].points);
    expect(a).toBeGreaterThan(b);
  });
});
