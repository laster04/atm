import { Request, Response } from 'express';
import prisma from '../config/database.js';
import emailService from '../services/emailService.js';
import { resolveInvitee } from '../services/invite.js';
import { canAdministerTeam } from '../services/access.js';
import {
  AuthRequest,
  CreateTeamRequest,
  UpdateTeamRequest,
  InviteManagerRequest,
} from '../types/index.js';
import { toNullableId } from '../utils/ids.js';
import { normalizeEmail } from '../utils/email.js';
import { Prisma } from '@prisma/client';

export const getMyTeams = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teams = await prisma.team.findMany({
      where: { managerId: req.user!.id },
      include: {
        seasonTeams: {
          include: {
            season: {
              include: {
                league: { select: { id: true, name: true, sportType: true } }
              }
            }
          }
        },
        _count: { select: { players: true } },
        manager: { select: { id: true, name: true, email: true } },
        // Only the next dated fixture on each side; the list screen shows one.
        homeGames: {
          where: { status: 'SCHEDULED', date: { not: null } },
          include: { awayTeam: { select: { id: true, name: true } } },
          orderBy: { date: 'asc' },
          take: 1
        },
        awayGames: {
          where: { status: 'SCHEDULED', date: { not: null } },
          include: { homeTeam: { select: { id: true, name: true } } },
          orderBy: { date: 'asc' },
          take: 1
        }
      },
      orderBy: { name: 'asc' }
    });

    // Map to include a convenience `season` field (most recent active or first season)
    const teamsWithSeason = teams.map(team => {
      const activeSeason = team.seasonTeams
        .map(st => st.season)
        .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
        .find(s => s.status === 'ACTIVE') || team.seasonTeams[0]?.season || null;

      const nextGame = [...team.homeGames, ...team.awayGames]
        .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime())[0] ?? null;

      return { ...team, season: activeSeason, nextGame };
    });

    res.json(teamsWithSeason);
  } catch (error) {
    console.error('Get my teams error:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
};

export const getTeamsBySeasonId = async (req: Request, res: Response): Promise<void> => {
  try {
    const { seasonId } = req.params;
    const teams = await prisma.team.findMany({
      where: { seasonTeams: { some: { seasonId: seasonId } } },
      include: {
        _count: { select: { players: true } },
        manager: { select: { id: true, name: true, email: true } }
      },
      orderBy: { name: 'asc' }
    });
    res.json(teams);
  } catch (error) {
    console.error('Get teams error:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
};

export const getTeamById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const team = await prisma.team.findUnique({
      where: { id: id },
      include: {
        seasonTeams: {
          include: {
            season: {
              include: {
                league: { select: { id: true, name: true, sportType: true } }
              }
            }
          }
        },
        players: { orderBy: { number: 'asc' } },
        manager: { select: { id: true, name: true, email: true } },
        homeGames: {
          include: {
            awayTeam: { select: { id: true, name: true } }
          },
          orderBy: { date: 'asc' }
        },
        awayGames: {
          include: {
            homeTeam: { select: { id: true, name: true } }
          },
          orderBy: { date: 'asc' }
        }
      }
    });

    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    // Undated games must sort last: `new Date(null)` is the epoch, which would
    // push every unscheduled game ahead of real fixtures (and, because the two
    // relations are concatenated, make the first N games all home games).
    const allGames = [...team.homeGames, ...team.awayGames].sort((a, b) => {
      if (!a.date && !b.date) return a.createdAt.getTime() - b.createdAt.getTime();
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    // Add convenience `season` field (most recent active or first)
    const activeSeason = team.seasonTeams
      .map(st => st.season)
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
      .find(s => s.status === 'ACTIVE') || team.seasonTeams[0]?.season || null;

    res.json({ ...team, games: allGames, season: activeSeason });
  } catch (error) {
    console.error('Get team error:', error);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
};

export const createTeam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { seasonId } = req.params;
    const { name, logo } = req.body as CreateTeamRequest;
    const managerId = toNullableId(req.body.managerId);

    if (!name) {
      res.status(400).json({ error: 'Team name is required' });
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

    // Create team and SeasonTeam association in a transaction
    const team = await prisma.$transaction(async (tx) => {
      const newTeam = await tx.team.create({
        data: {
          name,
          logo,
          managerId: managerId ?? null
        },
        include: {
          manager: { select: { id: true, name: true, email: true } }
        }
      });

      await tx.seasonTeam.create({
        data: {
          seasonId: seasonId,
          teamId: newTeam.id
        }
      });

      return newTeam;
    });

    res.status(201).json(team);
  } catch (error) {
    if ((error as Prisma.PrismaClientKnownRequestError).code === 'P2002') {
      res.status(400).json({ error: 'Team name already exists in this season' });
      return;
    }
    console.error('Create team error:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
};

export const updateTeam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, logo, primaryColor } = req.body as UpdateTeamRequest;
    const managerId = toNullableId(req.body.managerId);

    const existingTeam = await prisma.team.findUnique({
      where: { id: id },
      include: {
        seasonTeams: {
          include: {
            season: { include: { league: { select: { managerId: true } } } }
          }
        }
      }
    });

    if (!existingTeam) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }


    // requireTeamAccess lets the team's own manager edit the team, but handing the
    // team to a different manager is reserved for the league side.
    if (managerId !== undefined && managerId !== existingTeam.managerId
        && !(await canAdministerTeam(req.user!, id))) {
      res.status(403).json({ error: 'Not authorized to change the manager of this team' });
      return;
    }

    const team = await prisma.team.update({
      where: { id: id },
      data: {
        ...(name && { name }),
        ...(logo !== undefined && { logo }),
        ...(primaryColor !== undefined && { primaryColor }),
        ...(managerId !== undefined && { managerId }),
      },
      include: {
        manager: { select: { id: true, name: true, email: true } }
      }
    });

    res.json(team);
  } catch (error) {
    if ((error as Prisma.PrismaClientKnownRequestError).code === 'P2025') {
      res.status(404).json({ error: 'Team not found' });
      return;
    }
    if ((error as Prisma.PrismaClientKnownRequestError).code === 'P2002') {
      res.status(400).json({ error: 'Team name already exists' });
      return;
    }
    console.error('Update team error:', error);
    res.status(500).json({ error: 'Failed to update team' });
  }
};

export const deleteTeam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const team = await prisma.team.findUnique({
      where: { id: id },
      include: {
        seasonTeams: {
          include: {
            season: { include: { league: { select: { managerId: true } } } }
          }
        }
      }
    });

    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }


    await prisma.team.delete({ where: { id: id } });
    res.json({ message: 'Team deleted successfully' });
  } catch (error) {
    console.error('Delete team error:', error);
    res.status(500).json({ error: 'Failed to delete team' });
  }
};

export const addTeamToSeason = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, seasonId } = req.params;

    const team = await prisma.team.findUnique({ where: { id: id } });
    if (!team) {
      res.status(404).json({ error: 'Team not found' });
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

    await prisma.seasonTeam.create({
      data: {
        seasonId: seasonId,
        teamId: id
      }
    });

    res.status(201).json({ message: 'Team added to season successfully' });
  } catch (error) {
    if ((error as Prisma.PrismaClientKnownRequestError).code === 'P2002') {
      res.status(400).json({ error: 'Team is already in this season' });
      return;
    }
    console.error('Add team to season error:', error);
    res.status(500).json({ error: 'Failed to add team to season' });
  }
};

export const removeTeamFromSeason = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, seasonId } = req.params;

    const seasonTeam = await prisma.seasonTeam.findUnique({
      where: {
        seasonId_teamId: {
          seasonId: seasonId,
          teamId: id
        }
      },
      include: {
        season: { include: { league: { select: { managerId: true } } } }
      }
    });

    if (!seasonTeam) {
      res.status(404).json({ error: 'Team is not in this season' });
      return;
    }

    if (seasonTeam.season.archivedAt) {
      res.status(400).json({ error: 'Cannot modify an archived season' });
      return;
    }

    // Delete related games for this team in this season
    await prisma.$transaction(async (tx) => {
      await tx.game.deleteMany({
        where: {
          seasonId: seasonId,
          OR: [
            { homeTeamId: id },
            { awayTeamId: id }
          ]
        }
      });

      await tx.seasonTeam.delete({
        where: {
          seasonId_teamId: {
            seasonId: seasonId,
            teamId: id
          }
        }
      });
    });

    res.json({ message: 'Team removed from season successfully' });
  } catch (error) {
    console.error('Remove team from season error:', error);
    res.status(500).json({ error: 'Failed to remove team from season' });
  }
};

export const getTeamsAvailableForSeason = async (req: Request, res: Response): Promise<void> => {
  try {
    const { seasonId } = req.params;

    const season = await prisma.season.findUnique({ where: { id: seasonId } });
    if (!season) {
      res.status(404).json({ error: 'Season not found' });
      return;
    }

    // Get teams that are NOT already in this season
    const teams = await prisma.team.findMany({
      where: {
        seasonTeams: { none: { seasonId: seasonId } }
      },
      include: {
        _count: { select: { players: true } },
        manager: { select: { id: true, name: true, email: true } }
      },
      orderBy: { name: 'asc' }
    });

    res.json(teams);
  } catch (error) {
    console.error('Get available teams error:', error);
    res.status(500).json({ error: 'Failed to fetch available teams' });
  }
};

export const inviteManager = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { email: rawEmail, name, locale } = req.body as InviteManagerRequest;

    if (!rawEmail || !name) {
      res.status(400).json({ error: 'Email and name are required' });
      return;
    }

    const email = normalizeEmail(rawEmail);

    const team = await prisma.team.findUnique({
      where: { id: id },
      include: {
        seasonTeams: {
          include: {
            season: { include: { league: { select: { managerId: true } } } }
          }
        }
      }
    });
    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }


    const invitee = await resolveInvitee(email, name);

    // Assign as team manager
    const updatedTeam = await prisma.team.update({
      where: { id: id },
      data: { managerId: invitee.id },
      include: {
        seasonTeams: {
          include: {
            season: {
              include: {
                league: { select: { id: true, name: true, sportType: true } }
              }
            }
          }
        },
        players: { orderBy: { number: 'asc' } },
        manager: { select: { id: true, name: true, email: true } },
        homeGames: {
          include: { awayTeam: { select: { id: true, name: true } } },
          orderBy: { date: 'asc' }
        },
        awayGames: {
          include: { homeTeam: { select: { id: true, name: true } } },
          orderBy: { date: 'asc' }
        }
      }
    });

    // Only a freshly created account needs the set-your-password link; an existing
    // user simply gains the team relation alongside whatever they already manage.
    if (invitee.resetToken) {
      emailService.sendManagerInviteEmail(email, name, team.name, invitee.resetToken, locale).catch((err) => {
        console.error('Failed to send manager invite email:', err);
      });
    }

    const allGames = [...updatedTeam.homeGames, ...updatedTeam.awayGames].sort(
      (a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime()
    );

    // Add convenience `season` field
    const activeSeason = updatedTeam.seasonTeams
      .map(st => st.season)
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
      .find(s => s.status === 'ACTIVE') || updatedTeam.seasonTeams[0]?.season || null;

    res.status(201).json({ ...updatedTeam, games: allGames, season: activeSeason });
  } catch (error) {
    console.error('Invite manager error:', error);
    res.status(500).json({ error: 'Failed to invite manager' });
  }
};
