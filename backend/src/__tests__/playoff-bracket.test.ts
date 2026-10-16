import {
  advanceTarget,
  bracketSize,
  buildBracket,
  roundsFor,
  seedOrder,
  seedsFromTables,
  seriesWinner,
  winsNeeded,
} from '../services/playoff/bracket.js';

const pairs = (qualifiers: number, round: string) =>
  buildBracket(qualifiers, { bronze: true })
    .filter(s => s.round === round)
    .map(s => [s.homeSeed, s.awaySeed]);

describe('seedOrder', () => {
  it('keeps the top seeds apart', () => {
    expect(seedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });
});

describe('buildBracket', () => {
  it('fills a full bracket from the first round', () => {
    expect(pairs(8, 'QUARTER_FINAL')).toEqual([[1, 8], [4, 5], [2, 7], [3, 6]]);
    expect(pairs(8, 'SEMI_FINAL')).toEqual([[null, null], [null, null]]);
    expect(pairs(8, 'FINAL')).toEqual([[null, null]]);
    expect(pairs(8, 'BRONZE')).toEqual([[null, null]]);
  });

  it('gives the top seeds a bye when the count is not a power of two', () => {
    expect(bracketSize(6)).toBe(8);
    expect(pairs(6, 'QUARTER_FINAL')).toEqual([[4, 5], [3, 6]]);
    // Seed 1 waits for the 4v5 winner, seed 2 for the 3v6 winner.
    expect(pairs(6, 'SEMI_FINAL')).toEqual([[1, null], [2, null]]);
    expect(pairs(6, 'BRONZE')).toHaveLength(1);
  });

  it('can bye a whole semi-final', () => {
    expect(pairs(5, 'QUARTER_FINAL')).toEqual([[4, 5]]);
    expect(pairs(5, 'SEMI_FINAL')).toEqual([[1, null], [2, 3]]);
  });

  it('drops the bronze game when a team reaches the final on a bye', () => {
    expect(pairs(3, 'SEMI_FINAL')).toEqual([[2, 3]]);
    expect(pairs(3, 'FINAL')).toEqual([[1, null]]);
    expect(pairs(3, 'BRONZE')).toEqual([]);
  });

  it('plays two teams as a final only', () => {
    expect(roundsFor(2)).toEqual(['FINAL']);
    expect(buildBracket(2, { bronze: true })).toEqual([{ round: 'FINAL', slot: 0, homeSeed: 1, awaySeed: 2 }]);
  });

  it('leaves out the bronze game when not asked for', () => {
    expect(pairs(8, 'BRONZE').length).toBe(1);
    expect(buildBracket(8, { bronze: false }).some(s => s.round === 'BRONZE')).toBe(false);
  });

  it('takes 2 to 16 qualifiers, every seed exactly once', () => {
    for (let q = 2; q <= 16; q++) {
      const placed = buildBracket(q, { bronze: true })
        .flatMap(s => [s.homeSeed, s.awaySeed])
        .filter((seed): seed is number => seed !== null)
        .sort((a, b) => a - b);
      expect(placed).toEqual(Array.from({ length: q }, (_, i) => i + 1));
    }
    expect(() => buildBracket(1, { bronze: false })).toThrow(RangeError);
    expect(() => buildBracket(17, { bronze: false })).toThrow(RangeError);
  });
});

describe('advanceTarget', () => {
  it('sends a winner to the next round and a semi-final loser to bronze', () => {
    expect(advanceTarget('QUARTER_FINAL', 3)).toEqual({
      winner: { round: 'SEMI_FINAL', slot: 1, side: 'away' },
      loser: null,
    });
    expect(advanceTarget('SEMI_FINAL', 0)).toEqual({
      winner: { round: 'FINAL', slot: 0, side: 'home' },
      loser: { round: 'BRONZE', slot: 0, side: 'home' },
    });
    expect(advanceTarget('FINAL', 0)).toEqual({ winner: null, loser: null });
  });
});

describe('seedsFromTables', () => {
  const row = (teamId: string, points: number, goalDiff = 0, goalsFor = 0) => ({ teamId, points, goalDiff, goalsFor });

  it('keeps one ranked table in its own order', () => {
    // Head-to-head may rank a team above one with a better goal difference.
    expect(seedsFromTables([[row('a', 9, 1), row('b', 9, 5), row('c', 3)]], 3)).toEqual(['a', 'b', 'c']);
  });

  it('seeds every group winner before any runner-up', () => {
    const groupA = [row('a1', 9), row('a2', 6)];
    const groupB = [row('b1', 12), row('b2', 3)];
    expect(seedsFromTables([groupA, groupB], 2)).toEqual(['b1', 'a1', 'a2', 'b2']);
  });
});

describe('seriesWinner', () => {
  const game = (homeTeamId: string, awayTeamId: string, homeScore: number, awayScore: number) =>
    ({ homeTeamId, awayTeamId, homeScore, awayScore });
  const teams = { homeTeamId: 'x', awayTeamId: 'y' };

  it('counts wins by team, whichever side they played on', () => {
    expect(winsNeeded(3)).toBe(2);
    expect(seriesWinner([game('x', 'y', 3, 1), game('y', 'x', 2, 1)], teams, 3))
      .toEqual({ homeWins: 1, awayWins: 1, winnerId: null });
    expect(seriesWinner([game('x', 'y', 3, 1), game('y', 'x', 0, 4)], teams, 3))
      .toEqual({ homeWins: 2, awayWins: 0, winnerId: 'x' });
  });

  it('decides a single game at once', () => {
    expect(seriesWinner([game('x', 'y', 1, 2)], teams, 1).winnerId).toBe('y');
  });
});
