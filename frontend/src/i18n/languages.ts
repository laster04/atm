/**
 * The languages the app can show. A language that is not `live` yet works
 * when asked for by address (?lang=sk) or kept from an earlier visit, so it
 * can be checked before launch, but the language menu does not offer it and a
 * browser set to it does not pick it by itself.
 */
export interface Language {
	code: string;
	/** In the language itself, as the menu shows it. */
	label: string;
	/** The short tag on the header button. */
	short: string;
	live: boolean;
	/** Where a missing text is looked up next. */
	fallback: string[];
	/** Help articles and release notes exist in Czech and English only. */
	content: 'cs' | 'en';
	/** For dates and numbers. */
	locale: string;
}

export const LANGUAGES: Language[] = [
	{ code: 'cs', label: 'Čeština', short: 'CZ', live: true, fallback: ['en'], content: 'cs', locale: 'cs-CZ' },
	{ code: 'en', label: 'English', short: 'EN', live: true, fallback: [], content: 'en', locale: 'en-US' },
	// Waiting for the owner's check before launch (decided 23 Oct 2026).
	{ code: 'sk', label: 'Slovenčina', short: 'SK', live: false, fallback: ['cs', 'en'], content: 'cs', locale: 'sk-SK' },
];

export const DEFAULT_LANGUAGE = 'en';

/** The known language a tag like "sk-SK" or "SK" belongs to, if any. */
export const languageOf = (tag: string | null | undefined): Language | undefined => {
	const code = tag?.toLowerCase().split(/[-_]/)[0];
	return LANGUAGES.find((language) => language.code === code);
};

/** What the language menu lists: the live languages, plus the current one while it is being checked. */
export const menuLanguages = (current: string): Language[] =>
	LANGUAGES.filter((language) => language.live || language.code === languageOf(current)?.code);

/** A language as the server knows it, for the e-mails it writes: "sk", never "sk-SK". */
export const serverLocale = (tag: string | null | undefined): string => languageOf(tag)?.code ?? DEFAULT_LANGUAGE;
