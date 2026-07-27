import { Request, Response } from 'express';
import prisma from '../config/database.js';
import {
  AuthRequest,
  CreateTournamentGameRequest,
  UpdateTournamentGameRequest,
  CreateTournamentGameStatisticRequest,
  UpdateTournamentGameStatisticRequest,
} from '../types/index.js';
import { advancePlayoffBracket, resolvePlayoffSeeds } from './tournamentPlayoffController.js';

const gameInclude = {
  homeTeam: { select: { id: true, name: true, logo: true, primaryColor: true, country: true } },
  awayTeam: { select: { id: true, name: true, logo: true, primaryColor: true, country: true } },
  group: { select: { id: true, name: true } },
};

// ── Games ──────────────────────────────────────────────────

export const getGamesByTournament = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tournamentId } = req.params;
    const { phase, groupId } = req.query;

    const games = await prisma.tournamentGame.findMany({
      where: {
        tournamentId: parseInt(tournamentId),
        ...(phase && { phase: phase as any }),
        ...(groupId && { groupId: parseInt(groupId as string) }),
      },
      include: gameInclude,
      orderBy: [{ phase: 'asc' }, { date: 'asc' }],
    });
    res.json(games);
  } catch (error) {
    console.error('Get tournament games error:', error);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
};

export const getGameById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const game = await prisma.tournamentGame.findUnique({
      where: { id: parseInt(id) },
      include: {
        ...gameInclude,
        statistics: {
          include: { player: { include: { team: true } } },
        },
        tournament: { select: { id: true, name: true, seriesId: true } },
      },
    });
    if (!game) { res.status(404).json({ error: 'Game not found' }); return; }
    res.json(game);
  } catch (error) {
    console.error('Get tournament game error:', error);
    res.status(500).json({ error: 'Failed to fetch game' });
  }
};

export const createGame = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tournamentId } = req.params;
    const { phase, groupId, homeTeamId, awayTeamId, date, location, bracketSlot, note } =
      req.body as CreateTournamentGameRequest;

    if (!phase) { res.status(400).json({ error: 'Phase is required' }); return; }

    const game = await prisma.tournamentGame.create({
      data: {
        phase,
        tournamentId: parseInt(tournamentId),
        groupId: groupId ?? null,
        homeTeamId: homeTeamId ?? null,
        awayTeamId: awayTeamId ?? null,
        date: date ? new Date(date) : null,
        location: location ?? null,
        bracketSlot: bracketSlot ?? null,
        note: note ?? null,
        status: 'SCHEDULED',
      },
      include: gameInclude,
    });
    res.status(201).json(game);
  } catch (error) {
    console.error('Create tournament game error:', error);
    res.status(500).json({ error: 'Failed to create game' });
  }
};

export const updateGame = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { homeTeamId, awayTeamId, homeScore, awayScore, date, location, status, bracketSlot, note } =
      req.body as UpdateTournamentGameRequest;

    const existing = await prisma.tournamentGame.findUnique({ where: { id: parseInt(id) } });
    if (!existing) { res.status(404).json({ error: 'Game not found' }); return; }

    // A playoff slot generated before its teams are known (seed-only, see
    // homeSeed/awaySeed) can't have a result recorded until both sides are
    // resolved to real teams — otherwise "who won" is undefined.
    if (existing.phase !== 'GROUP') {
      const effectiveHomeTeamId = homeTeamId !== undefined ? homeTeamId : existing.homeTeamId;
      const effectiveAwayTeamId = awayTeamId !== undefined ? awayTeamId : existing.awayTeamId;
      const settingResult = status === 'COMPLETED'
        || (homeScore !== undefined && homeScore !== null)
        || (awayScore !== undefined && awayScore !== null);
      if (settingResult && (effectiveHomeTeamId == null || effectiveAwayTeamId == null)) {
        res.status(400).json({ error: 'Both teams must be known before recording a playoff result' });
        return;
      }
    }

    const game = await prisma.tournamentGame.update({
      where: { id: parseInt(id) },
      data: {
        ...(homeTeamId !== undefined && { homeTeamId }),
        ...(awayTeamId !== undefined && { awayTeamId }),
        ...(homeScore !== undefined && { homeScore }),
        ...(awayScore !== undefined && { awayScore }),
        ...(date !== undefined && { date: date ? new Date(date) : null }),
        ...(location !== undefined && { location }),
        ...(status !== undefined && { status }),
        ...(bracketSlot !== undefined && { bracketSlot }),
        ...(note !== undefined && { note }),
      },
      include: gameInclude,
    });
    if (game.phase === 'GROUP' && game.status === 'COMPLETED') {
      await resolvePlayoffSeeds(game.tournamentId);
    }
    await advancePlayoffBracket(game);
    res.json(game);
  } catch (error) {
    console.error('Update tournament game error:', error);
    res.status(500).json({ error: 'Failed to update game' });
  }
};

export const deleteGame = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.tournamentGame.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Game deleted' });
  } catch (error) {
    console.error('Delete tournament game error:', error);
    res.status(500).json({ error: 'Failed to delete game' });
  }
};

// ── Statistics ─────────────────────────────────────────────

export const getStatsByGame = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const stats = await prisma.tournamentGameStatistic.findMany({
      where: { gameId: parseInt(id) },
      include: { player: { include: { team: true } } },
    });
    res.json(stats);
  } catch (error) {
    console.error('Get tournament game stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
};

export const createStatistic = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { playerId, goals, assists } = req.body as CreateTournamentGameStatisticRequest;
    if (!playerId) { res.status(400).json({ error: 'playerId is required' }); return; }

    const existing = await prisma.tournamentGameStatistic.findUnique({
      where: { gameId_playerId: { gameId: parseInt(id), playerId } },
    });
    if (existing) {
      res.status(409).json({ error: 'Statistic already exists for this player in this game' });
      return;
    }

    const stat = await prisma.tournamentGameStatistic.create({
      data: { gameId: parseInt(id), playerId, goals, assists },
      include: { player: true },
    });
    res.status(201).json(stat);
  } catch (error) {
    console.error('Create tournament statistic error:', error);
    res.status(500).json({ error: 'Failed to create statistic' });
  }
};

export const updateStatistic = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { statId } = req.params;
    const { goals, assists } = req.body as UpdateTournamentGameStatisticRequest;

    const stat = await prisma.tournamentGameStatistic.update({
      where: { id: parseInt(statId) },
      data: {
        ...(goals !== undefined && { goals }),
        ...(assists !== undefined && { assists }),
      },
      include: { player: true },
    });
    res.json(stat);
  } catch (error) {
    console.error('Update tournament statistic error:', error);
    res.status(500).json({ error: 'Failed to update statistic' });
  }
};

export const deleteStatistic = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { statId } = req.params;
    await prisma.tournamentGameStatistic.delete({ where: { id: parseInt(statId) } });
    res.json({ message: 'Statistic deleted' });
  } catch (error) {
    console.error('Delete tournament statistic error:', error);
    res.status(500).json({ error: 'Failed to delete statistic' });
  }
};

export const getTopScorersByTournament = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tournamentId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;

    const stats = await prisma.tournamentGameStatistic.findMany({
      where: { game: { tournamentId: parseInt(tournamentId) } },
      include: { player: { include: { team: true } } },
    });

    const playerMap = new Map<number, { player: any; goals: number; assists: number; points: number; gamesPlayed: number }>();
    for (const s of stats) {
      const existing = playerMap.get(s.playerId);
      if (existing) {
        existing.goals += s.goals ?? 0;
        existing.assists += s.assists ?? 0;
        existing.points += (s.goals ?? 0) + (s.assists ?? 0);
        existing.gamesPlayed++;
      } else {
        playerMap.set(s.playerId, {
          player: s.player,
          goals: s.goals ?? 0,
          assists: s.assists ?? 0,
          points: (s.goals ?? 0) + (s.assists ?? 0),
          gamesPlayed: 1,
        });
      }
    }

    const sorted = Array.from(playerMap.values())
      .sort((a, b) => b.points - a.points || b.goals - a.goals)
      .slice(0, limit);

    res.json(sorted);
  } catch (error) {
    console.error('Get top scorers error:', error);
    res.status(500).json({ error: 'Failed to fetch top scorers' });
  }
};
