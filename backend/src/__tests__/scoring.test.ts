import { LEAGUE_DEFAULT, resolvePolicy, SPORT_DEFAULTS, ScoringPolicy, VOLLEYBALL_POLICY, checkScoringOverride } from '../services/scoring/policy.js';
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
    expect(resolvePolicy(null, 'HOCKEY', 'TOURNAMENT')).toEqual({ ...SPORT_DEFAULTS.HOCKEY, sport: 'HOCKEY' });
    expect(resolvePolicy(undefined, 'TENNIS', 'TOURNAMENT')).toEqual({ ...SPORT_DEFAULTS.TENNIS, sport: 'TENNIS' });
  });

  it('falls back to OTHER for an unknown or missing sport', () => {
    expect(resolvePolicy(null, null, 'TOURNAMENT')).toEqual(SPORT_DEFAULTS.OTHER);
  });

  // Guards the promise the migration makes: a season created after this refactor
  // must score exactly as every season did before it.
  it('defaults volleyball, league or tournament, to the federation rules', () => {
    expect(resolvePolicy(null, 'VOLLEYBALL', 'LEAGUE')).toEqual({ ...VOLLEYBALL_POLICY, sport: 'VOLLEYBALL' });
    // Tournaments play to two won sets, which the rules allow them.
    expect(resolvePolicy(null, 'VOLLEYBALL', 'TOURNAMENT')).toEqual({ ...VOLLEYBALL_POLICY, setFormat: 'BEST_OF_3', sport: 'VOLLEYBALL' });
    expect(VOLLEYBALL_POLICY).toMatchObject({ winPoints: 3, otWinPoints: 2, otLossPoints: 1, lossPoints: 0 });
  });

  it('accepts the volleyball ratios as tiebreakers', () => {
    expect(checkScoringOverride({ tiebreakers: ['WINS', 'SET_RATIO', 'BALL_RATIO'] })).toEqual({
      ok: true, value: { tiebreakers: ['WINS', 'SET_RATIO', 'BALL_RATIO'] },
    });
  });

  it('defaults a league to two points for a win in every sport but volleyball', () => {
    expect(resolvePolicy(null, 'HOCKEY', 'LEAGUE')).toEqual({ ...LEAGUE_DEFAULT, sport: 'HOCKEY' });
    expect(resolvePolicy(null, 'TENNIS', 'LEAGUE')).toEqual({ ...LEAGUE_DEFAULT, sport: 'TENNIS' });
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
    expect(resolvePolicy('garbage', 'HOCKEY', 'TOURNAMENT')).toEqual({ ...SPORT_DEFAULTS.HOCKEY, sport: 'HOCKEY' });
    expect(resolvePolicy([1, 2], 'HOCKEY', 'TOURNAMENT')).toEqual({ ...SPORT_DEFAULTS.HOCKEY, sport: 'HOCKEY' });
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

describe('volleyball table', () => {
  const policy: ScoringPolicy = { ...VOLLEYBALL_POLICY, sport: 'VOLLEYBALL' };
  const sets = (...scores: [number, number][]) => scores.map(([home, away]) => ({ home, away }));
  const match = (home: string, away: string, parts: { home: number; away: number }[]): StandingResult => {
    const won = parts.filter((p) => p.home > p.away).length;
    return { homeTeamId: home, awayTeamId: away, homeScore: won, awayScore: parts.length - won, periodScores: parts };
  };

  it('scores 3:1 with three points and 3:2 / 2:3 with two and one, splitting wins and losses', () => {
    const rows = buildTable([team('A'), team('B'), team('C')], [
      match('A', 'B', sets([25, 20], [20, 25], [25, 18], [25, 23])),
      match('C', 'A', sets([25, 20], [20, 25], [25, 20], [20, 25], [15, 12])),
    ], policy);
    const byId = Object.fromEntries(rows.map((row) => [row.teamId, row]));
    expect(byId.A).toMatchObject({ played: 2, wins: 1, losses: 1, otWins: 0, otLosses: 1, points: 4, goalsFor: 5, goalsAgainst: 4 });
    expect(byId.B).toMatchObject({ wins: 0, losses: 1, otLosses: 0, points: 0 });
    expect(byId.C).toMatchObject({ wins: 1, otWins: 1, points: 2 });
    // Balls: 95:86 against B, then 102:105 away at C.
    expect([byId.A.partPointsFor, byId.A.partPointsAgainst]).toEqual([197, 191]);
  });

  it('ranks level points by wins, then the set ratio, then the ball ratio', () => {
    // X and Y both have 3 points from one 3:0 win; X lost 1:3, Y lost 0:3 -> wins equal,
    // set ratio X 4/3 vs Y 3/3.
    const table = computeTable([team('X'), team('Y'), team('Z'), team('W')], [
      match('X', 'Z', sets([25, 10], [25, 10], [25, 10])),
      match('W', 'X', sets([25, 20], [20, 25], [25, 20], [25, 20])),
      match('Y', 'W', sets([25, 10], [25, 10], [25, 10])),
      match('Z', 'Y', sets([25, 20], [25, 20], [25, 20])),
    ], policy);
    expect(table.map((row) => row.teamId).slice(0, 2)).toEqual(['X', 'Y']);
  });

  it('lets the ball ratio settle what the sets cannot', () => {
    const table = computeTable([team('P'), team('Q'), team('R')], [
      match('P', 'R', sets([25, 23], [25, 23], [25, 23])),
      match('Q', 'R', sets([25, 10], [25, 10], [25, 10])),
    ], policy);
    expect(table.map((row) => row.teamId)).toEqual(['Q', 'P', 'R']);
  });

  it('puts a team that lost no set above any ratio', () => {
    const table = computeTable([team('S'), team('T'), team('U'), team('V')], [
      match('S', 'U', sets([25, 1], [25, 1], [25, 1])),
      match('T', 'V', sets([25, 23], [25, 23], [25, 23])),
      match('T', 'U', sets([25, 20], [23, 25], [25, 20], [25, 20])),
      match('S', 'V', sets([25, 20], [23, 25], [25, 20], [25, 20])),
    ], policy);
    // S and T: two 3-point wins each, sets 6:1 each; balls decide, S conceded fewer.
    expect(table.map((row) => row.teamId).slice(0, 2)).toEqual(['S', 'T']);
    expect(Number.isNaN(table[0].points)).toBe(false);
  });
});
