import { Response } from 'express';
import prisma from '../../config/database.js';
import { parseCalendarDate, zonedDateTime } from '../../utils/time.js';

/**
 * Server side of the admin list component: one page at a time, a whitelisted
 * sort, and the same query exported as CSV. A browser never holds a whole table.
 */

export const PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
/** A CSV past this many rows is cut off; the header says so. */
export const EXPORT_LIMIT = 50_000;
const EXPORT_BATCH = 1_000;
/** Unfiltered tables past this size report the planner's estimate, not count(*). */
const ESTIMATE_ABOVE = 100_000;

export interface ListParams<S extends string> {
  page: number;
  pageSize: number;
  sort: S;
  dir: 'asc' | 'desc';
  q: string;
  csv: boolean;
}

type Query = Record<string, unknown>;

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export function parseListParams<S extends string>(
  query: Query,
  sortable: readonly S[],
  defaults: { sort: S; dir: 'asc' | 'desc' }
): ListParams<S> {
  const page = Math.max(1, parseInt(text(query.page)) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(text(query.pageSize)) || PAGE_SIZE));
  const requested = text(query.sort) as S;
  const sort = sortable.includes(requested) ? requested : defaults.sort;
  const dir = query.dir === 'asc' || query.dir === 'desc' ? query.dir : defaults.dir;
  return { page, pageSize, sort, dir, q: text(query.q), csv: query.format === 'csv' };
}

/** `true`/`false` query values; anything else means the filter is off. */
export const boolParam = (value: unknown): boolean | undefined =>
  value === 'true' ? true : value === 'false' ? false : undefined;

/** One of the allowed values, or undefined. */
export const enumParam = <T extends string>(value: unknown, allowed: readonly T[]): T | undefined =>
  allowed.includes(value as T) ? (value as T) : undefined;

/**
 * A `from`–`to` pair of calendar days, read in the app's time zone, as a
 * half-open instant range. `to` includes its whole day.
 */
export function dayRange(from: unknown, to: unknown): { gte?: Date; lt?: Date } | undefined {
  const start = parseCalendarDate(text(from));
  const end = parseCalendarDate(text(to));
  if (!start && !end) return undefined;
  return {
    ...(start && { gte: zonedDateTime(start.year, start.month, start.day) }),
    ...(end && { lt: zonedDateTime(end.year, end.month, end.day + 1) }),
  };
}

/**
 * Row count for the pager. Filtered queries are counted exactly; an unfiltered
 * one on a big table takes the planner's estimate, which is free.
 */
export async function totalRows(
  table: string,
  filtered: boolean,
  exact: () => Promise<number>
): Promise<{ total: number; estimated: boolean }> {
  if (!filtered) {
    const [row] = await prisma.$queryRaw<{ estimate: bigint | number | null }[]>`
      SELECT reltuples::bigint AS estimate FROM pg_class WHERE oid = to_regclass(${table})`;
    const estimate = Number(row?.estimate ?? -1);
    if (estimate > ESTIMATE_ABOVE) return { total: estimate, estimated: true };
  }
  return { total: await exact(), estimated: false };
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => unknown;
}

/**
 * Semicolon-separated with a BOM: what Excel opens correctly in a Czech
 * locale. A cell starting with a formula character is prefixed with an
 * apostrophe so a name like `=HYPERLINK(...)` stays text.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let cell = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(cell)) cell = `'${cell}`;
  return /[";\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

/**
 * Streams the filtered result as CSV, fetching it in batches so a large export
 * never sits in memory at once.
 */
export async function sendCsv<T>(
  res: Response,
  filename: string,
  columns: CsvColumn<T>[],
  fetchBatch: (skip: number, take: number) => Promise<T[]>
): Promise<void> {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.write('﻿' + columns.map((column) => csvCell(column.header)).join(';') + '\r\n');
  for (let skip = 0; skip < EXPORT_LIMIT; skip += EXPORT_BATCH) {
    const rows = await fetchBatch(skip, Math.min(EXPORT_BATCH, EXPORT_LIMIT - skip));
    for (const row of rows) {
      res.write(columns.map((column) => csvCell(column.value(row))).join(';') + '\r\n');
    }
    if (rows.length < EXPORT_BATCH) break;
  }
  res.end();
}

/** `atm-users-2026-10-21.csv` */
export const csvFilename = (name: string): string =>
  `atm-${name}-${new Date().toISOString().slice(0, 10)}.csv`;
