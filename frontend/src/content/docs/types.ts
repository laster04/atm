/**
 * Help articles are content, kept apart from the components that render them.
 *
 * Inline text may carry two markers:
 * - `**bold**` for emphasis;
 * - `{ui:some.i18n.key}` for the name of a control, rendered bold from the
 *   locale files, so an article can never drift from what the button says.
 */

/** Who an article is recommended to. Never a permission: every article is public. */
export type DocsAudience = 'ALL' | 'LEAGUE' | 'TEAM' | 'TOURNAMENT';

export type DocsCategory = 'start' | 'league' | 'team' | 'more';

export type DocsLocale = 'cs' | 'en';

export type DocsBlock =
	| { type: 'p'; text: string }
	| { type: 'h'; id: string; text: string }
	| { type: 'steps'; items: string[] }
	| { type: 'list'; items: string[] }
	| { type: 'defs'; items: [term: string, text: string][] }
	| { type: 'note'; tone: 'tip' | 'important'; text: string };

export interface DocsContent {
	title: string;
	summary: string;
	keywords: string[];
	blocks: DocsBlock[];
}

export interface DocsArticle {
	slug: string;
	category: DocsCategory;
	audiences: DocsAudience[];
	order: number;
	/** YYYY-MM-DD */
	updatedAt: string;
	/** Unpublished articles describe features that are not live yet. */
	published: boolean;
	related: string[];
	content: Record<DocsLocale, DocsContent>;
}
