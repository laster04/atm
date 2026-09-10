/**
 * Normalizes an email address for storage and lookup.
 *
 * Emails are treated case-insensitively: they are trimmed and lowercased so
 * that "User@Example.COM" and "user@example.com" resolve to the same account.
 * Apply this to every email coming from a request body before it reaches the
 * database, both on write and on lookup.
 */
export const normalizeEmail = (email: string): string => email.trim().toLowerCase();
