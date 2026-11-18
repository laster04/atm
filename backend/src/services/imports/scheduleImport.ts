import type { Prisma } from '@prisma/client';
import prisma, { type DbClient } from '../../config/database.js';
import { zonedDateTime } from '../../utils/time.js';
import type { Cell } from './spreadsheet.js';

/**
 * Importing a season's fixture list from a spreadsheet: the "Program" export
 * of the Czech volleyball federation's competition system (Datum, Čas, Kolo,
 * Skupina, Domácí, Hosté, Hala, Poznámka), or any sheet with the same columns
 * in Czech, Slovak or English.
 *
 * Teams are matched to the season's teams by name, ignoring case, accents and
 * spacing; a new name becomes a new team. Fixtures are matched by round and
 * both teams, so importing an updated program again moves dates and venues
 * instead of adding games twice. A played game is never changed.
 */

export type ImportProblem =
  | 'NO_TEAMS'      // a row without the home or the away team
  | 'SAME_TEAM'     // the same name on both sides
  | 'BAD_DATE'      // a date or time that cannot be read
  | 'DUPLICATE'     // the same fixture twice in the file
  | 'PLAYED';       // the game exists and is already played; left as it is

export interface ParsedFixture {
  line: number;
  round: number | null;
  date: Date | null;
  location: string | null;
  home: string;
  away: string;
  group: string | null;
  problem: ImportProblem | null;
}

export class ScheduleImportError extends Error {
  constructor(public readonly code: 'MISSING_COLUMNS', public readonly missing: string[]) {
    super(`The file lacks the columns: ${missing.join(', ')}`);
  }
}

/** Lower case, no accents, single spaces: how names and headers are compared. */
export const normalise = (value: string) =>
  value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

const HEADERS: Record<'date' | 'time' | 'round' | 'home' | 'away' | 'venue' | 'group', string[]> = {
  date: ['datum', 'date', 'den', 'datum a cas'],
  time: ['cas', 'time', 'zacatek', 'start'],
  round: ['kolo', 'round', 'cislo kola'],
  home: ['domaci', 'home', 'domaci tym', 'domaci druzstvo', 'home team'],
  away: ['hoste', 'away', 'hostujici', 'hoste tym', 'hostujici druzstvo', 'away team', 'hostia'],
  venue: ['hala', 'misto', 'venue', 'location', 'sportoviste', 'miesto'],
  group: ['skupina', 'group', 'soutez', 'division'],
};

const text = (cell: Cell | undefined): string => (cell === null || cell === undefined ? '' : String(cell).trim());

/** Days since 1899-12-30 (Excel's day 0) as calendar parts, the fraction as the time of day. */
function fromSerial(serial: number) {
  const minutes = Math.round(serial * 24 * 60);
  const day = new Date(Date.UTC(1899, 11, 30) + Math.floor(minutes / 1440) * 86_400_000);
  const rest = minutes % 1440;
  return { year: day.getUTCFullYear(), month: day.getUTCMonth() + 1, day: day.getUTCDate(), hour: Math.floor(rest / 60), minute: rest % 60 };
}

/** 18.11.2026, 18. 11. 2026, 2026-11-18, optionally followed by a time. */
function parseDateText(value: string) {
  const czech = /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})(?:\s+(\d{1,2})[:.](\d{2}))?/.exec(value);
  if (czech) return { year: +czech[3], month: +czech[2], day: +czech[1], hour: czech[4] ? +czech[4] : null, minute: czech[5] ? +czech[5] : null };
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{1,2}):(\d{2}))?/.exec(value);
  if (iso) return { year: +iso[1], month: +iso[2], day: +iso[3], hour: iso[4] ? +iso[4] : null, minute: iso[5] ? +iso[5] : null };
  return null;
}

function parseTime(cell: Cell | undefined): { hour: number; minute: number } | null | 'bad' {
  if (cell === null || cell === undefined || text(cell) === '') return null;
  if (typeof cell === 'number') {
    const { hour, minute } = fromSerial(cell % 1);
    return { hour, minute };
  }
  const match = /^(\d{1,2})[:.](\d{2})/.exec(text(cell));
  return match && +match[1] < 24 && +match[2] < 60 ? { hour: +match[1], minute: +match[2] } : 'bad';
}

/** The kick-off as an instant: the sheet's times are Prague local times. */
function parseWhen(dateCell: Cell | undefined, timeCell: Cell | undefined): Date | null | 'bad' {
  if (dateCell === null || dateCell === undefined || text(dateCell) === '') return null;
  let parts: { year: number; month: number; day: number; hour: number | null; minute: number | null } | null;
  if (typeof dateCell === 'number') {
    const serial = fromSerial(dateCell);
    parts = { ...serial, hour: dateCell % 1 ? serial.hour : null, minute: dateCell % 1 ? serial.minute : null };
  } else {
    parts = parseDateText(text(dateCell));
  }
  if (!parts || parts.month < 1 || parts.month > 12 || parts.day < 1 || parts.day > 31 || parts.year < 2000 || parts.year > 2100) return 'bad';
  const time = parseTime(timeCell);
  if (time === 'bad') return 'bad';
  const hour = time?.hour ?? parts.hour ?? 0;
  const minute = time?.minute ?? parts.minute ?? 0;
  return zonedDateTime(parts.year, parts.month, parts.day, hour, minute);
}

/** The fixtures in a sheet: finds the header row, then reads every row under it. */
export function parseFixtures(rows: Cell[][]): ParsedFixture[] {
  const headerIndex = rows.findIndex((row) => {
    const names = row.map((cell) => normalise(text(cell)));
    return HEADERS.home.some((alias) => names.includes(alias)) && HEADERS.away.some((alias) => names.includes(alias));
  });
  if (headerIndex < 0) throw new ScheduleImportError('MISSING_COLUMNS', ['home', 'away']);
  const header = rows[headerIndex].map((cell) => normalise(text(cell)));
  const column = (key: keyof typeof HEADERS) => header.findIndex((name) => HEADERS[key].includes(name));
  const columns = {
    date: column('date'), time: column('time'), round: column('round'),
    home: column('home'), away: column('away'), venue: column('venue'), group: column('group'),
  };

  const seen = new Set<string>();
  return rows.slice(headerIndex + 1).map((row, index) => {
    const line = headerIndex + index + 2;
    const home = text(row[columns.home]);
    const away = text(row[columns.away]);
    const roundText = columns.round >= 0 ? text(row[columns.round]) : '';
    const round = /^\d{1,3}$/.test(roundText) ? Number(roundText) : null;
    const when = columns.date >= 0 ? parseWhen(row[columns.date], columns.time >= 0 ? row[columns.time] : undefined) : null;
    const fixture: ParsedFixture = {
      line,
      round,
      date: when instanceof Date ? when : null,
      location: columns.venue >= 0 ? text(row[columns.venue]).slice(0, 200) || null : null,
      home: home.slice(0, 100),
      away: away.slice(0, 100),
      group: columns.group >= 0 ? text(row[columns.group]) || null : null,
      problem: null,
    };
    if (!home || !away) fixture.problem = 'NO_TEAMS';
    else if (normalise(home) === normalise(away)) fixture.problem = 'SAME_TEAM';
    else if (when === 'bad') fixture.problem = 'BAD_DATE';
    else {
      const key = `${round ?? ''}|${normalise(home)}|${normalise(away)}`;
      if (seen.has(key)) fixture.problem = 'DUPLICATE';
      seen.add(key);
    }
    return fixture;
  });
}

export type FixtureAction = 'CREATE' | 'UPDATE' | 'UNCHANGED' | 'SKIP';

export interface ImportPlan {
  teams: { name: string; existing: boolean; games: number }[];
  fixtures: (Omit<ParsedFixture, 'date'> & {
    date: string | null;
    action: FixtureAction;
    /** For an update: what moves. */
    changes: ('date' | 'location')[];
    gameId: string | null;
  })[];
  counts: { create: number; update: number; unchanged: number; skip: number; newTeams: number };
}

const sameInstant = (a: Date | null, b: Date | null) => (a?.getTime() ?? null) === (b?.getTime() ?? null);

/** What importing these fixtures into the season would do, without doing it. */
export async function planImport(seasonId: string, parsed: ParsedFixture[], tx: DbClient = prisma): Promise<ImportPlan> {
  const [seasonTeams, games] = await Promise.all([
    tx.seasonTeam.findMany({ where: { seasonId }, select: { team: { select: { id: true, name: true } } } }),
    tx.game.findMany({ where: { seasonId }, select: { id: true, round: true, homeTeamId: true, awayTeamId: true, date: true, location: true, status: true } }),
  ]);
  const teamByName = new Map(seasonTeams.map(({ team }) => [normalise(team.name), team]));

  const teams = new Map<string, { name: string; existing: boolean; games: number }>();
  const noteTeam = (name: string) => {
    const key = normalise(name);
    const entry = teams.get(key) ?? { name: teamByName.get(key)?.name ?? name, existing: teamByName.has(key), games: 0 };
    entry.games += 1;
    teams.set(key, entry);
  };

  const fixtures = parsed.map((fixture) => {
    const base = { ...fixture, date: fixture.date?.toISOString() ?? null, changes: [] as ('date' | 'location')[], gameId: null as string | null };
    if (fixture.problem) return { ...base, action: 'SKIP' as const };
    noteTeam(fixture.home);
    noteTeam(fixture.away);
    const home = teamByName.get(normalise(fixture.home));
    const away = teamByName.get(normalise(fixture.away));
    const existing = home && away
      ? games.find((game) => game.homeTeamId === home.id && game.awayTeamId === away.id && (fixture.round === null || game.round === fixture.round))
      : undefined;
    if (!existing) return { ...base, action: 'CREATE' as const };
    const changes: ('date' | 'location')[] = [];
    if (fixture.date && !sameInstant(existing.date, fixture.date)) changes.push('date');
    if (fixture.location && fixture.location !== existing.location) changes.push('location');
    if (changes.length && existing.status === 'COMPLETED') {
      return { ...base, gameId: existing.id, action: 'SKIP' as const, problem: 'PLAYED' as const };
    }
    return { ...base, gameId: existing.id, changes, action: changes.length ? 'UPDATE' as const : 'UNCHANGED' as const };
  });

  const count = (action: FixtureAction) => fixtures.filter((fixture) => fixture.action === action).length;
  const teamList = [...teams.values()].sort((a, b) => a.name.localeCompare(b.name, 'cs'));
  return {
    teams: teamList,
    fixtures,
    counts: {
      create: count('CREATE'),
      update: count('UPDATE'),
      unchanged: count('UNCHANGED'),
      skip: count('SKIP'),
      newTeams: teamList.filter((team) => !team.existing).length,
    },
  };
}

/** Carries out a plan: new teams join the season, new games are scheduled, moved ones move. */
export async function applyImport(tx: Prisma.TransactionClient, seasonId: string, plan: ImportPlan): Promise<void> {
  const seasonTeams = await tx.seasonTeam.findMany({ where: { seasonId }, select: { team: { select: { id: true, name: true } } } });
  const teamId = new Map(seasonTeams.map(({ team }) => [normalise(team.name), team.id]));
  for (const team of plan.teams) {
    if (teamId.has(normalise(team.name))) continue;
    const created = await tx.team.create({ data: { name: team.name } });
    await tx.seasonTeam.create({ data: { seasonId, teamId: created.id } });
    teamId.set(normalise(team.name), created.id);
  }
  for (const fixture of plan.fixtures) {
    const date = fixture.date ? new Date(fixture.date) : null;
    if (fixture.action === 'CREATE') {
      await tx.game.create({
        data: {
          seasonId,
          homeTeamId: teamId.get(normalise(fixture.home))!,
          awayTeamId: teamId.get(normalise(fixture.away))!,
          round: fixture.round,
          date,
          location: fixture.location,
        },
      });
    } else if (fixture.action === 'UPDATE' && fixture.gameId) {
      await tx.game.update({
        where: { id: fixture.gameId },
        data: {
          ...(fixture.changes.includes('date') && { date }),
          ...(fixture.changes.includes('location') && { location: fixture.location }),
        },
      });
    }
  }
}
