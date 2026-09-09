import { GameStatus, SeasonStatus, type Game, type Season } from '@types';

/**
 * Seasons carry no colour of their own — a team does, a league does not — so
 * the manager screens use the app's navy for their chrome, the same value the
 * team manager falls back to when a team has no colour set.
 */
export const SEASON_ACCENT = '#003E7E';

/** Tinted pill backgrounds, matching the ones ScheduleTab uses for games. */
export const SEASON_STATUS_TONE: Record<SeasonStatus, { bg: string; fg: string }> = {
	[SeasonStatus.DRAFT]: { bg: '#fef3c7', fg: '#92400e' },
	[SeasonStatus.ACTIVE]: { bg: '#dcfce7', fg: '#166534' },
	[SeasonStatus.COMPLETED]: { bg: '#e5e7eb', fg: '#374151' },
};

export const GAME_STATUS_TONE: Record<string, { bg: string; fg: string }> = {
	[GameStatus.SCHEDULED]: { bg: '#e0e7ff', fg: '#3730a3' },
	[GameStatus.IN_PROGRESS]: { bg: '#dcfce7', fg: '#166534' },
	[GameStatus.COMPLETED]: { bg: '#e5e7eb', fg: '#374151' },
	[GameStatus.POSTPONED]: { bg: '#fef3c7', fg: '#92400e' },
	[GameStatus.CANCELLED]: { bg: '#fee2e2', fg: '#991b1b' },
};

/** Teams reach a season through `seasonTeams`, so `_count` names it either way. */
export function teamCount(season: Season | null): number {
	return season?._count?.seasonTeams ?? season?._count?.teams ?? season?.teams?.length ?? 0;
}

export function isPlayed(game: Game): boolean {
	return game.status === GameStatus.COMPLETED;
}

/** A fixture the manager still has to date: scheduled, or postponed to nowhere. */
export function needsDate(game: Game): boolean {
	return !game.date && game.status !== GameStatus.CANCELLED;
}

/** Two-letter badge for a team with no logo, e.g. "Jiskra Třeboň" -> "JT". */
export function initials(name: string): string {
	const words = name.trim().split(/\s+/).filter(Boolean);
	if (words.length === 0) return '?';
	if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
	return (words[0][0] + words[1][0]).toUpperCase();
}

/** `datetime-local` wants `YYYY-MM-DDTHH:mm` in local time, not an ISO instant. */
export function toLocalInput(iso?: string | null): string {
	if (!iso) return '';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '';
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string): string | null {
	if (!value) return null;
	const d = new Date(value);
	return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Rounds present in the season, ascending; fixtures with no round go last. */
export function roundsOf(games: Game[]): number[] {
	const set = new Set<number>();
	games.forEach((g) => {
		if (typeof g.round === 'number') set.add(g.round);
	});
	return [...set].sort((a, b) => a - b);
}
