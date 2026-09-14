import { SportType } from '@types';

/**
 * The hero photograph is chosen by the sport being shown, so a tennis league
 * does not sit under a photograph of ice. Sports without a photograph of their
 * own fall back to the ice one rather than to no image, which would leave the
 * navy band empty.
 */
const HERO_BY_SPORT: Partial<Record<SportType, string>> = {
	[SportType.HOCKEY]: 'hockey',
	[SportType.TENNIS]: 'tennis',
};

export interface HeroImage {
	src: string;
	/** Narrow render of the same photograph, for phones. */
	srcSmall: string;
}

export function heroImage(sport?: SportType | null): HeroImage {
	const name = (sport && HERO_BY_SPORT[sport]) || 'hockey';
	return {
		src: `/images/hero/${name}.jpg`,
		srcSmall: `/images/hero/${name}-sm.jpg`,
	};
}
