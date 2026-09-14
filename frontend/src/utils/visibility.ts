import { Visibility } from '@types';

const RANK: Record<Visibility, number> = {
	[Visibility.PUBLIC]: 0,
	[Visibility.UNLISTED]: 1,
	[Visibility.PRIVATE]: 2,
};

/**
 * How visible something actually is, given its own level and those of what it
 * sits under. Mirrors the server, where the strictest level wins. A level the
 * response did not carry counts as public, which is what the server assumes for
 * rows that predate visibility.
 */
export const strictest = (...levels: (Visibility | null | undefined)[]): Visibility =>
	levels.reduce<Visibility>(
		(worst, level) => (level && RANK[level] > RANK[worst] ? level : worst),
		Visibility.PUBLIC
	);
