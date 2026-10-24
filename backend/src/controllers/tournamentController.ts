import { Request, Response } from 'express';
import prisma from '../config/database.js';
import { AuthRequest, CreateTournamentRequest, UpdateTournamentRequest } from '../types/index.js';
import { Prisma, TournamentStatus } from '@prisma/client';
import { computeGroupStandings } from '../utils/tournamentStandings.js';
import { releaseFiles, tournamentFileOwners } from '../services/storage/files.js';
import { checkScoringOverride } from '../services/scoring/policy.js';
import { teamAllowance } from '../services/plans/tournamentPlan.js';
import { publicExtras } from '../services/tournaments/plus.js';

const tournamentInclude = {
  series: { select: { id: true, name: true, sportType: true, logo: true, visibility: true } },
  _count: { select: { teams: true, groups: true, games: true } },
};

export const getTournamentsBySeriesId = async (req: Request, res: Response): Promise<void> => {
  try {
    const { seriesId } = req.params;
    const tournaments = await prisma.tournament.findMany({
      where: { seriesId: seriesId },
      include: tournamentInclude,
      orderBy: [{ year: 'desc' }, { startDate: 'desc' }],
    });
    res.json(tournaments);
  } catch (error) {
    console.error('Get tournaments error:', error);
    res.status(500).json({ error: 'Failed to fetch tournaments' });
  }
};

export const getTournamentById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const tournament = await prisma.tournament.findUnique({
      where: { id: id },
      include: {
        series: { select: { id: true, name: true, sportType: true, logo: true, visibility: true } },
        teams: { orderBy: { name: 'asc' } },
        groups: {
          include: {
            teams: { include: { team: true } },
          },
          orderBy: { name: 'asc' },
        },
        games: {
          include: {
            homeTeam: { select: { id: true, name: true, logo: true, primaryColor: true, country: true } },
            awayTeam: { select: { id: true, name: true, logo: true, primaryColor: true, country: true } },
            group: { select: { id: true, name: true } },
          },
          orderBy: [{ phase: 'asc' }, { date: 'asc' }],
        },
      },
    });
    if (!tournament) { res.status(404).json({ error: 'Tournament not found' }); return; }
    // Partners, documents and how much ATM brand the public page carries.
    const allowance = await teamAllowance(id);
    const plus = await publicExtras(id, allowance?.plan ?? null);
    res.json({ ...tournament, ...plus });
  } catch (error) {
    console.error('Get tournament error:', error);
    res.status(500).json({ error: 'Failed to fetch tournament' });
  }
};

export const createTournament = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { seriesId } = req.params;
    const { name, year, startDate, endDate, location } = req.body as CreateTournamentRequest;
    if (!name) { res.status(400).json({ error: 'Name is required' }); return; }

    const series = await prisma.tournamentSeries.findUnique({ where: { id: seriesId } });
    if (!series) { res.status(404).json({ error: 'Tournament series not found' }); return; }

    const tournament = await prisma.tournament.create({
      data: {
        name,
        year: year ?? null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        location: location ?? null,
        seriesId: seriesId,
      },
      include: tournamentInclude,
    });
    res.status(201).json(tournament);
  } catch (error) {
    console.error('Create tournament error:', error);
    res.status(500).json({ error: 'Failed to create tournament' });
  }
};

export const updateTournament = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, year, status, startDate, endDate, location } = req.body as UpdateTournamentRequest;
    const scoring = checkScoringOverride((req.body as UpdateTournamentRequest).scoring);
    if (!scoring.ok) {
      res.status(400).json({ error: scoring.error });
      return;
    }

    const tournament = await prisma.tournament.update({
      where: { id: id },
      data: {
        ...(name !== undefined && { name }),
        ...(year !== undefined && { year }),
        ...(status !== undefined && { status }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(location !== undefined && { location }),
        ...(scoring.value !== undefined && {
          scoring: scoring.value === null ? Prisma.JsonNull : (scoring.value as Prisma.InputJsonValue),
        }),
      },
      include: tournamentInclude,
    });
    res.json(tournament);
  } catch (error) {
    console.error('Update tournament error:', error);
    res.status(500).json({ error: 'Failed to update tournament' });
  }
};

export const deleteTournament = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const owners = await tournamentFileOwners(id);
    await prisma.tournament.delete({ where: { id: id } });
    await releaseFiles(owners);
    res.json({ message: 'Tournament deleted' });
  } catch (error) {
    console.error('Delete tournament error:', error);
    res.status(500).json({ error: 'Failed to delete tournament' });
  }
};

export const getTournamentStandings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { groupId } = req.query;
    const parsedGroupId = groupId ? groupId as string : null;

    const standings = await computeGroupStandings(id, parsedGroupId);
    res.json(standings);
  } catch (error) {
    console.error('Get tournament standings error:', error);
    res.status(500).json({ error: 'Failed to fetch standings' });
  }
};
