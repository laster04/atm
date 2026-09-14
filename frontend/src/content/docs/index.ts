import { ARTICLES } from './articles';
import type { DocsArticle, DocsAudience, DocsBlock, DocsCategory, DocsLocale } from './types';

export type { DocsArticle, DocsAudience, DocsBlock, DocsCategory, DocsLocale } from './types';

export const CATEGORIES: DocsCategory[] = ['start', 'league', 'team', 'more'];

export const DEFAULT_SLUG = 'rychly-start';

/** Only live articles are listed, searchable or linkable. */
export const PUBLISHED = ARTICLES.filter((article) => article.published).sort(
	(a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) || a.order - b.order,
);

export const findArticle = (slug: string | undefined): DocsArticle | undefined =>
	PUBLISHED.find((article) => article.slug === slug);

export const docsLocale = (language: string | undefined): DocsLocale =>
	language?.toLowerCase().startsWith('cs') ? 'cs' : 'en';

/** Which audiences a signed-in user belongs to, from what they manage. */
export function audiencesFor(manages: { leagues: number; teams: number; series: number } | undefined, isAdmin: boolean): DocsAudience[] {
	if (isAdmin) return ['LEAGUE', 'TEAM', 'TOURNAMENT'];
	const result: DocsAudience[] = [];
	if ((manages?.leagues ?? 0) > 0) result.push('LEAGUE');
	if ((manages?.teams ?? 0) > 0) result.push('TEAM');
	if ((manages?.series ?? 0) > 0) result.push('TOURNAMENT');
	return result;
}

// ------------------------------------------------------------------ search

/** Case- and accent-insensitive form: "Sezóna" and "sezona" match. */
export const normalize = (text: string): string =>
	text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Inline markers reduced to readable text; `{ui:key}` is resolved by the caller. */
export const plainText = (text: string, resolve: (key: string) => string): string =>
	text.replace(/\{ui:([\w.-]+)\}/g, (_, key: string) => resolve(key)).replace(/\*\*(.+?)\*\*/g, '$1');

const blockText = (block: DocsBlock): string[] => {
	switch (block.type) {
		case 'p':
		case 'h':
		case 'note':
			return [block.text];
		case 'steps':
		case 'list':
			return block.items;
		case 'defs':
			return block.items.flat();
	}
};

export interface DocsSearchResult {
	article: DocsArticle;
	snippet: string;
}

/**
 * Every term must appear somewhere in the article. Title hits rank first, then
 * summary and keywords, then body text; the snippet is the first body sentence
 * containing the first term, or the summary.
 */
export function searchArticles(query: string, locale: DocsLocale, resolve: (key: string) => string): DocsSearchResult[] {
	const terms = normalize(query).split(/\s+/).filter(Boolean);
	if (terms.length === 0) return [];

	const scored = PUBLISHED.map((article) => {
		const content = article.content[locale];
		const title = normalize(content.title);
		const meta = normalize([content.summary, ...content.keywords].join(' '));
		const bodyParts = content.blocks.flatMap(blockText).map((text) => plainText(text, resolve));
		const body = normalize(bodyParts.join(' '));

		let score = 0;
		for (const term of terms) {
			if (title.includes(term)) score += 10;
			else if (meta.includes(term)) score += 4;
			else if (body.includes(term)) score += 1;
			else return null;
		}

		const hit = bodyParts.find((part) => normalize(part).includes(terms[0]));
		return { article, score, snippet: hit ?? content.summary };
	}).filter((entry): entry is { article: DocsArticle; score: number; snippet: string } => entry !== null);

	return scored
		.sort((a, b) => b.score - a.score)
		.map(({ article, snippet }) => ({ article, snippet: snippet.length > 160 ? `${snippet.slice(0, 157)}…` : snippet }));
}
