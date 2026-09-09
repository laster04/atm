/**
 * Ids are strings, but a request body may still carry a JSON number — clients
 * written against the old integer ids do exactly that. Coerce instead of
 * rejecting, so a wrong id surfaces as a 404 from the lookup rather than as a
 * Prisma type error (a 500).
 */
export const toId = (value: unknown): string | undefined =>
  value === undefined || value === null ? undefined : String(value);

/** As `toId`, but keeps an explicit `null` — used where null means "unset". */
export const toNullableId = (value: unknown): string | null | undefined =>
  value === undefined ? undefined : value === null || value === '' ? null : String(value);
