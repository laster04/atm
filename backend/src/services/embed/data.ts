import prisma from '../../config/database.js';
import { canView } from '../visibility.js';
import { computeStandings } from '../../controllers/seasonController.js';
import { COUNTS_TOWARD_TABLE, PENDING_RESULTS } from '../standings/filters.js';
import { policyFromRows } from '../scoring/resolve.js';
import { computeGroupStandings } from '../../utils/tournamentStandings.js';
import { teamAllowance } from '../plans/tournamentPlan.js';

/**
 * What the embedded widget shows (celek I): a table or a list of games, for a
 * season or a tournament, optionally around one team. Only public and
 * unlisted competitions, and only what the public page already shows: team
 * names, logos and colours, dates, venues and scores; never people.
 */

export type EmbedKind = 'season' | 'tournament';

export interface EmbedTeam {
  id: string;
  name: string;
  logo: string | null;
  color: string | null;
}

export interface EmbedRow {
  rank: number;
  team: EmbedTeam;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface EmbedTable {
  group: { id: string; name: string } | null;
  rows: EmbedRow[];
}

export interface EmbedGame {
  id: string;
  date: Date | null;
  location: string | null;
  /** Round of a season game, or the tournament phase (GROUP, FINAL…). */
  round: number | null;
  phase: string | null;
  status: string;
  home: EmbedTeam | null;
  away: EmbedTeam | null;
  /** Only once the result counts: confirmed in a season, completed in a tournament. */
  homeScore: number | null;
  awayScore: number | null;
}

export interface EmbedCompetition {
  kind: EmbedKind;
  id: string;
  name: string;
  /** League or series. */
  parentName: string;
  sport: string;
  /** May the organiser hide the "Results from ATM" footer (Turnaj Plus, Organizátor)? */
  canHideBrand: boolean;
}

type TeamRow = { id: string; name: string; logo: string | null; primaryColor: string | null };
const team = (row: TeamRow | null | undefined): EmbedTeam | null =>
  row ? { id: row.id, name: row.name, logo: row.logo, color: row.primaryColor } : null;
const teamSelect = { id: true, name: true, logo: true, primaryColor: true } as const;

/** The competition the widget is for, or null when it does not exist or is private. */
export async function embedCompetition(kind: EmbedKind, id: string): Promise<EmbedCompetition | null> {
  // As an anonymous visitor: a manager signed in elsewhere must not make a private competition embeddable.
  if (!(await canView(kind, undefined, id))) return null;
  if (kind === 'season') {
    const season = await prisma.season.findUnique({
      where: { id },
      select: { name: true, league: { select: { name: true, sportType: true } } },
    });
    if (!season) return null;
    // Leagues have no paid plan yet; Liga Plus will lift this.
    return { kind, id, name: season.name, parentName: season.league.name, sport: season.league.sportType, canHideBrand: false };
  }
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: { name: true, series: { select: { name: true, sportType: true } } },
  });
  if (!tournament) return null;
  const allowance = await teamAllowance(id);
  const canHideBrand = allowance?.plan === 'TOURNAMENT_PLUS' || allowance?.plan === 'ORGANIZER';
  return { kind, id, name: tournament.name, parentName: tournament.series.name, sport: tournament.series.sportType, canHideBrand };
}

/**
 * The season's table: one per division when it has divisions, or the whole
 * season. `group` = a division's id for just that one, or "total" for the
 * whole season even when it has divisions.
 */
export async function seasonTables(seasonId: string, group?: string): Promise<EmbedTable[]> {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: { scoring: true, league: { select: { scoring: true, sportType: true } } },
  });
  if (!season) return [];
  const [groups, seasonTeams, completed, pending] = await Promise.all([
    prisma.seasonGroup.findMany({ where: { seasonId }, orderBy: [{ position: 'asc' }, { name: 'asc' }] }),
    prisma.seasonTeam.findMany({ where: { seasonId }, include: { team: { select: teamSelect } } }),
    prisma.game.findMany({ where: { seasonId, ...COUNTS_TOWARD_TABLE } }),
    prisma.game.findMany({ where: { seasonId, ...PENDING_RESULTS } }),
  ]);
  const policy = policyFromRows(season, season.league, 'LEAGUE');

  const tableFor = (entries: typeof seasonTeams, divisionOnly: boolean): EmbedRow[] => {
    const teams = entries.map((entry) => entry.team);
    const ids = new Set(teams.map((row) => row.id));
    // A division's table counts only games between its own teams, as the public page does.
    const within = <T extends { homeTeamId: string; awayTeamId: string }>(games: T[]) =>
      divisionOnly ? games.filter((game) => ids.has(game.homeTeamId) && ids.has(game.awayTeamId)) : games;
    return computeStandings(teams, within(completed), policy, within(pending)).map((row) => ({
      rank: row.rank,
      team: team(row.team as TeamRow)!,
      played: row.played,
      wins: row.wins,
      draws: row.draws,
      losses: row.losses,
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst,
      points: row.points,
    }));
  };

  if (groups.length === 0 || group === 'total') return [{ group: null, rows: tableFor(seasonTeams, false) }];
  return groups
    .filter((row) => !group || row.id === group)
    .map((row) => ({
      group: { id: row.id, name: row.name },
      rows: tableFor(seasonTeams.filter((entry) => entry.groupId === row.id), true),
    }));
}

/** The tournament's group tables, or the one group asked for. */
export async function tournamentTables(tournamentId: string, group?: string): Promise<EmbedTable[]> {
  const groups = await prisma.tournamentGroup.findMany({
    where: { tournamentId, ...(group && group !== 'total' ? { id: group } : {}) },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
  const toRows = (rows: Awaited<ReturnType<typeof computeGroupStandings>>): EmbedRow[] =>
    rows.map((row, index) => ({
      rank: index + 1,
      team: team(row.team as TeamRow)!,
      played: row.played,
      wins: row.won,
      draws: row.drawn,
      losses: row.lost,
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst,
      points: row.points,
    }));
  if (groups.length === 0) return [{ group: null, rows: toRows(await computeGroupStandings(tournamentId, null)) }];
  return Promise.all(groups.map(async (row) => ({ group: row, rows: toRows(await computeGroupStandings(tournamentId, row.id)) })));
}

/**
 * Upcoming games, soonest first, and optionally the latest results, newest
 * first; `team` keeps only that team's games.
 */
export async function seasonGames(seasonId: string, options: { team?: string; limit: number; results: boolean }) {
  const byTeam = options.team ? { OR: [{ homeTeamId: options.team }, { awayTeamId: options.team }] } : {};
  const include = { homeTeam: { select: teamSelect }, awayTeam: { select: teamSelect } };
  const [upcoming, recent] = await Promise.all([
    prisma.game.findMany({
      where: { seasonId, ...byTeam, status: { in: ['SCHEDULED', 'IN_PROGRESS', 'POSTPONED'] } },
      include,
      orderBy: [{ date: { sort: 'asc', nulls: 'last' } }, { round: 'asc' }],
      take: options.limit,
    }),
    options.results
      ? prisma.game.findMany({
          where: { seasonId, ...byTeam, status: 'COMPLETED', confirmedAt: { not: null } },
          include,
          orderBy: [{ date: { sort: 'desc', nulls: 'last' } }, { round: 'desc' }],
          take: options.limit,
        })
      : Promise.resolve([]),
  ]);
  const toGame = (game: (typeof upcoming)[number], withScore: boolean): EmbedGame => ({
    id: game.id,
    date: game.date,
    location: game.location,
    round: game.round,
    phase: null,
    status: game.status,
    home: team(game.homeTeam),
    away: team(game.awayTeam),
    homeScore: withScore ? game.homeScore : null,
    awayScore: withScore ? game.awayScore : null,
  });
  return { upcoming: upcoming.map((game) => toGame(game, false)), recent: recent.map((game) => toGame(game, true)) };
}

export async function tournamentGames(tournamentId: string, options: { team?: string; limit: number; results: boolean }) {
  const byTeam = options.team ? { OR: [{ homeTeamId: options.team }, { awayTeamId: options.team }] } : {};
  const include = { homeTeam: { select: teamSelect }, awayTeam: { select: teamSelect } };
  const [upcoming, recent] = await Promise.all([
    prisma.tournamentGame.findMany({
      where: { tournamentId, ...byTeam, status: { in: ['SCHEDULED', 'IN_PROGRESS', 'POSTPONED'] } },
      include,
      orderBy: [{ date: { sort: 'asc', nulls: 'last' } }],
      take: options.limit,
    }),
    options.results
      ? prisma.tournamentGame.findMany({
          where: { tournamentId, ...byTeam, status: 'COMPLETED' },
          include,
          orderBy: [{ date: { sort: 'desc', nulls: 'last' } }],
          take: options.limit,
        })
      : Promise.resolve([]),
  ]);
  const toGame = (game: (typeof upcoming)[number], withScore: boolean): EmbedGame => ({
    id: game.id,
    date: game.date,
    location: game.location,
    round: null,
    phase: game.phase,
    status: game.status,
    home: team(game.homeTeam),
    away: team(game.awayTeam),
    homeScore: withScore ? game.homeScore : null,
    awayScore: withScore ? game.awayScore : null,
  });
  return { upcoming: upcoming.map((game) => toGame(game, false)), recent: recent.map((game) => toGame(game, true)) };
}

/** Teams the panel can narrow the widget to. */
export async function competitionTeams(kind: EmbedKind, id: string): Promise<EmbedTeam[]> {
  if (kind === 'season') {
    const rows = await prisma.seasonTeam.findMany({ where: { seasonId: id }, include: { team: { select: teamSelect } } });
    return rows.map((row) => team(row.team)!).sort((a, b) => a.name.localeCompare(b.name));
  }
  const rows = await prisma.tournamentTeam.findMany({ where: { tournamentId: id }, select: teamSelect, orderBy: { name: 'asc' } });
  return rows.map((row) => team(row)!);
}
