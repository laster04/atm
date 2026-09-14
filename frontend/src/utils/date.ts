/**
 * Date utility functions for consistent date formatting across the application.
 *
 * Two kinds of value pass through here:
 *
 * - **Moments** - game, tournament game and team event times. Stored as a real
 *   instant (UTC) and always shown in APP_TIME_ZONE, whatever zone the viewer's
 *   device is set to, so a 19:30 kick-off in Prague reads 19:30 for everyone.
 *   Inputs go through toZonedInput / fromZonedInput for the same reason.
 * - **Calendar dates** - season start and end. Stored as midnight UTC and shown
 *   as that UTC calendar day, never shifted by a zone.
 */

/** The zone every game and event time is shown and entered in. */
export const APP_TIME_ZONE = 'Europe/Prague';

const zonedPartsFormatter = new Intl.DateTimeFormat('en-US', {
	timeZone: APP_TIME_ZONE,
	hourCycle: 'h23',
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit',
});

interface ZonedParts {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
	second: number;
}

/** The wall-clock reading of an instant in APP_TIME_ZONE. */
function zonedParts(date: Date): ZonedParts {
	const values: Record<string, number> = {};
	for (const part of zonedPartsFormatter.formatToParts(date)) {
		if (part.type !== 'literal') values[part.type] = Number(part.value);
	}
	return values as unknown as ZonedParts;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `YYYY-MM-DD` of the day an instant falls on in APP_TIME_ZONE. */
export function zonedDayKey(date: Date | string): string {
	const p = zonedParts(typeof date === 'string' ? new Date(date) : date);
	return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Whole calendar days in APP_TIME_ZONE from today to the given instant. */
export function zonedDaysUntil(date: Date | string): number {
	const toUtcMidnight = (key: string) => Date.parse(`${key}T00:00:00Z`);
	return Math.round((toUtcMidnight(zonedDayKey(date)) - toUtcMidnight(zonedDayKey(new Date()))) / 86400000);
}

/**
 * An instant as the value a `datetime-local` input wants (`YYYY-MM-DDTHH:mm`),
 * read in APP_TIME_ZONE rather than the browser's zone.
 */
export function toZonedInput(value: Date | string | null | undefined): string {
	if (!value) return '';
	const date = typeof value === 'string' ? new Date(value) : value;
	if (Number.isNaN(date.getTime())) return '';
	const p = zonedParts(date);
	return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/**
 * The ISO instant for a `datetime-local` value read as wall-clock time in
 * APP_TIME_ZONE. Returns null for an empty or unparsable value.
 */
export function fromZonedInput(value: string | null | undefined): string | null {
	const match = value ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value) : null;
	if (!match) return null;
	const [year, month, day, hour, minute] = match.slice(1).map(Number);
	const wanted = Date.UTC(year, month - 1, day, hour, minute);
	let guess = wanted;
	// Two passes settle the zone offset, including across a DST change.
	for (let i = 0; i < 2; i++) {
		const p = zonedParts(new Date(guess));
		guess += wanted - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
	}
	return new Date(guess).toISOString();
}

/**
 * Convert language code to locale string for date formatting.
 *
 * The detector can hand back a region tag ('cs-CZ'), which an equality check
 * missed — Czech pages then printed English dates.
 */
export function getLocale(language: string): string {
	return language?.toLowerCase().startsWith('cs') ? 'cs-CZ' : 'en-US';
}

/**
 * Get today's date as YYYY-MM-DD string.
 */
export function getTodayString(): string {
	return new Date().toISOString().split('T')[0];
}

/**
 * Format a date string for game schedules with time.
 * Example output: "Mon, Jan 17, 10:30 AM"
 */
export function formatGameDateTime(dateString: string | null | undefined, locale: string): string | null {
	if (!dateString) return null;
	return new Intl.DateTimeFormat(getLocale(locale), {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		timeZone: APP_TIME_ZONE,
	}).format(new Date(dateString));
}

/**
 * Format a date string for game schedules with time.
 * Example output: "10:30 AM"
 */
export function formatGameTime(dateString: string | null | undefined, locale: string): string | null {
	if (!dateString) return null;
	return new Intl.DateTimeFormat(getLocale(locale), {
		hour: '2-digit',
		minute: '2-digit',
		timeZone: APP_TIME_ZONE,
	}).format(new Date(dateString));
}

/**
 * Format a date string for short display without time.
 * Example output: "Mon, Jan 17"
 */
export function formatDateShort(dateString: string | null | undefined, locale: string): string | null {
	if (!dateString) return null;
	return new Intl.DateTimeFormat(getLocale(locale), {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		timeZone: APP_TIME_ZONE,
	}).format(new Date(dateString));
}

/**
 * Format a date string with year for season displays.
 * Example output: "Jan 17, 2026"
 */
export function formatSeasonDate(dateString: string | null | undefined, locale: string): string | null {
	if (!dateString) return null;
	return new Date(dateString).toLocaleDateString(getLocale(locale), {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		timeZone: 'UTC',
	});
}

/**
 * Format a date string using browser's default locale.
 * Example output: "1/17/2026" (US) or "17.1.2026" (CZ)
 */
export function formatDateLocale(dateString: string | null | undefined): string | null {
	if (!dateString) return null;
	return new Date(dateString).toLocaleDateString();
}

/**
 * Format a date string for HTML date input (YYYY-MM-DD).
 */
export function formatDateForInput(dateString: string | null | undefined): string {
	if (!dateString) return '';
	const date = new Date(dateString);
	return date.toISOString().split('T')[0];
}

/**
 * Check if a date is in the future.
 */
export function isDateInFuture(dateString: string): boolean {
	return new Date(dateString) > new Date();
}

/**
 * Whether a game or event falls today, before today or after today - as
 * calendar days in APP_TIME_ZONE, so a 00:30 start is not filed under the day
 * before just because it is still yesterday in UTC.
 */
export function isToday(dateString: string | null | undefined): boolean {
	if (!dateString) return false;
	return zonedDayKey(dateString) === zonedDayKey(new Date());
}

export function isBeforeToday(dateString: string | null | undefined): boolean {
	if (!dateString) return false;
	return zonedDayKey(dateString) < zonedDayKey(new Date());
}

export function isAfterToday(dateString: string | null | undefined): boolean {
	if (!dateString) return false;
	return zonedDayKey(dateString) > zonedDayKey(new Date());
}
