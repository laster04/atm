import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/database.js';
import {
  AuthRequest,
  CreateTournamentTeamRequest,
  UpdateTournamentTeamRequest,
  CreateTournamentPlayerRequest,
  UpdateTournamentPlayerRequest,
} from '../types/index.js';
import { checkPosition } from '../utils/playerPositions.js';
import { prepareLogo, settleLogo } from '../services/storage/logoField.js';
import { releaseFiles } from '../services/storage/files.js';
import { assertTeamSlot, PlanLimitError, planLimitBody } from '../services/plans/tournamentPlan.js';
import { canSeeFullTournamentRoster, toPublicTournamentPlayer } from '../services/publicView.js';

// ── Teams ──────────────────────────────────────────────────

export const getTeamsByTournament = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tournamentId } = req.params;
    const teams = await prisma.tournamentTeam.findMany({
      where: { tournamentId: tournamentId },
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

export const getTeamById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const team = await prisma.tournamentTeam.findUnique({
      where: { id: id },
      include: {
        players: { orderBy: [{ number: 'asc' }, { name: 'asc' }] },
        groupTeams: { include: { group: true } },
        tournament: { select: { id: true, name: true, seriesId: true } },
      },
    });
    if (!team) { res.status(404).json({ error: 'Team not found' }); return; }
    // Visitors get the roster without birth years and notes, as on a league.
    if (!(await canSeeFullTournamentRoster(req.user, team.id))) {
      res.json({ ...team, players: team.players.map(toPublicTournamentPlayer) });
      return;
    }
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
    const storedLogo = await prepareLogo(logo, null, req.user!.id);

    const team = await prisma.$transaction(async (tx) => {
      await assertTeamSlot(tx, tournamentId);
      return tx.tournamentTeam.create({
        data: { name, logo: storedLogo, primaryColor, country, tournamentId: tournamentId },
      });
    });
    await settleLogo({ type: 'TOURNAMENT_TEAM', id: team.id }, storedLogo);
    res.status(201).json(team);
  } catch (error) {
    if (error instanceof PlanLimitError) {
      res.status(409).json(planLimitBody(error));
      return;
    }
    console.error('Create tournament team error:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
};

export const updateTeam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, logo, primaryColor, country } = req.body as UpdateTournamentTeamRequest;
    const current = await prisma.tournamentTeam.findUnique({ where: { id: id }, select: { logo: true } });
    if (!current) { res.status(404).json({ error: 'Team not found' }); return; }
    const storedLogo = await prepareLogo(logo, current.logo, req.user!.id);

    const team = await prisma.tournamentTeam.update({
      where: { id: id },
      data: {
        ...(name !== undefined && { name }),
        ...(storedLogo !== undefined && { logo: storedLogo }),
        ...(primaryColor !== undefined && { primaryColor }),
        ...(country !== undefined && { country }),
      },
    });
    await settleLogo({ type: 'TOURNAMENT_TEAM', id: team.id }, storedLogo);
    res.json(team);
  } catch (error) {
    console.error('Update tournament team error:', error);
    res.status(500).json({ error: 'Failed to update team' });
  }
};

export const deleteTeam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.tournamentTeam.delete({ where: { id: id } });
    await releaseFiles([{ type: 'TOURNAMENT_TEAM', id }]);
    res.json({ message: 'Team deleted' });
  } catch (error) {
    console.error('Delete tournament team error:', error);
    res.status(500).json({ error: 'Failed to delete team' });
  }
};

// ── Players ────────────────────────────────────────────────

export const getPlayersByTeam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { teamId } = req.params;
    const players = await prisma.tournamentPlayer.findMany({
      where: { teamId: teamId },
      orderBy: [{ number: 'asc' }, { name: 'asc' }],
    });
    if (!(await canSeeFullTournamentRoster(req.user, teamId))) {
      res.json(players.map(toPublicTournamentPlayer));
      return;
    }
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

    const team = await prisma.tournamentTeam.findUnique({
      where: { id: teamId },
      select: { tournament: { select: { series: { select: { sportType: true } } } } },
    });
    if (!team) { res.status(404).json({ error: 'Team not found' }); return; }
    const positionCheck = checkPosition(position, [team.tournament.series.sportType]);
    if (!positionCheck.ok) { res.status(400).json({ error: positionCheck.error }); return; }

    const player = await prisma.tournamentPlayer.create({
      data: { name, number, position: positionCheck.value ?? null, bornYear, note, teamId: teamId },
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

    let positionValue: Prisma.TournamentPlayerUpdateInput['position'];
    if (position !== undefined) {
      const current = await prisma.tournamentPlayer.findUnique({
        where: { id: id },
        select: { team: { select: { tournament: { select: { series: { select: { sportType: true } } } } } } },
      });
      if (!current) { res.status(404).json({ error: 'Player not found' }); return; }
      const positionCheck = checkPosition(position, [current.team.tournament.series.sportType]);
      if (!positionCheck.ok) { res.status(400).json({ error: positionCheck.error }); return; }
      positionValue = positionCheck.value;
    }

    const player = await prisma.tournamentPlayer.update({
      where: { id: id },
      data: {
        ...(name !== undefined && { name }),
        ...(number !== undefined && { number }),
        ...(positionValue !== undefined && { position: positionValue }),
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
    await prisma.tournamentPlayer.delete({ where: { id: id } });
    res.json({ message: 'Player deleted' });
  } catch (error) {
    console.error('Delete tournament player error:', error);
    res.status(500).json({ error: 'Failed to delete player' });
  }
};
