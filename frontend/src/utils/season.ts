import type { Season } from '@types';

/**
 * A season named only by its years ("2026 - 2027") says nothing on its own, so
 * a pick list leads with the league it belongs to.
 */
export const seasonLabel = (season: Pick<Season, 'name' | 'league'>): string =>
	season.league ? `${season.league.name} · ${season.name}` : season.name;

/** An archived season has no games left; the count it kept stands in for them. */
export const seasonGameCount = (season: Pick<Season, 'archivedAt' | 'archivedGames' | '_count'>): number =>
	season.archivedAt ? season.archivedGames ?? 0 : season._count?.games ?? 0;
