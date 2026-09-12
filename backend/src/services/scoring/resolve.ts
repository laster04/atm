import { SportType } from '@prisma/client';
import prisma from '../../config/database.js';
import { CompetitionKind, ScoringPolicy, resolvePolicy } from './policy.js';

/**
 * Scoring is configured at two levels so an organiser sets it once and a single
 * season or tournament can still depart from it. The nearest non-null override
 * wins; with none, the sport default applies.
 */
const inherit = (
  own: unknown,
  parent: unknown,
  sportType: SportType | null | undefined,
  kind: CompetitionKind
): ScoringPolicy => resolvePolicy(own ?? parent ?? null, sportType, kind);

export const resolveSeasonPolicy = async (seasonId: string): Promise<ScoringPolicy> => {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: { scoring: true, league: { select: { scoring: true, sportType: true } } },
  });
  return inherit(season?.scoring, season?.league?.scoring, season?.league?.sportType, 'LEAGUE');
};

export const resolveTournamentPolicy = async (tournamentId: string): Promise<ScoringPolicy> => {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { scoring: true, series: { select: { scoring: true, sportType: true } } },
  });
  return inherit(tournament?.scoring, tournament?.series?.scoring, tournament?.series?.sportType, 'TOURNAMENT');
};

/**
 * Same resolution for callers that already hold the rows, so computing a table
 * inside a transaction does not have to go back to the database for the policy.
 */
export const policyFromRows = (
  own: { scoring?: unknown } | null | undefined,
  parent: { scoring?: unknown; sportType?: SportType | null } | null | undefined,
  kind: CompetitionKind
): ScoringPolicy => inherit(own?.scoring, parent?.scoring, parent?.sportType, kind);
