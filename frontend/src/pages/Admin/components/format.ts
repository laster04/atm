import { APP_TIME_ZONE, getLocale } from '@/utils/date';

/** An instant as the admin screens show it: date and time in Prague. */
export const formatInstant = (value: string | null | undefined, language: string): string =>
	value
		? new Date(value).toLocaleString(getLocale(language), { timeZone: APP_TIME_ZONE, dateStyle: 'medium', timeStyle: 'short' })
		: '—';

/** A calendar day in Prague. */
export const formatDay = (value: string | null | undefined, language: string): string =>
	value
		? new Date(value).toLocaleDateString(getLocale(language), { timeZone: APP_TIME_ZONE, day: 'numeric', month: 'numeric', year: 'numeric' })
		: '—';
