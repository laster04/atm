import prisma from '../config/database.js';
import { computeTable } from '../services/standings/compute.js';
import { resolveTournamentPolicy } from '../services/scoring/resolve.js';

export interface GroupStandingRow {
  teamId: string;
  team: { id: string; name: string; logo: string | null; primaryColor: string | null; country: string | null };
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
}

// Shared by the standings endpoint and playoff seeding, so both rank teams the
// same way. Points and tiebreakers come from the tournament's scoring policy,
// which is the same service league standings use; this function only adapts
// tournament rows to it and back to the shape the tournament API returns.
export async function computeGroupStandings(tournamentId: string, groupId: string | null): Promise<GroupStandingRow[]> {
  const groupFilter = groupId ? { groupId } : {};
  const policy = await resolveTournamentPolicy(tournamentId);

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

  return computeTable(teams, games, policy).map(row => ({
    teamId: row.teamId,
    team: row.team,
    played: row.played,
    won: row.wins,
    drawn: row.draws,
    lost: row.losses,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    goalDiff: row.goalDifference,
    points: row.points,
  }));
}
