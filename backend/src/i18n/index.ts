import cs from './emails/cs.js';
import en from './emails/en.js';
import sk from './emails/sk.js';

/**
 * Languages the server writes in: e-mails and the shareable results image.
 * The web app has its own texts (frontend/src/i18n); these are the ones that
 * leave the server. Adding a language = a file in ./emails with the same
 * shape (TypeScript refuses one with a text missing) and an entry here.
 */
export const LOCALES = ['cs', 'en', 'sk'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'cs';

export const isLocale = (value: string): value is Locale => (LOCALES as readonly string[]).includes(value);

/** The supported language of a tag like "sk-SK", or the default. */
export function localeOf(value: unknown, fallback: Locale = DEFAULT_LOCALE): Locale {
  if (typeof value !== 'string') return fallback;
  const code = value.toLowerCase().split(/[-_]/)[0];
  return isLocale(code) ? code : fallback;
}

/** For Intl date and number formatting. */
export const intlLocale = (locale: Locale): string => ({ cs: 'cs-CZ', en: 'en-GB', sk: 'sk-SK' })[locale];

export type EmailTexts = typeof cs;

const EMAILS: Record<Locale, EmailTexts> = { cs, en, sk };

export const emailTexts = (locale: Locale): EmailTexts => EMAILS[locale];

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

type Vars = Record<string, string | number | null | undefined>;

/**
 * Fills {{name}} placeholders. Values are escaped for HTML: the templates may
 * carry markup (<strong>), the values a team or a person typed never do.
 */
export const fill = (template: string, vars: Vars = {}): string =>
  template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => escapeHtml(String(vars[key] ?? '')));

/** The same for a subject line, which is plain text: nothing is escaped. */
export const fillText = (template: string, vars: Vars = {}): string =>
  template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(vars[key] ?? ''));

/** One of a text's plural forms ({ one, few, other }) for a count, by the language's rules. */
export function plural(locale: Locale, forms: { one: string; few?: string; many?: string; other: string }, count: number): string {
  const rule = new Intl.PluralRules(intlLocale(locale)).select(count) as 'one' | 'few' | 'many' | 'other';
  return forms[rule] ?? forms.other;
}
