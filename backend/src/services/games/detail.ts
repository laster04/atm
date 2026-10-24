import prisma from '../../config/database.js';
import { computeStandings } from '../../controllers/seasonController.js';
import { policyFromRows } from '../scoring/resolve.js';
import { profileFor, STAT_KEYS } from '../sports/profile.js';
import { COUNTS_TOWARD_TABLE, PENDING_RESULTS } from '../standings/filters.js';

const teamSelect = { id: true, name: true, logo: true, primaryColor: true } as const;
const playerSelect = { id: true, name: true, number: true } as const;

/**
 * Everything the public match page shows, in one answer: the game, its match
 * report, the players' lines, the table it belongs to and the other meetings
 * of the two teams this season.
 *
 * Only games of seasons that still have them: archiving a season deletes its
 * games and keeps the final table alone, so an archived season's games are
 * simply not found. Visibility is checked by the route (requireVisible).
 */
export async function gameDetail(id: string) {
  const game = await prisma.game.findUnique({
    where: { id },
    include: {
      season: {
        select: {
          id: true, name: true, scoring: true,
          league: { select: { id: true, name: true, sportType: true, scoring: true } },
        },
      },
      homeTeam: { select: teamSelect },
      awayTeam: { select: teamSelect },
    },
  });
  if (!game) return null;

  const profile = profileFor(game.season.league.sportType);
  const [events, lines, head, groupOf] = await Promise.all([
    profile.events.length > 0
      ? prisma.matchEvent.findMany({
          where: { gameId: id },
          include: {
            team: { select: { id: true } },
            player: { select: playerSelect },
            assistPlayer: { select: playerSelect },
            secondaryAssistPlayer: { select: playerSelect },
          },
          orderBy: [{ period: 'asc' }, { minute: 'asc' }, { second: 'asc' }, { createdAt: 'asc' }],
        })
      : Promise.resolve([]),
    prisma.playerGameStatistic.findMany({
      where: { gameId: id },
      include: { player: { select: { ...playerSelect, teamId: true } } },
    }),
    prisma.game.findMany({
      where: {
        seasonId: game.seasonId,
        id: { not: id },
        OR: [
          { homeTeamId: game.homeTeamId, awayTeamId: game.awayTeamId },
          { homeTeamId: game.awayTeamId, awayTeamId: game.homeTeamId },
        ],
      },
      select: {
        id: true, date: true, status: true, homeTeamId: true, awayTeamId: true,
        homeScore: true, awayScore: true, periodScores: true, confirmedAt: true,
      },
      orderBy: [{ date: 'asc' }],
    }),
    prisma.seasonTeam.findMany({
      where: { seasonId: game.seasonId, teamId: { in: [game.homeTeamId, game.awayTeamId] } },
      select: { teamId: true, group: { select: { id: true, name: true } } },
    }),
  ]);

  // Only players with something on their line: a line-up alone stays the team's.
  const players = lines
    .filter((line) => STAT_KEYS.some((key) => (line[key] ?? 0) > 0))
    .map((line) => ({
      teamId: line.player.teamId,
      player: { id: line.player.id, name: line.player.name, number: line.player.number },
      ...Object.fromEntries(STAT_KEYS.map((key) => [key, line[key]])),
    }));

  // The table the game counts in: the division both teams play in, else the season.
  const groups = groupOf.map((entry) => entry.group?.id ?? null);
  const group = groups.length === 2 && groups[0] && groups[0] === groups[1] ? groupOf[0].group : null;
  const [seasonTeams, completed, pending] = await Promise.all([
    prisma.seasonTeam.findMany({
      where: { seasonId: game.seasonId, ...(group ? { groupId: group.id } : {}) },
      include: { team: { select: teamSelect } },
    }),
    prisma.game.findMany({ where: { seasonId: game.seasonId, ...COUNTS_TOWARD_TABLE } }),
    prisma.game.findMany({ where: { seasonId: game.seasonId, ...PENDING_RESULTS } }),
  ]);
  const ids = new Set(seasonTeams.map((entry) => entry.teamId));
  const within = <T extends { homeTeamId: string; awayTeamId: string }>(rows: T[]) =>
    group ? rows.filter((row) => ids.has(row.homeTeamId) && ids.has(row.awayTeamId)) : rows;
  const policy = policyFromRows(game.season, game.season.league, 'LEAGUE');
  const table = computeStandings(seasonTeams.map((entry) => entry.team), within(completed), policy, within(pending));

  return {
    game: {
      id: game.id,
      date: game.date,
      location: game.location,
      round: game.round,
      status: game.status,
      homeScore: game.homeScore,
      awayScore: game.awayScore,
      periodScores: game.periodScores,
      confirmed: game.confirmedAt !== null,
      playoff: game.playoffSeriesId !== null,
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
    },
    season: { id: game.season.id, name: game.season.name },
    league: { id: game.season.league.id, name: game.season.league.name, sportType: game.season.league.sportType },
    events: events.map((event) => ({
      id: event.id,
      type: event.type,
      period: event.period,
      minute: event.minute,
      second: event.second,
      teamId: event.team.id,
      player: event.player,
      assistPlayer: event.assistPlayer,
      secondaryAssistPlayer: event.secondaryAssistPlayer,
      penaltyMinutes: event.penaltyMinutes,
      penaltyType: event.penaltyType,
      cardColor: event.cardColor,
    })),
    players,
    table: { group, rows: table },
    headToHead: head.map(({ confirmedAt, ...meeting }) => ({ ...meeting, confirmed: confirmedAt !== null })),
  };
}

export type GameDetail = NonNullable<Awaited<ReturnType<typeof gameDetail>>>;
