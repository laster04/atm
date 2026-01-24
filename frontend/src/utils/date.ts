/**
 * Date utility functions for consistent date formatting across the application.
 */

/**
 * Convert language code to locale string for date formatting.
 */
export function getLocale(language: string): string {
	return language === 'cs' ? 'cs-CZ' : 'en-US';
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
	return new Date(dateString).toLocaleDateString(getLocale(locale), {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
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
	}).format(new Date(dateString));
}

/**
 * Format a date string for short display without time.
 * Example output: "Mon, Jan 17"
 */
export function formatDateShort(dateString: string | null | undefined, locale: string): string | null {
	if (!dateString) return null;
	return new Date(dateString).toLocaleDateString(getLocale(locale), {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
	});
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
 * Format a date string for HTML datetime-local input (YYYY-MM-DDTHH:mm).
 */
export function formatDateTimeForInput(dateString: string | null | undefined): string {
	if (!dateString) return '';
	const date = new Date(dateString);
	return date.toISOString().slice(0, 16);
}

/**
 * Convert a date string or Date object to ISO string for API calls.
 */
export function toISOString(date: Date | string): string {
	if (typeof date === 'string') {
		return new Date(date).toISOString();
	}
	return date.toISOString();
}

/**
 * Check if a date is in the future.
 */
export function isDateInFuture(dateString: string): boolean {
	return new Date(dateString) > new Date();
}

/**
 * Check if a date string matches today's date.
 */
export function isToday(dateString: string | null | undefined): boolean {
	if (!dateString) return false;
	return dateString.startsWith(getTodayString());
}

/**
 * Check if a date string is before today.
 */
export function isBeforeToday(dateString: string | null | undefined): boolean {
	if (!dateString) return false;
	return dateString < getTodayString();
}

/**
 * Check if a date string is after today.
 */
export function isAfterToday(dateString: string | null | undefined): boolean {
	if (!dateString) return false;
	return dateString > getTodayString();
}
