import { Request, Response } from 'express';
import prisma from '../config/database.js';
import {
  AuthRequest,
  CreateSeasonRequest,
  UpdateSeasonRequest,
  Standing,
  TeamStanding,
  StandingTeamRef,
} from '../types/index.js';
import { Prisma } from '@prisma/client';
import { toId } from '../utils/ids.js';
import { canManageLeague, isAdmin } from '../services/access.js';
import { computeTable } from '../services/standings/compute.js';
import { ScoringPolicy } from '../services/scoring/policy.js';
import { policyFromRows, resolveSeasonPolicy } from '../services/scoring/resolve.js';

type StandingGame = {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
};

/**
 * Season standings are a thin adapter over the shared table service: it owns how
 * results become points and how ties break, this owns only the Standing shape
 * the season API has always returned. The policy comes from the season/league,
 * so "two points for a win" is no longer a fact of this file.
 */
export function computeStandings(
  teams: StandingTeamRef[],
  games: StandingGame[],
  policy: ScoringPolicy
): Standing[] {
  return computeTable(teams, games, policy).map(row => ({
    team: row.team,
    played: row.played,
    wins: row.wins,
    draws: row.draws,
    losses: row.losses,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    goalDifference: row.goalDifference,
    points: row.points,
  }));
}

export const getAllSeasons = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const seasons = await prisma.season.findMany({
      include: {
        league: { select: { id: true, name: true, sportType: true, managerId: true } },
        _count: { select: { seasonTeams: true, games: true } }
      },
      orderBy: { startDate: 'desc' }
    });

    // Filter out DRAFT seasons unless the user is ADMIN or the manager of that season's league
    const filtered = seasons.filter((season) => {
      if (season.status !== 'DRAFT') return true;
      if (!req.user) return false;
      if (isAdmin(req.user)) return true;
      return season.league.managerId != null && season.league.managerId === req.user.id;
    });

    res.json(filtered);
  } catch (error) {
    console.error('Get seasons error:', error);
    res.status(500).json({ error: 'Failed to fetch seasons' });
  }
};

export const getMySeasons = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const seasons = await prisma.season.findMany({
      where: { league: { managerId: req.user!.id } },
      include: {
        league: { select: { id: true, name: true, sportType: true, managerId: true } },
        _count: { select: { seasonTeams: true, games: true } }
      },
      orderBy: { startDate: 'desc' }
    });
    res.json(seasons);
  } catch (error) {
    console.error('Get my seasons error:', error);
    res.status(500).json({ error: 'Failed to fetch seasons' });
  }
};

export const getSeasonById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const season = await prisma.season.findUnique({
      where: { id: id },
      include: {
        league: { select: { id: true, name: true, sportType: true, managerId: true } },
        seasonTeams: {
          include: {
            team: {
              include: {
                _count: { select: { players: true } },
                manager: { select: { id: true, name: true, email: true } }
              }
            }
          }
        },
        _count: { select: { games: true } }
      }
    });

    if (!season) {
      res.status(404).json({ error: 'Season not found' });
      return;
    }

    // Map seasonTeams to flat teams array for backward compatibility
    const { seasonTeams, ...seasonData } = season;
    const teams = seasonTeams.map(st => st.team);
    res.json({ ...seasonData, teams });
  } catch (error) {
    console.error('Get season error:', error);
    res.status(500).json({ error: 'Failed to fetch season' });
  }
};

export const createSeason = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, startDate, endDate, status } = req.body as CreateSeasonRequest;
    const leagueId = toId(req.body.leagueId);

    if (!name || !leagueId || !startDate || !endDate) {
      res.status(400).json({ error: 'Name, league, start date, and end date are required' });
      return;
    }

    // Verify league exists
    const league = await prisma.league.findUnique({ where: { id: leagueId } });
    if (!league) {
      res.status(400).json({ error: 'League not found' });
      return;
    }

    if (!(await canManageLeague(req.user!, leagueId))) {
      res.status(403).json({ error: 'Not authorized to create seasons in this league' });
      return;
    }

    const season = await prisma.season.create({
      data: {
        name,
        leagueId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: status || 'DRAFT'
      },
      include: {
        league: { select: { id: true, name: true, sportType: true, managerId: true } },
        _count: { select: { seasonTeams: true, games: true } }
      }
    });

    res.status(201).json(season);
  } catch (error) {
    console.error('Create season error:', error);
    res.status(500).json({ error: 'Failed to create season' });
  }
};

export const updateSeason = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, startDate, endDate, status } = req.body as UpdateSeasonRequest;
    const leagueId = toId(req.body.leagueId);

    const existingSeason = await prisma.season.findUnique({
      where: { id: id },
      include: { league: { select: { managerId: true } } }
    });
    if (!existingSeason) {
      res.status(404).json({ error: 'Season not found' });
      return;
    }

    // Archived seasons are a permanent record: name/dates can still be edited, but not status or league.
    // Compare against the stored value (not just presence) since the edit form always resubmits the full payload.
    if (existingSeason.archivedAt) {
      const changesStatus = status !== undefined && status !== existingSeason.status;
      const changesLeague = leagueId !== undefined && leagueId !== existingSeason.leagueId;
      if (changesStatus || changesLeague) {
        res.status(400).json({ error: 'Cannot change the status or league of an archived season' });
        return;
      }
    }

    // If changing league, verify it exists and user has access
    if (leagueId) {
      const league = await prisma.league.findUnique({ where: { id: leagueId } });
      if (!league) {
        res.status(400).json({ error: 'League not found' });
        return;
      }
      if (!(await canManageLeague(req.user!, leagueId))) {
        res.status(403).json({ error: 'Not authorized to move season to this league' });
        return;
      }
    }

    const season = await prisma.season.update({
      where: { id: id },
      data: {
        ...(name && { name }),
        ...(leagueId && { leagueId }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(status && { status })
      },
      include: {
        league: { select: { id: true, name: true, sportType: true, managerId: true } },
        _count: { select: { seasonTeams: true, games: true } }
      }
    });

    res.json(season);
  } catch (error) {
    if ((error as Prisma.PrismaClientKnownRequestError).code === 'P2025') {
      res.status(404).json({ error: 'Season not found' });
      return;
    }
    console.error('Update season error:', error);
    res.status(500).json({ error: 'Failed to update season' });
  }
};

export const deleteSeason = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Archived seasons are a permanent record and can never be deleted, regardless of role
    const seasonToDelete = await prisma.season.findUnique({ where: { id: id } });
    if (!seasonToDelete) {
      res.status(404).json({ error: 'Season not found' });
      return;
    }
    if (seasonToDelete.archivedAt) {
      res.status(400).json({ error: 'Cannot delete an archived season' });
      return;
    }

    // Only an admin may delete a season that has already started.
    if (!isAdmin(req.user!) && new Date(seasonToDelete.startDate) <= new Date()) {
      res.status(403).json({ error: 'Cannot delete a season that has already started' });
      return;
    }

    await prisma.season.delete({ where: { id: id } });
    res.json({ message: 'Season deleted successfully' });
  } catch (error) {
    if ((error as Prisma.PrismaClientKnownRequestError).code === 'P2025') {
      res.status(404).json({ error: 'Season not found' });
      return;
    }
    console.error('Delete season error:', error);
    res.status(500).json({ error: 'Failed to delete season' });
  }
};

export const getSeasonStandings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const seasonId = id;

    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      select: { id: true, scoring: true, league: { select: { scoring: true, sportType: true } } },
    });
    if (!season) {
      res.status(404).json({ error: 'Season not found' });
      return;
    }

    const seasonTeams = await prisma.seasonTeam.findMany({
      where: { seasonId },
      include: { team: { select: { id: true, name: true, logo: true, primaryColor: true } } }
    });
    const teams = seasonTeams.map(st => st.team);

    const games = await prisma.game.findMany({
      where: { seasonId, status: 'COMPLETED' }
    });

    const standings = computeStandings(teams, games, policyFromRows(season, season.league, 'LEAGUE'));

    res.json(standings);
  } catch (error) {
    console.error('Get standings error:', error);
    res.status(500).json({ error: 'Failed to fetch standings' });
  }
};

export const getTeamStanding = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, teamId } = req.params;
    const seasonId = id;
    const teamIdNum = teamId;

    const season = await prisma.season.findUnique({ where: { id: seasonId } });
    if (!season) {
      res.status(404).json({ error: 'Season not found' });
      return;
    }

    const seasonTeamEntry = await prisma.seasonTeam.findUnique({
      where: { seasonId_teamId: { seasonId, teamId: teamIdNum } },
      include: { team: { select: { id: true, name: true, logo: true } } }
    });

    if (!seasonTeamEntry) {
      res.status(404).json({ error: 'Team not found in this season' });
      return;
    }

    const team = seasonTeamEntry.team;

    const allSeasonTeams = await prisma.seasonTeam.findMany({
      where: { seasonId },
      include: { team: { select: { id: true, name: true, logo: true } } }
    });
    const allTeams = allSeasonTeams.map(st => st.team);

    const games = await prisma.game.findMany({
      where: { seasonId, status: 'COMPLETED' }
    });

    // Calculate standings for all teams to determine rank
    const allStandings = computeStandings(allTeams, games, await resolveSeasonPolicy(seasonId));

    const rank = allStandings.findIndex(s => s.team.id === teamIdNum) + 1;
    const teamStanding = allStandings.find(s => s.team.id === teamIdNum);

    const response: TeamStanding = {
      ...teamStanding!,
      rank,
      totalTeams: allTeams.length
    };

    res.json(response);
  } catch (error) {
    console.error('Get team standing error:', error);
    res.status(500).json({ error: 'Failed to fetch team standing' });
  }
};

export const archiveSeason = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const seasonId = id;

    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      include: { league: { select: { managerId: true, scoring: true, sportType: true } } }
    });
    if (!season) {
      res.status(404).json({ error: 'Season not found' });
      return;
    }

    // Resolved before the transaction: the archive must freeze the table exactly
    // as the season was scored, not as the sport default happens to score today.
    const archivePolicy = policyFromRows(season, season.league, 'LEAGUE');

    if (season.status !== 'COMPLETED') {
      res.status(400).json({ error: 'Only completed seasons can be archived' });
      return;
    }
    if (season.archivedAt) {
      res.status(400).json({ error: 'Season is already archived' });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const seasonTeams = await tx.seasonTeam.findMany({
        where: { seasonId },
        include: { team: { select: { id: true, name: true, logo: true, primaryColor: true } } }
      });
      const teams = seasonTeams.map(st => st.team);

      // Every game in the season is removed on archive, but only COMPLETED games count toward standings
      const allGames = await tx.game.findMany({ where: { seasonId } });
      const completedGames = allGames.filter(g => g.status === 'COMPLETED');
      const standings = computeStandings(teams, completedGames, archivePolicy);

      if (standings.length > 0) {
        await tx.seasonArchiveStanding.createMany({
          data: standings.map((s, idx) => ({
            seasonId,
            teamId: s.team.id,
            teamName: s.team.name,
            teamLogo: s.team.logo,
            teamPrimaryColor: s.team.primaryColor ?? null,
            rank: idx + 1,
            played: s.played,
            wins: s.wins,
            draws: s.draws,
            losses: s.losses,
            goalsFor: s.goalsFor,
            goalsAgainst: s.goalsAgainst,
            points: s.points
          }))
        });
      }

      const gameIds = allGames.map(g => g.id);
      const stats = gameIds.length > 0
        ? await tx.hockeyGameStatistic.findMany({
            where: { gameId: { in: gameIds } },
            include: { player: { include: { team: true } } }
          })
        : [];

      const playerAgg = new Map<string, {
        playerId: string;
        playerName: string;
        playerNumber: number | null;
        teamId: string;
        teamName: string;
        gamesPlayed: number;
        goals: number;
        assists: number;
        penaltyMinutes: number;
      }>();

      for (const stat of stats) {
        const existing = playerAgg.get(stat.playerId);
        if (existing) {
          existing.goals += stat.goals || 0;
          existing.assists += stat.assists || 0;
          existing.penaltyMinutes += stat.penaltyMinutes || 0;
          existing.gamesPlayed += 1;
        } else {
          playerAgg.set(stat.playerId, {
            playerId: stat.player.id,
            playerName: stat.player.name,
            playerNumber: stat.player.number,
            teamId: stat.player.team.id,
            teamName: stat.player.team.name,
            gamesPlayed: 1,
            goals: stat.goals || 0,
            assists: stat.assists || 0,
            penaltyMinutes: stat.penaltyMinutes || 0
          });
        }
      }

      if (playerAgg.size > 0) {
        await tx.seasonArchivePlayerStat.createMany({
          data: Array.from(playerAgg.values()).map(p => ({
            seasonId,
            playerId: p.playerId,
            playerName: p.playerName,
            playerNumber: p.playerNumber,
            teamId: p.teamId,
            teamName: p.teamName,
            gamesPlayed: p.gamesPlayed,
            goals: p.goals,
            assists: p.assists,
            penaltyMinutes: p.penaltyMinutes
          }))
        });
      }

      // Verify the copy before touching any live rows
      const archivedStandingCount = await tx.seasonArchiveStanding.count({ where: { seasonId } });
      const archivedPlayerStatCount = await tx.seasonArchivePlayerStat.count({ where: { seasonId } });
      if (archivedStandingCount !== standings.length) {
        throw new Error('Archive verification failed: standings row count mismatch');
      }
      if (archivedPlayerStatCount !== playerAgg.size) {
        throw new Error('Archive verification failed: player stat row count mismatch');
      }
      const sourceGoals = stats.reduce((sum, s) => sum + (s.goals || 0), 0);
      const sourceAssists = stats.reduce((sum, s) => sum + (s.assists || 0), 0);
      const sourcePenalties = stats.reduce((sum, s) => sum + (s.penaltyMinutes || 0), 0);
      const agg = Array.from(playerAgg.values());
      const archivedGoals = agg.reduce((sum, p) => sum + p.goals, 0);
      const archivedAssists = agg.reduce((sum, p) => sum + p.assists, 0);
      const archivedPenalties = agg.reduce((sum, p) => sum + p.penaltyMinutes, 0);
      if (archivedGoals !== sourceGoals || archivedAssists !== sourceAssists) {
        throw new Error('Archive verification failed: goals/assists total mismatch');
      }
      if (archivedPenalties !== sourcePenalties) {
        throw new Error('Archive verification failed: penalty minutes total mismatch');
      }

      // Verified — now safe to delete the live season-scoped rows
      await tx.hockeyGameStatistic.deleteMany({ where: { gameId: { in: gameIds } } });
      await tx.game.deleteMany({ where: { seasonId } });
      await tx.seasonTeam.deleteMany({ where: { seasonId } });

      return tx.season.update({
        where: { id: seasonId },
        data: { archivedAt: new Date() },
        include: {
          league: { select: { id: true, name: true, sportType: true, managerId: true } },
          _count: { select: { seasonTeams: true, games: true } }
        }
      });
    }, { timeout: 15000 });

    res.json({ message: 'Season archived successfully', season: updated });
  } catch (error) {
    console.error('Archive season error:', error);
    res.status(500).json({ error: (error as Error).message || 'Failed to archive season' });
  }
};

export const getArchivedStandings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const seasonId = id;

    const season = await prisma.season.findUnique({ where: { id: seasonId } });
    if (!season) {
      res.status(404).json({ error: 'Season not found' });
      return;
    }

    const rows = await prisma.seasonArchiveStanding.findMany({
      where: { seasonId },
      orderBy: { rank: 'asc' }
    });

    const standings: TeamStanding[] = rows.map(row => ({
      team: {
        id: row.teamId ?? `archived-${row.id}`,
        name: row.teamName,
        logo: row.teamLogo,
        primaryColor: row.teamPrimaryColor
      },
      played: row.played,
      wins: row.wins,
      draws: row.draws,
      losses: row.losses,
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst,
      goalDifference: row.goalsFor - row.goalsAgainst,
      points: row.points,
      rank: row.rank,
      totalTeams: rows.length
    }));

    res.json(standings);
  } catch (error) {
    console.error('Get archived standings error:', error);
    res.status(500).json({ error: 'Failed to fetch archived standings' });
  }
};

// Teams that participated in a completed season, usable as a source when setting up a new season.
// For an archived season the live SeasonTeam rows are gone, so the team list is reconstructed from
// the archived standings snapshot instead (teams that were later deleted independently are skipped).
export const getCopyableTeams = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const seasonId = id;

    const season = await prisma.season.findUnique({ where: { id: seasonId } });
    if (!season) {
      res.status(404).json({ error: 'Season not found' });
      return;
    }
    if (season.status !== 'COMPLETED') {
      res.status(400).json({ error: 'Only completed seasons can be used as a source' });
      return;
    }

    let teamIds: string[];
    if (season.archivedAt) {
      const rows = await prisma.seasonArchiveStanding.findMany({
        where: { seasonId, teamId: { not: null } },
        select: { teamId: true }
      });
      teamIds = Array.from(new Set(rows.map(r => r.teamId as string)));
    } else {
      const rows = await prisma.seasonTeam.findMany({ where: { seasonId }, select: { teamId: true } });
      teamIds = rows.map(r => r.teamId);
    }

    const teams = await prisma.team.findMany({
      where: { id: { in: teamIds } },
      include: { _count: { select: { players: true } } },
      orderBy: { name: 'asc' }
    });

    res.json(teams);
  } catch (error) {
    console.error('Get copyable teams error:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
};

export const copyTeamsToSeason = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const seasonId = id;
    const rawTeamIds = (req.body as { teamIds?: unknown[] }).teamIds;

    if (!Array.isArray(rawTeamIds) || rawTeamIds.length === 0) {
      res.status(400).json({ error: 'teamIds is required' });
      return;
    }

    const teamIds = rawTeamIds.map(toId);
    if (teamIds.some((teamId) => teamId === undefined)) {
      res.status(400).json({ error: 'One or more teams not found' });
      return;
    }

    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      include: { league: { select: { managerId: true } } }
    });
    if (!season) {
      res.status(404).json({ error: 'Season not found' });
      return;
    }
    if (season.archivedAt) {
      res.status(400).json({ error: 'Cannot modify an archived season' });
      return;
    }

    const uniqueTeamIds = Array.from(new Set(teamIds as string[]));
    const existingTeamCount = await prisma.team.count({ where: { id: { in: uniqueTeamIds } } });
    if (existingTeamCount !== uniqueTeamIds.length) {
      res.status(400).json({ error: 'One or more teams not found' });
      return;
    }

    await prisma.seasonTeam.createMany({
      data: uniqueTeamIds.map(teamId => ({ seasonId, teamId })),
      skipDuplicates: true
    });

    const teams = await prisma.team.findMany({
      where: { id: { in: uniqueTeamIds } },
      include: { _count: { select: { players: true } } },
      orderBy: { name: 'asc' }
    });

    res.status(201).json({ message: 'Teams added to season successfully', teams });
  } catch (error) {
    console.error('Copy teams to season error:', error);
    res.status(500).json({ error: 'Failed to copy teams to season' });
  }
};

export const getSeasonsByLeague = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { leagueId } = req.params;

    const league = await prisma.league.findUnique({ where: { id: leagueId } });
    if (!league) {
      res.status(404).json({ error: 'League not found' });
      return;
    }

    const seasons = await prisma.season.findMany({
      where: { leagueId: leagueId },
      include: {
        league: { select: { id: true, name: true, sportType: true, managerId: true } },
        _count: { select: { seasonTeams: true, games: true } }
      },
      orderBy: { startDate: 'desc' }
    });

    // Filter out DRAFT seasons unless the user is ADMIN or the manager of this league
    const filtered = seasons.filter((season) => {
      if (season.status !== 'DRAFT') return true;
      if (!req.user) return false;
      if (isAdmin(req.user)) return true;
      return league.managerId != null && league.managerId === req.user.id;
    });

    res.json(filtered);
  } catch (error) {
    console.error('Get seasons by league error:', error);
    res.status(500).json({ error: 'Failed to fetch seasons' });
  }
};
