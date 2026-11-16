import prisma from '../../config/database.js';
import { teamAllowance } from '../plans/tournamentPlan.js';
import { advanceTarget } from '../playoff/bracket.js';
import { computeGroupStandings } from '../../utils/tournamentStandings.js';
import { publicExtras } from './plus.js';

const teamSelect = { id: true, name: true, logo: true, primaryColor: true, country: true } as const;

/**
 * Everything a tournament game's public page shows: the game, its players'
 * lines, the group table or where the winner goes on, the two teams' other
 * meetings, and the tournament's partners and branding. A tournament result
 * counts as soon as it is saved; there is no confirmation step.
 */
export async function tournamentGameDetail(id: string) {
  const game = await prisma.tournamentGame.findUnique({
    where: { id },
    include: {
      tournament: { select: { id: true, name: true, series: { select: { id: true, name: true, sportType: true, logo: true } } } },
      group: { select: { id: true, name: true } },
      homeTeam: { select: teamSelect },
      awayTeam: { select: teamSelect },
      statistics: { include: { player: { select: { id: true, name: true, number: true, teamId: true } } } },
    },
  });
  if (!game) return null;
  const tournamentId = game.tournamentId;

  const allowance = await teamAllowance(tournamentId);
  const [extras, table, next, meetings] = await Promise.all([
    publicExtras(tournamentId, allowance?.plan ?? null),
    game.phase === 'GROUP' && game.groupId ? computeGroupStandings(tournamentId, game.groupId) : Promise.resolve(null),
    nextGame(game),
    game.homeTeamId && game.awayTeamId
      ? prisma.tournamentGame.findMany({
          where: {
            tournamentId,
            id: { not: id },
            OR: [
              { homeTeamId: game.homeTeamId, awayTeamId: game.awayTeamId },
              { homeTeamId: game.awayTeamId, awayTeamId: game.homeTeamId },
            ],
          },
          select: { id: true, phase: true, date: true, status: true, homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true },
          orderBy: [{ date: 'asc' }],
        })
      : Promise.resolve([]),
  ]);

  return {
    game: {
      id: game.id,
      phase: game.phase,
      group: game.group,
      date: game.date,
      location: game.location,
      status: game.status,
      homeScore: game.homeScore,
      awayScore: game.awayScore,
      periodScores: game.periodScores,
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
    },
    tournament: { id: game.tournament.id, name: game.tournament.name },
    series: game.tournament.series,
    // Only players with something on their line, as on league games.
    players: game.statistics
      .filter((line) => (line.goals ?? 0) > 0 || (line.assists ?? 0) > 0)
      .map((line) => ({
        teamId: line.player.teamId,
        player: { id: line.player.id, name: line.player.name, number: line.player.number },
        goals: line.goals ?? 0,
        assists: line.assists ?? 0,
      })),
    table: table ? { group: game.group, rows: table } : null,
    next,
    meetings,
    ...extras,
  };
}

/** A play-off game's next round: the game its winner moves to, and who waits there. */
async function nextGame(game: { tournamentId: string; phase: string; bracketSlot: number | null }) {
  if (game.phase === 'GROUP' || game.bracketSlot == null) return null;
  const { winner } = advanceTarget(game.phase as Parameters<typeof advanceTarget>[0], game.bracketSlot);
  if (!winner) return null;
  const target = await prisma.tournamentGame.findFirst({
    where: { tournamentId: game.tournamentId, phase: winner.round, bracketSlot: winner.slot },
    select: {
      id: true, phase: true, date: true,
      homeTeam: { select: teamSelect },
      awayTeam: { select: teamSelect },
    },
  });
  if (!target) return { phase: winner.round, gameId: null, date: null, opponent: null };
  // The other side of the next game is the opponent waiting for this game's winner.
  const opponent = winner.side === 'home' ? target.awayTeam : target.homeTeam;
  return { phase: target.phase, gameId: target.id, date: target.date, opponent };
}

export type TournamentGameDetail = NonNullable<Awaited<ReturnType<typeof tournamentGameDetail>>>;
