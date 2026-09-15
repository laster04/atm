/**
 * Imports a season schedule from the AHS Google Sheet ("Zápasy" tab) into a
 * league. Dry run by default: prints what it would do and writes nothing.
 *
 *   npx tsx prisma/import-season-schedule.ts --league AHS --sheet <url|file.csv>
 *   npx tsx prisma/import-season-schedule.ts --league AHS --sheet <url|file.csv> --apply
 *
 * Options:
 *   --league  League name (exact) or id. Required.
 *   --sheet   Google Sheets URL (the tab's gid is kept) or a local CSV export. Required.
 *   --season  Season name. Defaults to the sheet's "2026/2027" as "2026 - 2027".
 *   --start   Season start (YYYY-MM-DD) when the season is created. Defaults to the first dated game.
 *   --end     Season end (YYYY-MM-DD) when the season is created. Defaults to 30 April of the next year.
 *   --apply   Write to the database.
 *
 * The sheet is expected to have a header row with KOLO, DATUM, ČAS, DOMÁCÍ and
 * HOSTÉ. "I. KOLO" becomes round 1 (one full round-robin, as the schedule
 * generator counts rounds). Games without a date are imported undated. The
 * 0 : 0 placeholders in the result columns are ignored.
 *
 * Teams are matched by exact name to existing teams and added to the season.
 * The season is created (DRAFT, unlisted) when missing; a season that already
 * has games is left alone, so running the import twice cannot double the draw.
 */
import { readFile } from 'node:fs/promises';
import prisma from '../src/config/database.js';
import { syncFixtureEvents } from '../src/services/teamEvents/mirror.js';
import { APP_TIME_ZONE, parseCalendarDate, zonedDateTime } from '../src/utils/time.js';

interface Row {
  line: number;
  round: number;
  number: string;
  date: Date | null;
  home: string;
  away: string;
}

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith('--')) throw new Error(`Unexpected argument: ${key}`);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      args[key.slice(2)] = true;
    } else {
      args[key.slice(2)] = next;
      i++;
    }
  }
  return args;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

async function loadSheet(source: string): Promise<string> {
  if (!/^https?:\/\//.test(source)) return readFile(source, 'utf8');

  const id = /\/spreadsheets\/d\/([^/]+)/.exec(source)?.[1];
  if (!id) throw new Error(`Not a Google Sheets URL: ${source}`);
  const gid = /[#?&]gid=(\d+)/.exec(source)?.[1];
  const url = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv${gid ? `&gid=${gid}` : ''}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Sheet download failed: ${response.status} ${response.statusText}`);
  return response.text();
}

const ROMAN: Record<string, number> = { I: 1, V: 5, X: 10 };

function romanToInt(value: string): number | null {
  if (!/^[IVX]+$/.test(value)) return null;
  let total = 0;
  for (let i = 0; i < value.length; i++) {
    const current = ROMAN[value[i]];
    const next = ROMAN[value[i + 1]] ?? 0;
    total += current < next ? -current : current;
  }
  return total;
}

/** "I. KOLO" -> 1, also accepts a plain number. */
function parseRound(value: string): number | null {
  const token = value.trim().split(/[.\s]/)[0];
  if (/^\d+$/.test(token)) return Number(token);
  return romanToInt(token.toUpperCase());
}

/** "27.9.2026" + "17:30" as Prague wall-clock time. */
function parseKickOff(dateText: string, timeText: string, line: number): Date | null {
  const text = dateText.trim();
  if (!text) {
    if (timeText.trim()) throw new Error(`Line ${line}: time without a date`);
    return null;
  }
  const d = /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/.exec(text);
  if (!d) throw new Error(`Line ${line}: unreadable date "${text}"`);
  const [day, month, year] = d.slice(1).map(Number);
  const calendar = parseCalendarDate(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  if (!calendar) throw new Error(`Line ${line}: invalid date "${text}"`);

  let hour = 0;
  let minute = 0;
  if (timeText.trim()) {
    const t = /^(\d{1,2}):(\d{2})$/.exec(timeText.trim());
    if (!t) throw new Error(`Line ${line}: unreadable time "${timeText}"`);
    [hour, minute] = t.slice(1).map(Number);
    if (hour > 23 || minute > 59) throw new Error(`Line ${line}: invalid time "${timeText}"`);
  }
  return zonedDateTime(calendar.year, calendar.month, calendar.day, hour, minute);
}

function parseSchedule(cells: string[][]): { seasonLabel: string | null; rows: Row[] } {
  const seasonLabel = cells.flat().map((c) => c.trim()).find((c) => /^\d{4}\s*\/\s*\d{4}$/.test(c)) ?? null;

  const headerIndex = cells.findIndex((row) => row.some((c) => c.trim().toUpperCase() === 'KOLO'));
  if (headerIndex < 0) throw new Error('Header row with KOLO not found');
  const header = cells[headerIndex].map((c) => c.trim().toUpperCase());
  const col = (name: string) => {
    const index = header.indexOf(name);
    if (index < 0) throw new Error(`Column ${name} not found`);
    return index;
  };
  const cRound = col('KOLO');
  const cNumber = header.indexOf('ČZ');
  const cDate = col('DATUM');
  const cTime = col('ČAS');
  const cHome = col('DOMÁCÍ');
  const cAway = col('HOSTÉ');

  const rows: Row[] = [];
  for (let i = headerIndex + 1; i < cells.length; i++) {
    const cell = (index: number) => (cells[i][index] ?? '').trim();
    const line = i + 1;
    if (!cell(cRound) && !cell(cHome) && !cell(cAway)) continue;

    const round = parseRound(cell(cRound));
    if (round === null) throw new Error(`Line ${line}: unreadable round "${cell(cRound)}"`);
    if (!cell(cHome) || !cell(cAway)) throw new Error(`Line ${line}: missing team`);
    if (cell(cHome) === cell(cAway)) throw new Error(`Line ${line}: team plays itself`);

    rows.push({
      line,
      round,
      number: cNumber >= 0 ? cell(cNumber) : '',
      date: parseKickOff(cell(cDate), cell(cTime), line),
      home: cell(cHome),
      away: cell(cAway),
    });
  }
  return { seasonLabel, rows };
}

const pragueFormat = new Intl.DateTimeFormat('cs-CZ', {
  timeZone: APP_TIME_ZONE,
  dateStyle: 'short',
  timeStyle: 'short',
});

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apply = args.apply === true;
  if (typeof args.league !== 'string' || typeof args.sheet !== 'string') {
    throw new Error('Usage: --league <name|id> --sheet <url|file.csv> [--season <name>] [--start YYYY-MM-DD] [--end YYYY-MM-DD] [--apply]');
  }

  const { seasonLabel, rows } = parseSchedule(parseCsv(await loadSheet(args.sheet)));
  if (!rows.length) throw new Error('No games found in the sheet');

  const seasonName =
    typeof args.season === 'string' ? args.season : seasonLabel?.replace(/\s*\/\s*/, ' - ');
  if (!seasonName) throw new Error('Season name not found in the sheet; pass --season');

  const league = await prisma.league.findFirst({
    where: { OR: [{ id: args.league }, { name: args.league }] },
    select: { id: true, name: true, seasons: { select: { id: true } } },
  });
  if (!league) throw new Error(`League "${args.league}" not found`);

  // Team names are not unique across the app, so a name that matches several
  // teams is resolved to the one that has played in this league before.
  const leagueSeasonIds = league.seasons.map((s) => s.id);
  const teamNames = [...new Set(rows.flatMap((r) => [r.home, r.away]))];
  const teamIds = new Map<string, string>();
  const problems: string[] = [];
  for (const name of teamNames) {
    const candidates = await prisma.team.findMany({
      where: { name },
      select: {
        id: true,
        seasonTeams: { where: { seasonId: { in: leagueSeasonIds } }, select: { id: true } },
        archivedStandings: { where: { seasonId: { in: leagueSeasonIds } }, select: { id: true } },
      },
    });
    const inLeague = candidates.filter((t) => t.seasonTeams.length || t.archivedStandings.length);
    const pick = candidates.length === 1 ? candidates : inLeague;
    if (pick.length === 1) teamIds.set(name, pick[0].id);
    else if (!candidates.length) problems.push(`Team "${name}" does not exist`);
    else problems.push(`Team "${name}" matches ${candidates.length} teams, none or several from this league`);
  }
  if (problems.length) throw new Error(problems.join('\n'));

  const existing = await prisma.season.findFirst({
    where: { leagueId: league.id, name: seasonName },
    select: { id: true, archivedAt: true, _count: { select: { games: true } } },
  });
  if (existing?.archivedAt) throw new Error(`Season "${seasonName}" is archived`);
  if (existing && existing._count.games > 0) {
    throw new Error(`Season "${seasonName}" already has ${existing._count.games} games; nothing imported`);
  }

  const dated = rows.filter((r) => r.date).map((r) => r.date!.getTime());
  const firstDate = dated.length ? new Date(Math.min(...dated)) : null;
  const toCalendar = (value: string | boolean | undefined, option: string) => {
    if (typeof value !== 'string') return null;
    const parsed = parseCalendarDate(value);
    if (!parsed) throw new Error(`--${option} must be YYYY-MM-DD`);
    return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
  };
  // Season dates are calendar days, stored at midnight UTC like the season form does.
  const startDate =
    toCalendar(args.start, 'start') ??
    (firstDate
      ? new Date(Date.UTC(firstDate.getUTCFullYear(), firstDate.getUTCMonth(), firstDate.getUTCDate()))
      : null);
  if (!existing && !startDate) throw new Error('No dated games; pass --start');
  const endDate = toCalendar(args.end, 'end') ?? new Date(Date.UTC(startDate!.getUTCFullYear() + 1, 3, 30));

  console.log(`League:  ${league.name}`);
  console.log(
    existing
      ? `Season:  ${seasonName} (exists, ${existing.id})`
      : `Season:  ${seasonName} (new, DRAFT, unlisted, ${startDate!.toISOString().slice(0, 10)} - ${endDate.toISOString().slice(0, 10)})`,
  );
  console.log(`Teams:   ${teamNames.join(', ')}`);
  const rounds = [...new Set(rows.map((r) => r.round))].sort((a, b) => a - b);
  console.log(`Games:   ${rows.length} in rounds ${rounds.join(', ')}; ${dated.length} dated, ${rows.length - dated.length} undated\n`);
  for (const row of rows) {
    const when = row.date ? pragueFormat.format(row.date) : '—';
    console.log(`  R${row.round} #${row.number.padEnd(3)} ${when.padEnd(18)} ${row.home} – ${row.away}`);
  }

  if (!apply) {
    console.log('\nDry run, nothing written. Re-run with --apply to import.');
    return;
  }

  const { seasonId, gameIds } = await prisma.$transaction(async (tx) => {
    const season =
      existing ??
      (await tx.season.create({
        data: { name: seasonName, leagueId: league.id, startDate: startDate!, endDate },
        select: { id: true },
      }));

    await tx.seasonTeam.createMany({
      data: [...teamIds.values()].map((teamId) => ({ seasonId: season.id, teamId })),
      skipDuplicates: true,
    });

    const ids: string[] = [];
    // Undated games are listed by creation time, so each gets its own
    // millisecond in sheet order rather than the transaction's shared now().
    const base = Date.now();
    for (const [index, row] of rows.entries()) {
      const game = await tx.game.create({
        data: {
          seasonId: season.id,
          homeTeamId: teamIds.get(row.home)!,
          awayTeamId: teamIds.get(row.away)!,
          date: row.date,
          round: row.round,
          createdAt: new Date(base + index),
        },
        select: { id: true, date: true },
      });
      if (game.date) ids.push(game.id);
    }
    return { seasonId: season.id, gameIds: ids };
  });

  // Dated fixtures become calendar events for both teams, as when created in the app.
  for (const gameId of gameIds) await syncFixtureEvents(gameId);

  console.log(`\nImported ${rows.length} games into season ${seasonId}.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
