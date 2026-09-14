import { parseCalendarDate, zonedDateTime, zonedParts } from '../utils/time.js';

describe('zonedDateTime', () => {
  it('reads a summer wall-clock time in Prague as UTC+2', () => {
    expect(zonedDateTime(2026, 9, 19, 19, 30).toISOString()).toBe('2026-09-19T17:30:00.000Z');
  });

  it('reads a winter wall-clock time in Prague as UTC+1', () => {
    expect(zonedDateTime(2026, 1, 17, 10, 30).toISOString()).toBe('2026-01-17T09:30:00.000Z');
  });

  it('keeps the wall-clock time on the day summer time starts', () => {
    // 29 March 2026: clocks go from 02:00 to 03:00.
    expect(zonedDateTime(2026, 3, 29, 18, 0).toISOString()).toBe('2026-03-29T16:00:00.000Z');
  });

  it('keeps the wall-clock time on the day summer time ends', () => {
    // 25 October 2026: clocks go from 03:00 back to 02:00.
    expect(zonedDateTime(2026, 10, 25, 18, 0).toISOString()).toBe('2026-10-25T17:00:00.000Z');
  });

  it('rolls minutes and days over, so slots can be added directly', () => {
    expect(zonedDateTime(2026, 9, 30, 18, 90).toISOString()).toBe('2026-09-30T17:30:00.000Z');
    expect(zonedDateTime(2026, 9, 31, 9, 0).toISOString()).toBe('2026-10-01T07:00:00.000Z');
  });

  it('round-trips through zonedParts', () => {
    const parts = zonedParts(zonedDateTime(2026, 12, 31, 23, 45));
    expect(parts).toMatchObject({ year: 2026, month: 12, day: 31, hour: 23, minute: 45 });
  });
});

describe('zonedParts', () => {
  it('gives the Prague calendar day, not the UTC one', () => {
    // 23:30 UTC on 19 September is already 20 September in Prague.
    expect(zonedParts(new Date('2026-09-19T23:30:00.000Z'))).toMatchObject({ day: 20, hour: 1, minute: 30 });
  });
});

describe('parseCalendarDate', () => {
  it('accepts a real date', () => {
    expect(parseCalendarDate('2026-09-19')).toEqual({ year: 2026, month: 9, day: 19 });
  });

  it('rejects anything else', () => {
    expect(parseCalendarDate('2026-02-30')).toBeNull();
    expect(parseCalendarDate('19.9.2026')).toBeNull();
    expect(parseCalendarDate('2026-09-19T10:00')).toBeNull();
  });
});
