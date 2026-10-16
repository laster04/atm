/**
 * The knockout bracket, shared by tournaments and seasons.
 *
 * Only the shape lives here: who meets whom, where a winner goes next, when a
 * series is decided. Each side stores it its own way - a tournament keeps one
 * game per slot, a season keeps a series per slot with real games under it -
 * so nothing in this file touches the database.
 */

export type BracketRound = 'ROUND_OF_16' | 'QUARTER_FINAL' | 'SEMI_FINAL' | 'FINAL';
export type BracketPhase = BracketRound | 'BRONZE';
export type Side = 'home' | 'away';

/** Rounds in play order; BRONZE branches off the semi-finals and leads nowhere. */
export const ROUND_SEQUENCE: BracketRound[] = ['ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'FINAL'];

export const MIN_QUALIFIERS = 2;
export const MAX_QUALIFIERS = 16;

// Standard single-elimination seeding (1v8, 4v5, 2v7, 3v6 for 8 teams, etc.)
// so top seeds are kept apart until later rounds instead of meeting a naive
// 1v2 pairing immediately.
export function seedOrder(n: number): number[] {
  if (n === 1) return [1];
  const prev = seedOrder(n / 2);
  const result: number[] = [];
  for (const s of prev) {
    result.push(s);
    result.push(n + 1 - s);
  }
  return result;
}

/** The smallest full bracket that holds every qualifier: 6 teams play in an 8-team bracket. */
export function bracketSize(qualifiers: number): number {
  let size = 2;
  while (size < qualifiers) size *= 2;
  return size;
}

/** The rounds a bracket of this many qualifiers is played over, first to last. */
export function roundsFor(qualifiers: number): BracketRound[] {
  const rounds = Math.log2(bracketSize(qualifiers));
  return ROUND_SEQUENCE.slice(ROUND_SEQUENCE.length - rounds);
}

export interface BracketSlot {
  round: BracketPhase;
  slot: number;
  /** Seed placed on this side before anything is played: first-round pairs, and teams with a bye. */
  homeSeed: number | null;
  awaySeed: number | null;
}

/**
 * Every slot of a bracket for `qualifiers` teams, seeded 1..qualifiers.
 *
 * When the count is not a power of two the bracket is the next size up and the
 * missing seeds are byes: their opponent has no first-round slot and starts in
 * the second round instead. Byes always go to the top seeds, because the seeds
 * that do not exist are the lowest ones.
 *
 * A bronze game needs two semi-final losers, so it is left out when a team
 * reaches the final on a bye.
 */
export function buildBracket(qualifiers: number, options: { bronze: boolean }): BracketSlot[] {
  if (!Number.isInteger(qualifiers) || qualifiers < MIN_QUALIFIERS || qualifiers > MAX_QUALIFIERS) {
    throw new RangeError(`A bracket takes ${MIN_QUALIFIERS} to ${MAX_QUALIFIERS} qualifiers`);
  }

  const size = bracketSize(qualifiers);
  const order = seedOrder(size);
  const rounds = roundsFor(qualifiers);
  const slots: BracketSlot[] = [];

  // Later rounds start empty; a bye fills one side of its second-round slot.
  const later = rounds.slice(1).map((round, r) =>
    Array.from({ length: size / 2 ** (r + 2) }, (_, slot): BracketSlot => ({ round, slot, homeSeed: null, awaySeed: null }))
  );

  for (let slot = 0; slot < size / 2; slot++) {
    const homeSeed = order[slot * 2];
    const awaySeed = order[slot * 2 + 1];
    if (homeSeed <= qualifiers && awaySeed <= qualifiers) {
      slots.push({ round: rounds[0], slot, homeSeed, awaySeed });
      continue;
    }
    const target = later[0][Math.floor(slot / 2)];
    const seed = Math.min(homeSeed, awaySeed);
    if (slot % 2 === 0) target.homeSeed = seed;
    else target.awaySeed = seed;
  }

  slots.push(...later.flat());

  // Two semi-finals are played unless the bracket is too small or a bye skips one.
  if (options.bronze && slots.filter(s => s.round === 'SEMI_FINAL').length === 2) {
    slots.push({ round: 'BRONZE', slot: 0, homeSeed: null, awaySeed: null });
  }

  return slots;
}

export interface SlotRef {
  round: BracketPhase;
  slot: number;
  side: Side;
}

/** Where the winner of a slot goes next, and (from a semi-final) where the loser goes. */
export function advanceTarget(round: BracketPhase, slot: number): { winner: SlotRef | null; loser: SlotRef | null } {
  if (round === 'BRONZE' || round === 'FINAL') return { winner: null, loser: null };
  const next = ROUND_SEQUENCE[ROUND_SEQUENCE.indexOf(round) + 1];
  const side: Side = slot % 2 === 0 ? 'home' : 'away';
  const nextSlot = Math.floor(slot / 2);
  return {
    winner: { round: next, slot: nextSlot, side },
    loser: round === 'SEMI_FINAL' ? { round: 'BRONZE', slot: nextSlot, side } : null,
  };
}

/** One row of an already-ranked table, as much of it as seeding needs. */
export interface SeedRow {
  teamId: string;
  points: number;
  goalDiff: number;
  goalsFor: number;
}

/**
 * Seeds from ranked tables: every table's winner first, then every runner-up,
 * and so on. Order inside a table is kept as given, so a league's own
 * tiebreakers decide its seeds; teams of the same rank in different groups are
 * compared by points, goal difference and goals scored.
 */
export function seedsFromTables(rankedTables: SeedRow[][], perTable: number): string[] {
  const seeds: string[] = [];
  for (let rank = 0; rank < perTable; rank++) {
    const atRank = rankedTables
      .map(table => table[rank])
      .filter((row): row is SeedRow => row !== undefined)
      .sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor);
    seeds.push(...atRank.map(row => row.teamId));
  }
  return seeds;
}

/** Wins a best-of series takes: 1 of 1, 2 of 3, 3 of 5, 4 of 7. */
export const winsNeeded = (bestOf: number): number => Math.floor(bestOf / 2) + 1;

export interface PlayedResult {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
}

/**
 * The state of a series between two teams from its decided games. Teams are
 * counted by id, not by side, because home and away alternate within a series.
 * A drawn game decides nothing.
 */
export function seriesWinner(
  results: PlayedResult[],
  teams: { homeTeamId: string; awayTeamId: string },
  bestOf: number
): { homeWins: number; awayWins: number; winnerId: string | null } {
  let homeWins = 0;
  let awayWins = 0;
  for (const result of results) {
    if (result.homeScore === result.awayScore) continue;
    const winnerId = result.homeScore > result.awayScore ? result.homeTeamId : result.awayTeamId;
    if (winnerId === teams.homeTeamId) homeWins++;
    else if (winnerId === teams.awayTeamId) awayWins++;
  }
  const needed = winsNeeded(bestOf);
  const winnerId = homeWins >= needed ? teams.homeTeamId : awayWins >= needed ? teams.awayTeamId : null;
  return { homeWins, awayWins, winnerId };
}
