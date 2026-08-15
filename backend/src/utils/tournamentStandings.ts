import prisma from '../config/database.js';

export interface GroupStandingRow {
  teamId: number;
  team: { id: number; name: string; logo: string | null; primaryColor: string | null; country: string | null };
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
}

// Shared by the standings endpoint and playoff seeding, so both rank teams
// the same way (points, then goal diff, then goals for).
export async function computeGroupStandings(tournamentId: number, groupId: number | null): Promise<GroupStandingRow[]> {
  const groupFilter = groupId ? { groupId } : {};

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { series: { select: { sportType: true } } },
  });
  // Tennis is win/loss only — no bonus for margin, no points for a draw.
  const isTennis = tournament?.series?.sportType === 'TENNIS';
  const winPoints = isTennis ? 1 : 3;
  const drawPoints = isTennis ? 0 : 1;

  const games = await prisma.tournamentGame.findMany({
    where: {
      tournamentId,
      status: 'COMPLETED',
      phase: 'GROUP',
      ...groupFilter,
    },
  });

  const teams = await prisma.tournamentTeam.findMany({
    where: {
      tournamentId,
      ...(groupId ? { groupTeams: { some: { groupId } } } : {}),
    },
  });

  const statsMap = new Map<number, Omit<GroupStandingRow, 'team' | 'goalDiff'>>();
  for (const team of teams) {
    statsMap.set(team.id, {
      teamId: team.id, played: 0, won: 0, drawn: 0, lost: 0,
      goalsFor: 0, goalsAgainst: 0, points: 0,
    });
  }

  for (const game of games) {
    if (game.homeTeamId == null || game.awayTeamId == null) continue;
    if (game.homeScore == null || game.awayScore == null) continue;

    const home = statsMap.get(game.homeTeamId);
    const away = statsMap.get(game.awayTeamId);
    if (!home || !away) continue;

    home.played++; away.played++;
    home.goalsFor += game.homeScore; home.goalsAgainst += game.awayScore;
    away.goalsFor += game.awayScore; away.goalsAgainst += game.homeScore;

    if (game.homeScore > game.awayScore) {
      home.won++; home.points += winPoints; away.lost++;
    } else if (game.homeScore < game.awayScore) {
      away.won++; away.points += winPoints; home.lost++;
    } else {
      home.drawn++; home.points += drawPoints; away.drawn++; away.points += drawPoints;
    }
  }

  return Array.from(statsMap.values())
    .map(s => ({
      ...s,
      team: teams.find(t => t.id === s.teamId)!,
      goalDiff: s.goalsFor - s.goalsAgainst,
    }))
    .sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor);
}
