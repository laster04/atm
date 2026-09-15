import { SportType } from '@prisma/client';
import prisma from '../config/database.js';

/**
 * Sports a team plays, from every season it is in, listed or not. Which
 * positions a roster row may hold is a rule of the sport, so it must not
 * depend on which of the team's seasons the viewer happens to see: a team
 * whose only season is still unlisted plays hockey all the same.
 */
export const teamSports = async (teamId: string): Promise<SportType[]> => {
  const entries = await prisma.seasonTeam.findMany({
    where: { teamId },
    select: { season: { select: { league: { select: { sportType: true } } } } },
  });
  return [...new Set(entries.map(entry => entry.season.league.sportType))];
};
