import type { TFunction } from 'i18next';
import type { PlayerPosition, Team } from '@types';

/** Every position, in the order forms list them. */
export const PLAYER_POSITIONS: PlayerPosition[] = [
	'GOALIE',
	'DEFENDER',
	'MIDFIELDER',
	'FORWARD',
	'WING',
	'BACK',
	'PIVOT',
	'GUARD',
	'CENTER',
	'SETTER',
	'OUTSIDE_HITTER',
	'OPPOSITE',
	'MIDDLE_BLOCKER',
	'LIBERO',
];

/**
 * The positions a player may hold, per sport. A sport with no list has no
 * position field at all.
 *
 * Mirrors backend/src/utils/playerPositions.ts, which enforces it; keep the two in step.
 */
const SPORT_POSITIONS: Record<string, PlayerPosition[]> = {
	HOCKEY: ['GOALIE', 'DEFENDER', 'FORWARD'],
	FLOORBALL: ['GOALIE', 'DEFENDER', 'FORWARD'],
	FOOTBALL: ['GOALIE', 'DEFENDER', 'MIDFIELDER', 'FORWARD'],
	HANDBALL: ['GOALIE', 'WING', 'BACK', 'PIVOT'],
	BASKETBALL: ['GUARD', 'FORWARD', 'CENTER'],
	VOLLEYBALL: ['SETTER', 'OUTSIDE_HITTER', 'OPPOSITE', 'MIDDLE_BLOCKER', 'LIBERO'],
};

/** Positions for a team playing these sports; a team may sit in leagues of more than one. */
export function positionsForSports(sports: (string | null | undefined)[]): PlayerPosition[] {
	const allowed = new Set(sports.flatMap((sport) => (sport ? SPORT_POSITIONS[sport] ?? [] : [])));
	return PLAYER_POSITIONS.filter((position) => allowed.has(position));
}

/**
 * Sports a team plays. The API's `sportTypes` counts seasons the viewer cannot
 * see; the seasons in the payload are only a fallback for lists that lack it.
 */
export function teamSports(team: Team | null | undefined): string[] {
	if (!team) return [];
	if (team.sportTypes) return team.sportTypes;
	const sports: (string | undefined)[] = [
		...(team.seasonTeams ?? []).map((entry) => entry.season?.league?.sportType),
		team.season?.league?.sportType,
	];
	return sports.filter((sport): sport is string => !!sport);
}

/** Translated label, or an empty string when the player has no position. */
export function positionLabel(t: TFunction, position: PlayerPosition | null | undefined): string {
	return position ? t(`playerPositions.${position}`) : '';
}
