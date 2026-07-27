import { Request, Response } from 'express';
import prisma from '../config/database.js';
import {
  AuthRequest,
  CreateTournamentTeamRequest,
  UpdateTournamentTeamRequest,
  CreateTournamentPlayerRequest,
  UpdateTournamentPlayerRequest,
} from '../types/index.js';

// ── Teams ──────────────────────────────────────────────────

export const getTeamsByTournament = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tournamentId } = req.params;
    const teams = await prisma.tournamentTeam.findMany({
      where: { tournamentId: parseInt(tournamentId) },
      include: {
        _count: { select: { players: true } },
        groupTeams: { include: { group: { select: { id: true, name: true } } } },
      },
      orderBy: { name: 'asc' },
    });
    res.json(teams);
  } catch (error) {
    console.error('Get tournament teams error:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
};

export const getTeamById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const team = await prisma.tournamentTeam.findUnique({
      where: { id: parseInt(id) },
      include: {
        players: { orderBy: [{ number: 'asc' }, { name: 'asc' }] },
        groupTeams: { include: { group: true } },
        tournament: { select: { id: true, name: true, seriesId: true } },
      },
    });
    if (!team) { res.status(404).json({ error: 'Team not found' }); return; }
    res.json(team);
  } catch (error) {
    console.error('Get tournament team error:', error);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
};

export const createTeam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tournamentId } = req.params;
    const { name, logo, primaryColor, country } = req.body as CreateTournamentTeamRequest;
    if (!name) { res.status(400).json({ error: 'Name is required' }); return; }

    const team = await prisma.tournamentTeam.create({
      data: { name, logo, primaryColor, country, tournamentId: parseInt(tournamentId) },
    });
    res.status(201).json(team);
  } catch (error) {
    console.error('Create tournament team error:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
};

export const updateTeam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, logo, primaryColor, country } = req.body as UpdateTournamentTeamRequest;

    const team = await prisma.tournamentTeam.update({
      where: { id: parseInt(id) },
      data: {
        ...(name !== undefined && { name }),
        ...(logo !== undefined && { logo }),
        ...(primaryColor !== undefined && { primaryColor }),
        ...(country !== undefined && { country }),
      },
    });
    res.json(team);
  } catch (error) {
    console.error('Update tournament team error:', error);
    res.status(500).json({ error: 'Failed to update team' });
  }
};

export const deleteTeam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.tournamentTeam.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Team deleted' });
  } catch (error) {
    console.error('Delete tournament team error:', error);
    res.status(500).json({ error: 'Failed to delete team' });
  }
};

// ── Players ────────────────────────────────────────────────

export const getPlayersByTeam = async (req: Request, res: Response): Promise<void> => {
  try {
    const { teamId } = req.params;
    const players = await prisma.tournamentPlayer.findMany({
      where: { teamId: parseInt(teamId) },
      orderBy: [{ number: 'asc' }, { name: 'asc' }],
    });
    res.json(players);
  } catch (error) {
    console.error('Get tournament players error:', error);
    res.status(500).json({ error: 'Failed to fetch players' });
  }
};

export const createPlayer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { teamId } = req.params;
    const { name, number, position, bornYear, note } = req.body as CreateTournamentPlayerRequest;
    if (!name) { res.status(400).json({ error: 'Name is required' }); return; }

    const player = await prisma.tournamentPlayer.create({
      data: { name, number, position, bornYear, note, teamId: parseInt(teamId) },
    });
    res.status(201).json(player);
  } catch (error) {
    console.error('Create tournament player error:', error);
    res.status(500).json({ error: 'Failed to create player' });
  }
};

export const updatePlayer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, number, position, bornYear, note } = req.body as UpdateTournamentPlayerRequest;

    const player = await prisma.tournamentPlayer.update({
      where: { id: parseInt(id) },
      data: {
        ...(name !== undefined && { name }),
        ...(number !== undefined && { number }),
        ...(position !== undefined && { position }),
        ...(bornYear !== undefined && { bornYear }),
        ...(note !== undefined && { note }),
      },
    });
    res.json(player);
  } catch (error) {
    console.error('Update tournament player error:', error);
    res.status(500).json({ error: 'Failed to update player' });
  }
};

export const deletePlayer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.tournamentPlayer.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Player deleted' });
  } catch (error) {
    console.error('Delete tournament player error:', error);
    res.status(500).json({ error: 'Failed to delete player' });
  }
};
