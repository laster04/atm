import { Request, Response } from 'express';
import prisma from '../config/database.js';
import {
  AuthRequest,
  CreatePlayerRequest,
  UpdatePlayerRequest,
} from '../types/index.js';
import { Prisma } from '@prisma/client';
import { toId } from '../utils/ids.js';
import { canManageTeam } from '../services/access.js';
import { normalizeEmail } from '../utils/email.js';
import { canSeeFullRoster, toPublicPlayer } from '../services/publicView.js';
import { listedGameWhere, listedPlayerWhere, listedSeasonWhere } from '../services/visibility.js';
import { checkPosition, positionsForSports } from '../utils/playerPositions.js';
import { teamSports } from '../services/teamSports.js';

export const getPlayersByTeamId = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { teamId } = req.params;
    const players = await prisma.player.findMany({
      where: { teamId: teamId },
      orderBy: { number: 'asc' }
    });

    // A visitor sees names and shirt numbers; the team's own people see the
    // roster they typed in.
    if (!(await canSeeFullRoster(req.user, teamId))) {
      res.json(players.map(toPublicPlayer));
      return;
    }

    res.json(players);
  } catch (error) {
    console.error('Get players error:', error);
    res.status(500).json({ error: 'Failed to fetch players' });
  }
};

export const getPlayerById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const player = await prisma.player.findUnique({
      where: { id: id },
      include: {
        team: {
          include: {
            seasonTeams: {
              where: { season: listedSeasonWhere(req.user) },
              include: {
                season: true
              }
            }
          }
        }
      }
    });

    if (!player) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }

    // Add convenience `season` field on team for backward compat
    const activeSeason = player.team.seasonTeams
      .map(st => st.season)
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
      .find(s => s.status === 'ACTIVE') || player.team.seasonTeams[0]?.season || null;

    const full = await canSeeFullRoster(req.user, player.teamId);
    res.json({
      ...(full ? player : toPublicPlayer(player)),
      team: { ...player.team, season: activeSeason, sportTypes: await teamSports(player.teamId) }
    });
  } catch (error) {
    console.error('Get player error:', error);
    res.status(500).json({ error: 'Failed to fetch player' });
  }
};

export const createPlayer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { teamId } = req.params;
    const { name, number, position, bornYear, note } = req.body as CreatePlayerRequest;

    if (!name) {
      res.status(400).json({ error: 'Player name is required' });
      return;
    }

    const team = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true } });
    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    const positionCheck = checkPosition(position, await teamSports(teamId));
    if (!positionCheck.ok) {
      res.status(400).json({ error: positionCheck.error });
      return;
    }

    const numberValue = number ? (typeof number === 'string' ? parseInt(number) : number) : null;
    const bornYearValue = bornYear ? (typeof bornYear === 'string' ? parseInt(bornYear) : bornYear) : null;

    const player = await prisma.player.create({
      data: {
        name,
        number: numberValue,
        position: positionCheck.value ?? null,
        bornYear: bornYearValue,
        note: note || null,
        teamId: teamId
      }
    });

    res.status(201).json(player);
  } catch (error) {
    console.error('Create player error:', error);
    res.status(500).json({ error: 'Failed to create player' });
  }
};

export const updatePlayer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, number, position, bornYear, note } = req.body as UpdatePlayerRequest;

    const numberValue = number !== undefined
      ? (number ? (typeof number === 'string' ? parseInt(number) : number) : null)
      : undefined;

    const bornYearValue = bornYear !== undefined
      ? (bornYear ? (typeof bornYear === 'string' ? parseInt(bornYear) : bornYear) : null)
      : undefined;

    let positionValue: Prisma.PlayerUpdateInput['position'];
    if (position !== undefined) {
      const current = await prisma.player.findUnique({ where: { id: id }, select: { teamId: true } });
      if (!current) {
        res.status(404).json({ error: 'Player not found' });
        return;
      }
      const positionCheck = checkPosition(position, await teamSports(current.teamId));
      if (!positionCheck.ok) {
        res.status(400).json({ error: positionCheck.error });
        return;
      }
      positionValue = positionCheck.value;
    }

    const player = await prisma.player.update({
      where: { id: id },
      data: {
        ...(name && { name }),
        ...(numberValue !== undefined && { number: numberValue }),
        ...(positionValue !== undefined && { position: positionValue }),
        ...(bornYearValue !== undefined && { bornYear: bornYearValue }),
        ...(note !== undefined && { note: note || null })
      }
    });

    res.json(player);
  } catch (error) {
    if ((error as Prisma.PrismaClientKnownRequestError).code === 'P2025') {
      res.status(404).json({ error: 'Player not found' });
      return;
    }
    console.error('Update player error:', error);
    res.status(500).json({ error: 'Failed to update player' });
  }
};

export const deletePlayer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await prisma.player.delete({ where: { id: id } });
    res.json({ message: 'Player deleted successfully' });
  } catch (error) {
    if ((error as Prisma.PrismaClientKnownRequestError).code === 'P2025') {
      res.status(404).json({ error: 'Player not found' });
      return;
    }
    console.error('Delete player error:', error);
    res.status(500).json({ error: 'Failed to delete player' });
  }
};

export const movePlayer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const targetTeamId = toId(req.body.targetTeamId);

    if (!targetTeamId) {
      res.status(400).json({ error: 'Target team ID is required' });
      return;
    }

    // Get player with current team and season/league info
    const player = await prisma.player.findUnique({
      where: { id: id },
      include: {
        team: {
          include: {
            seasonTeams: {
              include: {
                season: { include: { league: true } }
              }
            }
          }
        }
      }
    });

    if (!player) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }

    // Get target team with season/league info
    const targetTeam = await prisma.team.findUnique({
      where: { id: targetTeamId },
      include: {
        seasonTeams: {
          include: {
            season: { include: { league: true } }
          }
        }
      }
    });

    if (!targetTeam) {
      res.status(404).json({ error: 'Target team not found' });
      return;
    }

    // requirePlayerAccess covered the source team; the destination needs its own check.
    if (!(await canManageTeam(req.user!, targetTeamId))) {
      res.status(403).json({ error: 'Not authorized to move players between these teams' });
      return;
    }

    // Prevent moving to the same team
    if (player.teamId === targetTeamId) {
      res.status(400).json({ error: 'Player is already on this team' });
      return;
    }

    // Moving a linked player onto a team where that account already holds a
    // roster spot would break the one-spot-per-team rule.
    if (player.userId) {
      const clash = await prisma.player.findFirst({
        where: { teamId: targetTeamId, userId: player.userId },
        select: { id: true },
      });
      if (clash) {
        res.status(409).json({ error: 'That account already holds a roster spot in the target team' });
        return;
      }
    }

    const updatedPlayer = await prisma.$transaction(async tx => {
      // Answers given for this player belong to the team they were on. Leaving
      // them behind would show someone as coming to a training session for a
      // team they no longer play for.
      await tx.attendance.deleteMany({
        where: { playerId: id, event: { teamId: player.teamId } },
      });

      // A goalie moved to a basketball team has no position there any more.
      const targetPositions = positionsForSports([
        ...new Set(targetTeam.seasonTeams.map(entry => entry.season.league.sportType)),
      ]);
      const keepsPosition = !player.position || targetPositions.includes(player.position);

      return tx.player.update({
        where: { id: id },
        data: { teamId: targetTeamId, ...(!keepsPosition && { position: null }) },
        include: {
          team: {
            include: {
              seasonTeams: {
                include: { season: true }
              }
            }
          }
        }
      });
    });

    // Add convenience `season` field
    const activeSeason = updatedPlayer.team.seasonTeams
      .map(st => st.season)
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
      .find(s => s.status === 'ACTIVE') || updatedPlayer.team.seasonTeams[0]?.season || null;

    res.json({
      ...updatedPlayer,
      team: { ...updatedPlayer.team, season: activeSeason }
    });
  } catch (error) {
    console.error('Move player error:', error);
    res.status(500).json({ error: 'Failed to move player' });
  }
};

/**
 * Links a roster row to the account of the person who holds it. A roster row is
 * created by a manager typing a name and exists whether or not that person ever
 * signs up, so the link is a separate, reversible step rather than part of
 * creating the player.
 *
 * Only an account that already exists can be linked: silently creating one from
 * a typo in an email field would hand a stranger a seat on the team.
 */
export const linkPlayerToUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { email } = req.body as { email?: string };

    if (!email || typeof email !== 'string' || !email.trim()) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const player = await prisma.player.findUnique({
      where: { id },
      select: { id: true, teamId: true, userId: true },
    });
    if (!player) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }
    if (player.userId) {
      res.status(409).json({ error: 'Player is already linked to an account' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
      select: { id: true, active: true },
    });
    if (!user) {
      res.status(404).json({ error: 'No account with that email' });
      return;
    }
    if (!user.active) {
      res.status(400).json({ error: 'That account is deactivated' });
      return;
    }

    // One person cannot hold two roster spots in the same team.
    const alreadyOnTeam = await prisma.player.findFirst({
      where: { teamId: player.teamId, userId: user.id },
      select: { id: true },
    });
    if (alreadyOnTeam) {
      res.status(409).json({ error: 'That account is already linked to a player in this team' });
      return;
    }

    const updated = await prisma.player.update({
      where: { id },
      data: { userId: user.id },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    res.json(updated);
  } catch (error) {
    console.error('Link player error:', error);
    res.status(500).json({ error: 'Failed to link player' });
  }
};

/**
 * Unlinks without touching the roster row: the player, their number and their
 * recorded games all stay, only the account association goes.
 */
export const unlinkPlayerFromUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const player = await prisma.player.findUnique({ where: { id }, select: { id: true } });
    if (!player) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }

    const updated = await prisma.player.update({ where: { id }, data: { userId: null } });
    res.json(updated);
  } catch (error) {
    console.error('Unlink player error:', error);
    res.status(500).json({ error: 'Failed to unlink player' });
  }
};

/**
 * Every roster spot the signed-in user holds. This is what lets a player who
 * manages nothing still have somewhere to land after logging in.
 */
export const getMyPlayerProfiles = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const players = await prisma.player.findMany({
      where: { userId: req.user!.id },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            logo: true,
            primaryColor: true,
            seasonTeams: {
              select: { season: { select: { id: true, name: true, status: true, startDate: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json(
      players.map(player => ({
        ...player,
        team: {
          ...player.team,
          seasons: player.team.seasonTeams.map(st => st.season),
          seasonTeams: undefined,
        },
      }))
    );
  } catch (error) {
    console.error('Get my player profiles error:', error);
    res.status(500).json({ error: 'Failed to fetch player profiles' });
  }
};

/**
 * The public directory of players. Carries each player's career totals so the
 * list can be sorted by production without a second round trip — one groupBy
 * over the statistics of the players on the page, not per player.
 *
 * Totals are career-wide unless a season or league narrows the games counted;
 * a player who changed teams keeps the rows they earned at each.
 */
export const getPublicPlayers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, teamId, seasonId, leagueId, sort } = req.query as Record<string, string | undefined>;
    const take = Math.min(parseInt(req.query.take as string) || 48, 200);
    const skip = parseInt(req.query.skip as string) || 0;

    const seasonFilter: Prisma.SeasonWhereInput = {
      ...(seasonId && { id: seasonId }),
      ...(leagueId && { leagueId }),
    };
    const narrowed = Object.keys(seasonFilter).length > 0;
    const listedSeason = listedSeasonWhere(req.user);

    const where: Prisma.PlayerWhereInput = {
      AND: [
        listedPlayerWhere(req.user),
        {
          ...(search && { name: { contains: search, mode: 'insensitive' } }),
          ...(teamId && { teamId }),
          ...(narrowed && { team: { seasonTeams: { some: { season: { AND: [seasonFilter, listedSeason] } } } } }),
        },
      ],
    };

    // Sorting by points means ranking every match before paging, so that path
    // aggregates first and pages the ranked list; the default name sort pages
    // in the database and only totals the page it returns.
    const byPoints = sort === 'points';

    const [players, total] = await Promise.all([
      prisma.player.findMany({
        where,
        include: {
          team: { select: { id: true, name: true, logo: true, primaryColor: true } }
        },
        orderBy: [{ name: 'asc' }],
        ...(byPoints ? {} : { take, skip })
      }),
      prisma.player.count({ where })
    ]);

    // Totals count listed games only: goals scored in a hidden season would
    // otherwise show up as a career number nobody can trace.
    const gameFilter: Prisma.GameWhereInput = narrowed
      ? { AND: [{ season: seasonFilter }, listedGameWhere(req.user)] }
      : listedGameWhere(req.user);
    const gameIds = (await prisma.game.findMany({ where: gameFilter, select: { id: true } })).map(g => g.id);

    const totals = await prisma.hockeyGameStatistic.groupBy({
      by: ['playerId'],
      where: {
        playerId: { in: players.map(p => p.id) },
        gameId: { in: gameIds }
      },
      _sum: { goals: true, assists: true, penaltyMinutes: true },
      _count: { _all: true }
    });
    const byPlayer = new Map(totals.map(t => [t.playerId, t]));

    let items = players.map(player => {
      const t = byPlayer.get(player.id);
      const goals = t?._sum.goals ?? 0;
      const assists = t?._sum.assists ?? 0;
      return {
        ...player,
        stats: {
          gamesPlayed: t?._count._all ?? 0,
          goals,
          assists,
          points: goals + assists,
          penaltyMinutes: t?._sum.penaltyMinutes ?? 0
        }
      };
    });

    if (byPoints) {
      items = items
        .sort((a, b) => b.stats.points - a.stats.points || b.stats.goals - a.stats.goals)
        .slice(skip, skip + take);
    }

    res.json({ items, total });
  } catch (error) {
    console.error('Get public players error:', error);
    res.status(500).json({ error: 'Failed to fetch players' });
  }
};
