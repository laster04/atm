import prisma from '../../config/database.js';
import { computeTable } from '../standings/compute.js';
import { policyFromRows } from '../scoring/resolve.js';
import { COUNTS_TOWARD_TABLE } from '../standings/filters.js';

export interface RoundResult {
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  playedOn: Date | null;
  /**
   * False while the result is still open to correction. It is listed either
   * way - it was played - but it has not moved the table below it yet, and the
   * mail says so rather than leaving a reader to wonder.
   */
  confirmed: boolean;
}

export interface SummaryRow {
  rank: number;
  team: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface SummaryScorer {
  name: string;
  team: string;
  goals: number;
  assists: number;
  points: number;
}

export interface RoundSummary {
  seasonId: string;
  seasonName: string;
  leagueName: string;
  round: number;
  results: RoundResult[];
  standings: SummaryRow[];
  topScorers: SummaryScorer[];
}

export interface Recipient {
  id: string;
  name: string;
  email: string;
}

const TOP_SCORER_LIMIT = 5;

/**
 * Everything a round summary says: what was played, where that leaves the table,
 * and who is leading the scoring.
 *
 * The table is the season to date rather than the round alone - a round in
 * isolation tells a reader nothing about where their team stands. Returns null
 * when the round has no finished games, so nothing is sent about a round that
 * has not happened.
 */
export const buildRoundSummary = async (
  seasonId: string,
  round: number
): Promise<RoundSummary | null> => {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: {
      id: true,
      name: true,
      scoring: true,
      league: { select: { name: true, scoring: true, sportType: true } },
    },
  });
  if (!season) return null;

  const roundGames = await prisma.game.findMany({
    where: { seasonId, round, status: 'COMPLETED' },
    select: {
      date: true,
      homeScore: true,
      awayScore: true,
      confirmedAt: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  });
  if (roundGames.length === 0) return null;

  const seasonTeams = await prisma.seasonTeam.findMany({
    where: { seasonId },
    select: { team: { select: { id: true, name: true } } },
  });
  // The table counts confirmed results only, exactly as the season's own table
  // does; a summary that disagreed with the site would be worse than none.
  const allCompleted = await prisma.game.findMany({
    where: { seasonId, ...COUNTS_TOWARD_TABLE },
    select: { homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true },
  });

  const table = computeTable(
    seasonTeams.map(entry => entry.team),
    allCompleted,
    policyFromRows(season, season.league, 'LEAGUE')
  );

  // Scoring is read from the aggregate rows, which are kept in step with the
  // event log, so this counts the same whether a game was reported either way.
  const stats = await prisma.hockeyGameStatistic.groupBy({
    by: ['playerId'],
    where: { game: { seasonId, ...COUNTS_TOWARD_TABLE } },
    _sum: { goals: true, assists: true },
  });
  const players = await prisma.player.findMany({
    where: { id: { in: stats.map(entry => entry.playerId) } },
    select: { id: true, name: true, team: { select: { name: true } } },
  });
  const playerById = new Map(players.map(player => [player.id, player]));

  const topScorers = stats
    .map(entry => {
      const player = playerById.get(entry.playerId);
      const goals = entry._sum.goals ?? 0;
      const assists = entry._sum.assists ?? 0;
      return {
        name: player?.name ?? '',
        team: player?.team.name ?? '',
        goals,
        assists,
        points: goals + assists,
      };
    })
    .filter(scorer => scorer.name && scorer.points > 0)
    .sort((a, b) => b.points - a.points || b.goals - a.goals)
    .slice(0, TOP_SCORER_LIMIT);

  return {
    seasonId: season.id,
    seasonName: season.name,
    leagueName: season.league.name,
    round,
    results: roundGames.map(game => ({
      homeTeam: game.homeTeam.name,
      awayTeam: game.awayTeam.name,
      homeScore: game.homeScore,
      awayScore: game.awayScore,
      playedOn: game.date,
      confirmed: game.confirmedAt !== null,
    })),
    standings: table.map((row, index) => ({
      rank: index + 1,
      team: row.team.name,
      played: row.played,
      wins: row.wins,
      draws: row.draws,
      losses: row.losses,
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst,
      points: row.points,
    })),
    topScorers,
  };
};

/**
 * Who hears about a round: whoever runs the league, whoever runs a team in it,
 * and every player with an account linked to a roster in it.
 *
 * An address that was never confirmed is left out, as is anyone who has turned
 * the summary off. One person appearing in several of those roles is mailed
 * once.
 */
export const summaryRecipients = async (seasonId: string): Promise<Recipient[]> => {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: {
      league: { select: { managerId: true } },
      seasonTeams: { select: { teamId: true } },
    },
  });
  if (!season) return [];

  const teamIds = season.seasonTeams.map(entry => entry.teamId);

  const users = await prisma.user.findMany({
    where: {
      active: true,
      emailVerified: true,
      emailDigest: true,
      OR: [
        ...(season.league.managerId ? [{ id: season.league.managerId }] : []),
        { managedTeams: { some: { id: { in: teamIds } } } },
        { playerProfiles: { some: { teamId: { in: teamIds } } } },
      ],
    },
    select: { id: true, name: true, email: true },
  });

  return users;
};
