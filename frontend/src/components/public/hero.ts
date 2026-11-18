import { SportType } from '@types';

/**
 * The hero photograph is chosen by the sport being shown, so a tennis league
 * does not sit under a photograph of ice. A sport without a photograph of its
 * own gets the plain navy band: a volleyball league under a hockey stick looked
 * like the wrong sport. Pages about no sport in particular keep the ice one.
 */
const HERO_BY_SPORT: Partial<Record<SportType, string>> = {
	[SportType.HOCKEY]: 'hockey',
	[SportType.TENNIS]: 'tennis',
	// Pexels photo 12169074 (Pexels License: free, no credit required), cropped.
	[SportType.VOLLEYBALL]: 'volleyball',
};

export interface HeroImage {
	src: string;
	/** Narrow render of the same photograph, for phones. */
	srcSmall: string;
}

export function heroImage(): HeroImage;
export function heroImage(sport?: SportType | null): HeroImage | null;
export function heroImage(sport?: SportType | null): HeroImage | null {
	const name = sport ? HERO_BY_SPORT[sport] : 'hockey';
	if (!name) return null;
	return {
		src: `/images/hero/${name}.jpg`,
		srcSmall: `/images/hero/${name}-sm.jpg`,
	};
}
