import { Prisma, Visibility } from '@prisma/client';
import prisma from '../config/database.js';
import { AuthUser } from '../types/index.js';
import { isAdmin } from './access.js';

/**
 * Who may see a league, a season or a tournament series, and everything under
 * them.
 *
 *   PUBLIC    anyone, and it appears in lists
 *   UNLISTED  anyone who has the link; absent from every list
 *   PRIVATE   the people who manage it, and nobody else
 *
 * Visibility is inherited and the strictest level wins. A season is only as
 * visible as its league, so hiding a league hides its seasons, their games,
 * tables, statistics and archives, whatever the seasons themselves say. A team
 * is not hidden - it exists across seasons - but what it did in a hidden season
 * is.
 *
 * Every public read goes through this file, the way every table goes through
 * standings/filters. A flag checked in most places but not all is worse than no
 * flag: it tells an organiser their draw is hidden when it is not. The
 * visibility test walks every public route; add a route there when you add one
 * here.
 *
 * "Manages" means what it does in services/access: an admin, the league's
 * manager for a league and its seasons, the series manager for a series and its
 * tournaments. A team manager does not manage the season their team plays in.
 */

export const VISIBILITY_LEVELS: Visibility[] = ['PUBLIC', 'UNLISTED', 'PRIVATE'];

export const isVisibility = (value: unknown): value is Visibility =>
  typeof value === 'string' && (VISIBILITY_LEVELS as string[]).includes(value);

/** Reachable by a link without managing it. */
const BY_LINK: Prisma.EnumVisibilityFilter = { in: ['PUBLIC', 'UNLISTED'] };

type Viewer = AuthUser | undefined;

const seesEverything = (user: Viewer): boolean => !!user && isAdmin(user);

/** Either the open condition holds, or the viewer manages the thing. */
const orManaged = <T>(user: Viewer, open: T, managed: (userId: string) => T): T | { OR: T[] } =>
  user ? { OR: [open, managed(user.id)] } : open;

// ---------------------------------------------------------------------------
// Leagues
// ---------------------------------------------------------------------------

export const listedLeagueWhere = (user: Viewer): Prisma.LeagueWhereInput =>
  seesEverything(user)
    ? {}
    : orManaged<Prisma.LeagueWhereInput>(user, { visibility: 'PUBLIC' }, id => ({ managerId: id }));

export const viewableLeagueWhere = (user: Viewer): Prisma.LeagueWhereInput =>
  seesEverything(user)
    ? {}
    : orManaged<Prisma.LeagueWhereInput>(user, { visibility: BY_LINK }, id => ({ managerId: id }));

// ---------------------------------------------------------------------------
// Seasons - as visible as the stricter of the season and its league
// ---------------------------------------------------------------------------

/** Seasons that may appear in a list anywhere on the site. */
export const listedSeasonWhere = (user: Viewer): Prisma.SeasonWhereInput =>
  seesEverything(user)
    ? {}
    : orManaged<Prisma.SeasonWhereInput>(
        user,
        { visibility: 'PUBLIC', league: { visibility: 'PUBLIC' } },
        id => ({ league: { managerId: id } })
      );

/**
 * Seasons listed on a page the viewer has already reached - the league's own
 * page. The league has been checked on the way in, so only the season's own
 * level decides: a public season of an unlisted league is shown to whoever
 * has the league's link.
 */
export const listedSeasonInLeagueWhere = (user: Viewer): Prisma.SeasonWhereInput =>
  seesEverything(user)
    ? {}
    : orManaged<Prisma.SeasonWhereInput>(user, { visibility: 'PUBLIC' }, id => ({ league: { managerId: id } }));

export const viewableSeasonWhere = (user: Viewer): Prisma.SeasonWhereInput =>
  seesEverything(user)
    ? {}
    : orManaged<Prisma.SeasonWhereInput>(
        user,
        { visibility: BY_LINK, league: { visibility: BY_LINK } },
        id => ({ league: { managerId: id } })
      );

// ---------------------------------------------------------------------------
// What lives inside a season
// ---------------------------------------------------------------------------

export const listedGameWhere = (user: Viewer): Prisma.GameWhereInput =>
  seesEverything(user) ? {} : { season: listedSeasonWhere(user) };

export const viewableGameWhere = (user: Viewer): Prisma.GameWhereInput =>
  seesEverything(user) ? {} : { season: viewableSeasonWhere(user) };

/**
 * Teams that may appear in a directory or a search. A team shows when it plays,
 * or played, in a listed season - or when it has never been in a season at all,
 * which leaves nothing to hide. A team seen only in hidden seasons stays out:
 * listing it would publish the draw it is part of.
 *
 * The team's own manager always finds their team.
 */
export const listedTeamWhere = (user: Viewer): Prisma.TeamWhereInput => {
  if (seesEverything(user)) return {};
  const season = listedSeasonWhere(user);
  return {
    OR: [
      { seasonTeams: { some: { season } } },
      { archivedStandings: { some: { season } } },
      { seasonTeams: { none: {} }, archivedStandings: { none: {} } },
      ...(user ? [{ managerId: user.id }] : []),
    ],
  };
};

export const listedPlayerWhere = (user: Viewer): Prisma.PlayerWhereInput =>
  seesEverything(user) ? {} : { team: listedTeamWhere(user) };

// ---------------------------------------------------------------------------
// Tournaments - the series carries the level, every edition inherits it
// ---------------------------------------------------------------------------

export const listedSeriesWhere = (user: Viewer): Prisma.TournamentSeriesWhereInput =>
  seesEverything(user)
    ? {}
    : orManaged<Prisma.TournamentSeriesWhereInput>(user, { visibility: 'PUBLIC' }, id => ({ managerId: id }));

export const viewableSeriesWhere = (user: Viewer): Prisma.TournamentSeriesWhereInput =>
  seesEverything(user)
    ? {}
    : orManaged<Prisma.TournamentSeriesWhereInput>(user, { visibility: BY_LINK }, id => ({ managerId: id }));

export const viewableTournamentWhere = (user: Viewer): Prisma.TournamentWhereInput =>
  seesEverything(user) ? {} : { series: viewableSeriesWhere(user) };

// ---------------------------------------------------------------------------
// Single-record checks, for the route guard
// ---------------------------------------------------------------------------

export type VisibleKind =
  | 'league'
  | 'season'
  | 'game'
  | 'gameStatistic'
  | 'series'
  | 'tournament'
  | 'tournamentTeam'
  | 'tournamentGroup'
  | 'tournamentGame';

/**
 * Whether this viewer may open the record at all. Unknown ids answer false, so
 * a hidden record and a missing one are indistinguishable from outside.
 */
export const canView = async (kind: VisibleKind, user: Viewer, id: string): Promise<boolean> => {
  switch (kind) {
    case 'league':
      return (await prisma.league.count({ where: { AND: [{ id }, viewableLeagueWhere(user)] } })) > 0;
    case 'season':
      return (await prisma.season.count({ where: { AND: [{ id }, viewableSeasonWhere(user)] } })) > 0;
    case 'game':
      return (await prisma.game.count({ where: { AND: [{ id }, viewableGameWhere(user)] } })) > 0;
    case 'gameStatistic':
      return (await prisma.hockeyGameStatistic.count({ where: { id, game: viewableGameWhere(user) } })) > 0;
    case 'series':
      return (await prisma.tournamentSeries.count({ where: { AND: [{ id }, viewableSeriesWhere(user)] } })) > 0;
    case 'tournament':
      return (await prisma.tournament.count({ where: { AND: [{ id }, viewableTournamentWhere(user)] } })) > 0;
    case 'tournamentTeam':
      return (await prisma.tournamentTeam.count({ where: { id, tournament: viewableTournamentWhere(user) } })) > 0;
    case 'tournamentGroup':
      return (await prisma.tournamentGroup.count({ where: { id, tournament: viewableTournamentWhere(user) } })) > 0;
    case 'tournamentGame':
      return (await prisma.tournamentGame.count({ where: { id, tournament: viewableTournamentWhere(user) } })) > 0;
  }
};
