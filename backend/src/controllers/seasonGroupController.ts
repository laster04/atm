import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/database.js';
import { AuthRequest, Standing } from '../types/index.js';
import { computeStandings } from './seasonController.js';
import { policyFromRows } from '../services/scoring/resolve.js';

const groupInclude = {
  seasonTeams: {
    include: { team: { select: { id: true, name: true, logo: true, primaryColor: true } } },
  },
} satisfies Prisma.SeasonGroupInclude;

export const getGroupsBySeason = async (req: Request, res: Response): Promise<void> => {
  try {
    const { seasonId } = req.params;
    const groups = await prisma.seasonGroup.findMany({
      where: { seasonId },
      include: groupInclude,
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    });
    res.json(groups);
  } catch (error) {
    console.error('Get season groups error:', error);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
};

export const createGroup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { seasonId } = req.params;
    const { name, position } = req.body as { name?: string; position?: number };

    if (!name || !name.trim()) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    const group = await prisma.seasonGroup.create({
      data: {
        seasonId,
        name: name.trim(),
        // Appended by default, so adding a group never reshuffles the others.
        position: Number.isInteger(position)
          ? (position as number)
          : await prisma.seasonGroup.count({ where: { seasonId } }),
      },
      include: groupInclude,
    });

    res.status(201).json(group);
  } catch (error) {
    if ((error as Prisma.PrismaClientKnownRequestError).code === 'P2002') {
      res.status(409).json({ error: 'This season already has a group with that name' });
      return;
    }
    console.error('Create season group error:', error);
    res.status(500).json({ error: 'Failed to create the group' });
  }
};

export const updateGroup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, position } = req.body as { name?: string; position?: number };

    if (name !== undefined && !name.trim()) {
      res.status(400).json({ error: 'Name cannot be empty' });
      return;
    }

    const group = await prisma.seasonGroup.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(Number.isInteger(position) && { position: position as number }),
      },
      include: groupInclude,
    });

    res.json(group);
  } catch (error) {
    const code = (error as Prisma.PrismaClientKnownRequestError).code;
    if (code === 'P2002') {
      res.status(409).json({ error: 'This season already has a group with that name' });
      return;
    }
    if (code === 'P2025') {
      res.status(404).json({ error: 'Group not found' });
      return;
    }
    console.error('Update season group error:', error);
    res.status(500).json({ error: 'Failed to update the group' });
  }
};

/**
 * Removing a division leaves its teams in the season, unplaced. Dropping them
 * from the competition because their group was renamed away would lose their
 * fixtures with them.
 */
export const deleteGroup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.seasonGroup.delete({ where: { id } });
    res.json({ message: 'Group deleted' });
  } catch (error) {
    if ((error as Prisma.PrismaClientKnownRequestError).code === 'P2025') {
      res.status(404).json({ error: 'Group not found' });
      return;
    }
    console.error('Delete season group error:', error);
    res.status(500).json({ error: 'Failed to delete the group' });
  }
};

/**
 * Places a team in a division, or takes it out of one with a null group.
 *
 * Both the team and the group have to belong to the season being edited: a team
 * cannot be placed in another league's division, and a season's team cannot be
 * moved into a group that is not part of it.
 */
export const assignTeamToGroup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { seasonId, teamId } = req.params;
    const { groupId } = req.body as { groupId?: string | null };

    const seasonTeam = await prisma.seasonTeam.findUnique({
      where: { seasonId_teamId: { seasonId, teamId } },
      select: { id: true },
    });
    if (!seasonTeam) {
      res.status(404).json({ error: 'That team does not play in this season' });
      return;
    }

    if (groupId) {
      const group = await prisma.seasonGroup.findUnique({
        where: { id: groupId },
        select: { seasonId: true },
      });
      if (!group) {
        res.status(404).json({ error: 'Group not found' });
        return;
      }
      if (group.seasonId !== seasonId) {
        res.status(400).json({ error: 'That group belongs to a different season' });
        return;
      }
    }

    const updated = await prisma.seasonTeam.update({
      where: { id: seasonTeam.id },
      data: { groupId: groupId ?? null },
      include: { team: { select: { id: true, name: true, logo: true, primaryColor: true } } },
    });

    res.json(updated);
  } catch (error) {
    console.error('Assign team to group error:', error);
    res.status(500).json({ error: 'Failed to place the team' });
  }
};

export interface GroupTable {
  group: { id: string; name: string; position: number } | null;
  standings: Standing[];
}

/**
 * One table per division, plus a table for teams that have not been placed.
 *
 * A division's table only counts games between teams in that division. A season
 * with no divisions returns a single table covering all of it, so a caller can
 * render this shape whether or not the season is split.
 */
export const getStandingsByGroup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: seasonId } = req.params;

    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      select: { id: true, scoring: true, league: { select: { scoring: true, sportType: true } } },
    });
    if (!season) {
      res.status(404).json({ error: 'Season not found' });
      return;
    }

    const [groups, seasonTeams, completed, inProgress] = await Promise.all([
      prisma.seasonGroup.findMany({
        where: { seasonId },
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
      }),
      prisma.seasonTeam.findMany({
        where: { seasonId },
        include: { team: { select: { id: true, name: true, logo: true, primaryColor: true } } },
      }),
      prisma.game.findMany({ where: { seasonId, status: 'COMPLETED' } }),
      prisma.game.findMany({ where: { seasonId, status: 'IN_PROGRESS' } }),
    ]);

    const policy = policyFromRows(season, season.league, 'LEAGUE');

    const tableFor = (entries: typeof seasonTeams): Standing[] => {
      const teams = entries.map(entry => entry.team);
      const ids = new Set(teams.map(team => team.id));
      // Cross-group fixtures exist in the season but say nothing about a
      // division's own table, so they are left out of it.
      const within = <T extends { homeTeamId: string; awayTeamId: string }>(games: T[]): T[] =>
        games.filter(game => ids.has(game.homeTeamId) && ids.has(game.awayTeamId));
      return computeStandings(teams, within(completed), policy, within(inProgress));
    };

    if (groups.length === 0) {
      res.json([{ group: null, standings: tableFor(seasonTeams) }]);
      return;
    }

    const tables: GroupTable[] = groups.map(group => ({
      group: { id: group.id, name: group.name, position: group.position },
      standings: tableFor(seasonTeams.filter(entry => entry.groupId === group.id)),
    }));

    // Teams still waiting to be placed are shown apart rather than silently
    // dropped, so a half-finished draw is visible instead of looking complete.
    const unplaced = seasonTeams.filter(entry => entry.groupId === null);
    if (unplaced.length > 0) {
      tables.push({ group: null, standings: tableFor(unplaced) });
    }

    res.json(tables);
  } catch (error) {
    console.error('Get standings by group error:', error);
    res.status(500).json({ error: 'Failed to fetch group standings' });
  }
};
