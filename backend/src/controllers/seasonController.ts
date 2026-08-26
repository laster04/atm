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

type StandingGame = {
  homeTeamId: number;
  awayTeamId: number;
  homeScore: number | null;
  awayScore: number | null;
};

export function computeStandings(teams: StandingTeamRef[], games: StandingGame[]): Standing[] {
  return teams.map(team => {
    let wins = 0, losses = 0, draws = 0, goalsFor = 0, goalsAgainst = 0;

    games.forEach(game => {
      if (game.homeTeamId === team.id) {
        goalsFor += game.homeScore || 0;
        goalsAgainst += game.awayScore || 0;
        if ((game.homeScore || 0) > (game.awayScore || 0)) wins++;
        else if ((game.homeScore || 0) < (game.awayScore || 0)) losses++;
        else draws++;
      } else if (game.awayTeamId === team.id) {
        goalsFor += game.awayScore || 0;
        goalsAgainst += game.homeScore || 0;
        if ((game.awayScore || 0) > (game.homeScore || 0)) wins++;
        else if ((game.awayScore || 0) < (game.homeScore || 0)) losses++;
        else draws++;
      }
    });

    const points = wins * 2 + draws;
    const played = wins + losses + draws;
    const goalDifference = goalsFor - goalsAgainst;

    return {
      team,
      played,
      wins,
      draws,
      losses,
      goalsFor,
      goalsAgainst,
      goalDifference,
      points
    };
  });
}

export function sortStandings(standings: Standing[]): Standing[] {
  return [...standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    return b.goalsFor - a.goalsFor;
  });
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
      if (req.user.role === 'ADMIN') return true;
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
      where: { id: parseInt(id) },
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
    const { name, leagueId, startDate, endDate, status } = req.body as CreateSeasonRequest;

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

    // Season managers can only create seasons in their own leagues
    if (req.user!.role === 'SEASON_MANAGER' && league.managerId !== req.user!.id) {
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
    const { name, leagueId, startDate, endDate, status } = req.body as UpdateSeasonRequest;

    const existingSeason = await prisma.season.findUnique({
      where: { id: parseInt(id) },
      include: { league: { select: { managerId: true } } }
    });
    if (!existingSeason) {
      res.status(404).json({ error: 'Season not found' });
      return;
    }

    // Season managers can only update seasons in their own leagues
    if (req.user!.role === 'SEASON_MANAGER' && existingSeason.league.managerId !== req.user!.id) {
      res.status(403).json({ error: 'Not authorized to update this season' });
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
      if (req.user!.role === 'SEASON_MANAGER' && league.managerId !== req.user!.id) {
        res.status(403).json({ error: 'Not authorized to move season to this league' });
        return;
      }
    }

    const season = await prisma.season.update({
      where: { id: parseInt(id) },
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
    const seasonToDelete = await prisma.season.findUnique({ where: { id: parseInt(id) } });
    if (!seasonToDelete) {
      res.status(404).json({ error: 'Season not found' });
      return;
    }
    if (seasonToDelete.archivedAt) {
      res.status(400).json({ error: 'Cannot delete an archived season' });
      return;
    }

    // Season managers can only delete seasons in their own leagues that haven't started yet
    if (req.user!.role === 'SEASON_MANAGER') {
      const season = await prisma.season.findUnique({
        where: { id: parseInt(id) },
        include: { league: { select: { managerId: true } } }
      });
      if (!season) {
        res.status(404).json({ error: 'Season not found' });
        return;
      }
      if (season.league.managerId !== req.user!.id) {
        res.status(403).json({ error: 'Not authorized to delete this season' });
        return;
      }
      if (new Date(season.startDate) <= new Date()) {
        res.status(403).json({ error: 'Cannot delete a season that has already started' });
        return;
      }
    }

    await prisma.season.delete({ where: { id: parseInt(id) } });
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
    const seasonId = parseInt(id);

    const season = await prisma.season.findUnique({ where: { id: seasonId } });
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

    const standings = sortStandings(computeStandings(teams, games));

    res.json(standings);
  } catch (error) {
    console.error('Get standings error:', error);
    res.status(500).json({ error: 'Failed to fetch standings' });
  }
};

export const getTeamStanding = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, teamId } = req.params;
    const seasonId = parseInt(id);
    const teamIdNum = parseInt(teamId);

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
    const allStandings = sortStandings(computeStandings(allTeams, games));

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
    const seasonId = parseInt(id);

    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      include: { league: { select: { managerId: true } } }
    });
    if (!season) {
      res.status(404).json({ error: 'Season not found' });
      return;
    }

    if (req.user!.role === 'SEASON_MANAGER' && season.league.managerId !== req.user!.id) {
      res.status(403).json({ error: 'Not authorized to archive this season' });
      return;
    }
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
      const standings = sortStandings(computeStandings(teams, completedGames));

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

      const playerAgg = new Map<number, {
        playerId: number;
        playerName: string;
        playerNumber: number | null;
        teamId: number;
        teamName: string;
        gamesPlayed: number;
        goals: number;
        assists: number;
      }>();

      for (const stat of stats) {
        const existing = playerAgg.get(stat.playerId);
        if (existing) {
          existing.goals += stat.goals || 0;
          existing.assists += stat.assists || 0;
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
            assists: stat.assists || 0
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
            assists: p.assists
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
      const archivedGoals = Array.from(playerAgg.values()).reduce((sum, p) => sum + p.goals, 0);
      const archivedAssists = Array.from(playerAgg.values()).reduce((sum, p) => sum + p.assists, 0);
      if (archivedGoals !== sourceGoals || archivedAssists !== sourceAssists) {
        throw new Error('Archive verification failed: goals/assists total mismatch');
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
    const seasonId = parseInt(id);

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
        id: row.teamId ?? -row.id,
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

export const getSeasonsByLeague = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { leagueId } = req.params;

    const league = await prisma.league.findUnique({ where: { id: parseInt(leagueId) } });
    if (!league) {
      res.status(404).json({ error: 'League not found' });
      return;
    }

    const seasons = await prisma.season.findMany({
      where: { leagueId: parseInt(leagueId) },
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
      if (req.user.role === 'ADMIN') return true;
      return league.managerId != null && league.managerId === req.user.id;
    });

    res.json(filtered);
  } catch (error) {
    console.error('Get seasons by league error:', error);
    res.status(500).json({ error: 'Failed to fetch seasons' });
  }
};
