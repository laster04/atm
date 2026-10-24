import type { MatchEventType, PartScore, SetFormat, SportType, StatKey, StatTotals } from '@types';

export type PartKind = 'PERIOD' | 'HALF' | 'QUARTER' | 'SET';

export interface SportProfile {
	parts: { kind: PartKind; regulation: number; max: number };
	/** The final score is the parts won (volleyball sets) and follows from them. */
	scoreIsPartsWon: boolean;
	/** The numbers a player line keeps, in the order tables show them. */
	stats: StatKey[];
	/** What leaderboards rank by: the sum of these. */
	rankBy: StatKey[];
	/** Event types the match report offers; empty means no match report. */
	events: MatchEventType[];
}

const hockeyLike: SportProfile = {
	parts: { kind: 'PERIOD', regulation: 3, max: 5 },
	scoreIsPartsWon: false,
	stats: ['goals', 'assists', 'penaltyMinutes'],
	rankBy: ['goals', 'assists'],
	events: ['GOAL', 'PENALTY', 'GOALIE_CHANGE', 'TIMEOUT', 'PERIOD_START', 'PERIOD_END', 'SHOOTOUT_ATTEMPT'],
};

/**
 * How each sport is played and recorded.
 *
 * Mirrors backend/src/services/sports/profile.ts; keep the two in step.
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
	SPORT_PROFILES[sport ?? 'OTHER'] ?? SPORT_PROFILES.OTHER;

/** Parts won by each side; a level part is won by neither. */
export const partsWon = (parts: PartScore[]): { home: number; away: number } =>
	parts.reduce(
		(won, part) => ({
			home: won.home + (part.home > part.away ? 1 : 0),
			away: won.away + (part.away > part.home ? 1 : 0),
		}),
		{ home: 0, away: 0 }
	);

/** "(1:0, 2:1, 0:0)" for goals, "25:21, 23:25, 25:19" for sets; empty when there are none. */
export const formatParts = (parts: PartScore[] | null | undefined, profile: SportProfile): string => {
	if (!parts || parts.length === 0) return '';
	const list = parts.map((part) => `${part.home}:${part.away}`).join(', ');
	return profile.scoreIsPartsWon ? list : `(${list})`;
};

/**
 * i18n key and count for one part's label: "2. třetina", "1. poločas",
 * "Prodloužení" once past regulation (volleyball sets are always numbered).
 */
export const partLabel = (profile: SportProfile, index: number): { key: string; n: number } =>
	!profile.scoreIsPartsWon && index >= profile.parts.regulation
		? { key: 'sports.parts.overtime', n: index - profile.parts.regulation + 1 }
		: { key: `sports.parts.${profile.parts.kind}`, n: index + 1 };

/** What the profile ranks by, summed from a player's totals. */
export const rankTotal = (totals: StatTotals, profile: SportProfile): number =>
	profile.rankBy.reduce((sum, key) => sum + totals[key], 0);

/**
 * The column a leaderboard is ranked by: its own "points" column where the
 * ranking adds two numbers (hockey goals + assists), otherwise the ranked
 * number itself (football goals, basketball points), shown in bold.
 */
export const rankColumn = (profile: SportProfile): { key: StatKey | 'rankTotal'; labelKey: string } =>
	profile.rankBy.length > 1
		? { key: 'rankTotal', labelKey: 'stats.short.rankTotal' }
		: { key: profile.rankBy[0] ?? 'goals', labelKey: `stats.short.${profile.rankBy[0] ?? 'goals'}` };

/** Something about entered volleyball sets worth a second look: an i18n key and its values. */
export interface SetNote {
	key: string;
	vars: Record<string, number>;
}

/** Sets a side must win. Two fixed sets have no such number; a play-off game in them goes to two. */
export const setsToWin = (format: SetFormat | undefined): number => (format === 'BEST_OF_5' || !format ? 3 : 2);

/** Most sets a match can have, and how many rows the set editor starts with. */
export const setLimits = (format: SetFormat | undefined, playoff = false): { start: number; max: number } => {
	if (format === 'TWO_SETS' && !playoff) return { start: 2, max: 2 };
	const toWin = setsToWin(format);
	return { start: toWin, max: toWin * 2 - 1 };
};

/**
 * Gentle checks on volleyball sets, never a block: hobby leagues play their own
 * variants. By the rules a set goes to 25 and the deciding set to 15, won by
 * two clear points, and the match ends when a side has won enough sets. Two
 * fixed sets (TWO_SETS, outside a play-off) are both played to 25 and may end 1:1.
 */
export function volleyballNotes(sets: PartScore[], format?: SetFormat, playoff = false): SetNote[] {
	const notes: SetNote[] = [];
	if (format === 'TWO_SETS' && !playoff) {
		sets.forEach((set, index) => {
			const won = Math.max(set.home, set.away);
			const lost = Math.min(set.home, set.away);
			if (won === lost) notes.push({ key: 'sports.volleyball.levelSet', vars: { n: index + 1 } });
			else if (won < 25 || won - lost < 2 || (won > 25 && won - lost !== 2)) {
				notes.push({ key: 'sports.volleyball.unusualSet', vars: { n: index + 1, target: 25 } });
			}
		});
		if (sets.length < 2) notes.push({ key: 'sports.volleyball.twoSets', vars: {} });
		return notes;
	}
	const toWin = setsToWin(format);
	const deciding = toWin * 2 - 2;
	let home = 0;
	let away = 0;
	sets.forEach((set, index) => {
		const n = index + 1;
		if (home >= toWin || away >= toWin) {
			notes.push({ key: 'sports.volleyball.afterWin', vars: { n } });
			return;
		}
		const won = Math.max(set.home, set.away);
		const lost = Math.min(set.home, set.away);
		const target = index === deciding ? 15 : 25;
		if (won === lost) notes.push({ key: 'sports.volleyball.levelSet', vars: { n } });
		else if (won < target || won - lost < 2 || (won > target && won - lost !== 2)) {
			notes.push({ key: 'sports.volleyball.unusualSet', vars: { n, target } });
		}
		if (set.home > set.away) home++;
		else if (set.away > set.home) away++;
	});
	if (sets.length > 0 && home < toWin && away < toWin) {
		notes.push({ key: 'sports.volleyball.noWinner', vars: { count: toWin } });
	}
	return notes;
}
