import { Request, Response } from 'express';
import prisma from '../config/database.js';
import { AuthRequest, CreateTournamentSeriesRequest, UpdateTournamentSeriesRequest } from '../types/index.js';
import { toNullableId } from '../utils/ids.js';
import { isAdmin } from '../services/access.js';
import { isVisibility, listedSeriesWhere } from '../services/visibility.js';
import { takesApplications } from '../services/registrationState.js';
import { prepareLogo, settleLogo } from '../services/storage/logoField.js';
import { releaseFiles, seriesFileOwners } from '../services/storage/files.js';

const seriesInclude = {
  manager: { select: { id: true, name: true, email: true } },
  _count: { select: { tournaments: true } },
};

export const getAllSeries = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const series = await prisma.tournamentSeries.findMany({
      where: listedSeriesWhere(req.user),
      include: {
        ...seriesInclude,
        tournaments: { select: { status: true, registrationWindow: { select: { open: true, deadline: true } } } },
      },
      orderBy: { name: 'asc' },
    });
    // A series is badged while any of its tournaments takes team applications.
    res.json(series.map(({ tournaments, ...row }) => ({
      ...row,
      registrationOpen: tournaments.some((t) => takesApplications(t.registrationWindow, t.status === 'COMPLETED')),
    })));
  } catch (error) {
    console.error('Get tournament series error:', error);
    res.status(500).json({ error: 'Failed to fetch tournament series' });
  }
};

export const getSeriesById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const series = await prisma.tournamentSeries.findUnique({
      where: { id: id },
      include: {
        ...seriesInclude,
        tournaments: {
          orderBy: [{ year: 'desc' }, { startDate: 'desc' }],
          include: {
            _count: { select: { teams: true, games: true } },
            registrationWindow: { select: { open: true, deadline: true } },
          },
        },
      },
    });
    if (!series) { res.status(404).json({ error: 'Tournament series not found' }); return; }
    res.json({
      ...series,
      tournaments: series.tournaments.map(({ registrationWindow, ...tournament }) => ({
        ...tournament,
        registrationOpen: takesApplications(registrationWindow, tournament.status === 'COMPLETED'),
      })),
    });
  } catch (error) {
    console.error('Get tournament series error:', error);
    res.status(500).json({ error: 'Failed to fetch tournament series' });
  }
};

export const createSeries = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, sportType, logo, description, visibility } = req.body as CreateTournamentSeriesRequest;
    const managerId = toNullableId(req.body.managerId);
    if (!name) { res.status(400).json({ error: 'Name is required' }); return; }
    if (visibility !== undefined && !isVisibility(visibility)) { res.status(400).json({ error: 'Invalid visibility' }); return; }

    // The creator owns the series; only an admin may hand it to someone else.
    // Series and tournaments are unlimited; plans limit teams per tournament.
    const ownerId = isAdmin(req.user!) ? (managerId ?? null) : req.user!.id;

    const storedLogo = await prepareLogo(logo, null, req.user!.id);

    const series = await prisma.tournamentSeries.create({
      data: { name, sportType, logo: storedLogo, description, managerId: ownerId, ...(visibility && { visibility }) },
      include: seriesInclude,
    });
    await settleLogo({ type: 'TOURNAMENT_SERIES', id: series.id }, storedLogo);
    res.status(201).json(series);
  } catch (error) {
    console.error('Create tournament series error:', error);
    res.status(500).json({ error: 'Failed to create tournament series' });
  }
};

export const updateSeries = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, sportType, logo, description, visibility } = req.body as UpdateTournamentSeriesRequest;
    const managerId = toNullableId(req.body.managerId);
    if (visibility !== undefined && !isVisibility(visibility)) { res.status(400).json({ error: 'Invalid visibility' }); return; }

    const current = await prisma.tournamentSeries.findUnique({ where: { id: id }, select: { logo: true } });
    if (!current) { res.status(404).json({ error: 'Tournament series not found' }); return; }
    const storedLogo = await prepareLogo(logo, current.logo, req.user!.id);

    const series = await prisma.tournamentSeries.update({
      where: { id: id },
      data: {
        ...(name !== undefined && { name }),
        ...(sportType !== undefined && { sportType }),
        ...(storedLogo !== undefined && { logo: storedLogo }),
        ...(description !== undefined && { description }),
        ...(managerId !== undefined && { managerId }),
        ...(visibility !== undefined && { visibility }),
      },
      include: seriesInclude,
    });
    await settleLogo({ type: 'TOURNAMENT_SERIES', id: series.id }, storedLogo);
    res.json(series);
  } catch (error) {
    console.error('Update tournament series error:', error);
    res.status(500).json({ error: 'Failed to update tournament series' });
  }
};

export const deleteSeries = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const owners = await seriesFileOwners(id);
    await prisma.tournamentSeries.delete({ where: { id: id } });
    await releaseFiles(owners);
    res.json({ message: 'Tournament series deleted' });
  } catch (error) {
    console.error('Delete tournament series error:', error);
    res.status(500).json({ error: 'Failed to delete tournament series' });
  }
};
