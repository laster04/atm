import { Request, Response } from 'express';
import prisma from '../config/database.js';
import { AuthRequest, CreateTournamentSeriesRequest, UpdateTournamentSeriesRequest } from '../types/index.js';

const seriesInclude = {
  manager: { select: { id: true, name: true, email: true } },
  _count: { select: { tournaments: true } },
};

export const getAllSeries = async (req: Request, res: Response): Promise<void> => {
  try {
    const series = await prisma.tournamentSeries.findMany({
      include: seriesInclude,
      orderBy: { name: 'asc' },
    });
    res.json(series);
  } catch (error) {
    console.error('Get tournament series error:', error);
    res.status(500).json({ error: 'Failed to fetch tournament series' });
  }
};

export const getSeriesById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const series = await prisma.tournamentSeries.findUnique({
      where: { id: parseInt(id) },
      include: {
        ...seriesInclude,
        tournaments: {
          orderBy: [{ year: 'desc' }, { startDate: 'desc' }],
          include: { _count: { select: { teams: true, games: true } } },
        },
      },
    });
    if (!series) { res.status(404).json({ error: 'Tournament series not found' }); return; }
    res.json(series);
  } catch (error) {
    console.error('Get tournament series error:', error);
    res.status(500).json({ error: 'Failed to fetch tournament series' });
  }
};

export const createSeries = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, sportType, logo, description, managerId } = req.body as CreateTournamentSeriesRequest;
    if (!name) { res.status(400).json({ error: 'Name is required' }); return; }

    const series = await prisma.tournamentSeries.create({
      data: { name, sportType, logo, description, managerId: managerId ?? null },
      include: seriesInclude,
    });
    res.status(201).json(series);
  } catch (error) {
    console.error('Create tournament series error:', error);
    res.status(500).json({ error: 'Failed to create tournament series' });
  }
};

export const updateSeries = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, sportType, logo, description, managerId } = req.body as UpdateTournamentSeriesRequest;

    const series = await prisma.tournamentSeries.update({
      where: { id: parseInt(id) },
      data: {
        ...(name !== undefined && { name }),
        ...(sportType !== undefined && { sportType }),
        ...(logo !== undefined && { logo }),
        ...(description !== undefined && { description }),
        ...(managerId !== undefined && { managerId }),
      },
      include: seriesInclude,
    });
    res.json(series);
  } catch (error) {
    console.error('Update tournament series error:', error);
    res.status(500).json({ error: 'Failed to update tournament series' });
  }
};

export const deleteSeries = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.tournamentSeries.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Tournament series deleted' });
  } catch (error) {
    console.error('Delete tournament series error:', error);
    res.status(500).json({ error: 'Failed to delete tournament series' });
  }
};
