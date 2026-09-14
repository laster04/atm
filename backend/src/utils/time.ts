/**
 * Game and event times are stored as real instants (UTC in the database) and
 * shown to everyone in one zone. A kick-off at 19:30 in Prague is 19:30 for a
 * visitor abroad and for a server running in UTC alike.
 *
 * Anything that turns a calendar day and a wall-clock time into an instant -
 * tournament slot generation, for one - goes through here rather than
 * Date#setHours, which silently uses the server's own zone.
 */
export const APP_TIME_ZONE = 'Europe/Prague';

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
}

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** The wall-clock reading of an instant in the app zone. */
export function zonedParts(date: Date): ZonedParts & { second: number } {
  const values: Record<string, number> = {};
  for (const part of partsFormatter.formatToParts(date)) {
    if (part.type !== 'literal') values[part.type] = Number(part.value);
  }
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

/**
 * The instant at which the app zone reads the given wall-clock time.
 *
 * Out-of-range fields roll over the way Date.UTC does (minute 90 is the next
 * hour, day 32 the next month), so callers can add slots and days directly.
 * In the autumn hour that happens twice, the earlier instant wins; a time
 * skipped in spring resolves to the instant an hour later.
 */
export function zonedDateTime(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  const wanted = Date.UTC(year, month - 1, day, hour, minute);
  let guess = wanted;
  // Two passes settle the offset, including across a DST change.
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(new Date(guess));
    const reads = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    guess += wanted - reads;
  }
  return new Date(guess);
}

/** Parse `YYYY-MM-DD` into calendar fields, or null when it is not one. */
export function parseCalendarDate(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return { year, month, day };
}
