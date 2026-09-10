/**
 * Normalizes an email address before it is sent to the API.
 *
 * Emails are case-insensitive, so they are trimmed and lowercased to keep
 * logins and lookups consistent with the backend, which stores them the
 * same way.
 */
export const normalizeEmail = (email: string): string => email.trim().toLowerCase();
