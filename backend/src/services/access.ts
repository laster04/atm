import prisma from '../config/database.js';
import { AuthUser } from '../types/index.js';

/**
 * Authorization is derived from ownership relations, never from the user's role.
 *
 * A user may manage a resource when they are an ADMIN, or when they hold the
 * manager relation that covers it:
 *   - League.managerId          -> the league, its seasons, and everything below them
 *   - Team.managerId            -> that team and its roster
 *   - TournamentSeries.managerId -> the series and everything below it
 *
 * Role only distinguishes ADMIN from a regular USER; it grants no scoped access.
 */

export const isAdmin = (user: AuthUser): boolean => user.role === 'ADMIN';

export const canManageLeague = async (user: AuthUser, leagueId: string): Promise<boolean> => {
  if (isAdmin(user)) return true;
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { managerId: true },
  });
  return league?.managerId === user.id;
};

export const canManageSeason = async (user: AuthUser, seasonId: string): Promise<boolean> => {
  if (isAdmin(user)) return true;
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: { league: { select: { managerId: true } } },
  });
  return season?.league.managerId === user.id;
};

/**
 * A team is manageable by its own manager and by the manager of any league whose
 * season the team plays in. Both paths are checked; holding either one is enough.
 */
export const canManageTeam = async (user: AuthUser, teamId: string): Promise<boolean> => {
  if (isAdmin(user)) return true;
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      managerId: true,
      seasonTeams: { select: { season: { select: { league: { select: { managerId: true } } } } } },
    },
  });
  if (!team) return false;
  return (
    team.managerId === user.id ||
    team.seasonTeams.some(st => st.season.league.managerId === user.id)
  );
};

/**
 * Administering a team - deleting it, or handing it to a manager - stays with the
 * league side. A team's own manager runs the team but must not be able to remove
 * it from the competition or reassign it to someone else.
 */
export const canAdministerTeam = async (user: AuthUser, teamId: string): Promise<boolean> => {
  if (isAdmin(user)) return true;
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      seasonTeams: { select: { season: { select: { league: { select: { managerId: true } } } } } },
    },
  });
  if (!team) return false;
  return team.seasonTeams.some(st => st.season.league.managerId === user.id);
};

export const canManagePlayer = async (user: AuthUser, playerId: string): Promise<boolean> => {
  if (isAdmin(user)) return true;
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { teamId: true },
  });
  if (!player) return false;
  return canManageTeam(user, player.teamId);
};

export const canManageGame = async (user: AuthUser, gameId: string): Promise<boolean> => {
  if (isAdmin(user)) return true;
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { seasonId: true },
  });
  if (!game) return false;
  return canManageSeason(user, game.seasonId);
};

export const canManageMatchEvent = async (user: AuthUser, eventId: string): Promise<boolean> => {
  if (isAdmin(user)) return true;
  const event = await prisma.matchEvent.findUnique({
    where: { id: eventId },
    select: { game: { select: { seasonId: true } } },
  });
  if (!event) return false;
  return canManageSeason(user, event.game.seasonId);
};

export const canManageSeries = async (user: AuthUser, seriesId: string): Promise<boolean> => {
  if (isAdmin(user)) return true;
  const series = await prisma.tournamentSeries.findUnique({
    where: { id: seriesId },
    select: { managerId: true },
  });
  return series?.managerId === user.id;
};

export const canManageTournament = async (user: AuthUser, tournamentId: string): Promise<boolean> => {
  if (isAdmin(user)) return true;
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { series: { select: { managerId: true } } },
  });
  return tournament?.series.managerId === user.id;
};

export const canManageTournamentTeam = async (user: AuthUser, teamId: string): Promise<boolean> => {
  if (isAdmin(user)) return true;
  const team = await prisma.tournamentTeam.findUnique({
    where: { id: teamId },
    select: { tournament: { select: { series: { select: { managerId: true } } } } },
  });
  return team?.tournament.series.managerId === user.id;
};

export const canManageTournamentPlayer = async (user: AuthUser, playerId: string): Promise<boolean> => {
  if (isAdmin(user)) return true;
  const player = await prisma.tournamentPlayer.findUnique({
    where: { id: playerId },
    select: { team: { select: { tournament: { select: { series: { select: { managerId: true } } } } } } },
  });
  return player?.team.tournament.series.managerId === user.id;
};

export const canManageTournamentGroup = async (user: AuthUser, groupId: string): Promise<boolean> => {
  if (isAdmin(user)) return true;
  const group = await prisma.tournamentGroup.findUnique({
    where: { id: groupId },
    select: { tournament: { select: { series: { select: { managerId: true } } } } },
  });
  return group?.tournament.series.managerId === user.id;
};

export const canManageTournamentGame = async (user: AuthUser, gameId: string): Promise<boolean> => {
  if (isAdmin(user)) return true;
  const game = await prisma.tournamentGame.findUnique({
    where: { id: gameId },
    select: { tournament: { select: { series: { select: { managerId: true } } } } },
  });
  return game?.tournament.series.managerId === user.id;
};

export interface ManagedCounts {
  leagues: number;
  teams: number;
  series: number;
}

/**
 * How many of each resource a user manages. The client uses this instead of the
 * role to decide which dashboards to offer; the server still authorizes every
 * request on its own.
 */
export const getManagedCounts = async (userId: string): Promise<ManagedCounts> => {
  const [leagues, teams, series] = await Promise.all([
    prisma.league.count({ where: { managerId: userId } }),
    prisma.team.count({ where: { managerId: userId } }),
    prisma.tournamentSeries.count({ where: { managerId: userId } }),
  ]);
  return { leagues, teams, series };
};
