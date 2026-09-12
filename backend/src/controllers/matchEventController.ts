import { Request, Response } from 'express';
import { MatchEventType, Prisma } from '@prisma/client';
import prisma from '../config/database.js';
import { AuthRequest } from '../types/index.js';
import { recomputeGameFromEvents } from '../services/matchEvents/derive.js';

const EVENT_TYPES = Object.values(MatchEventType);

interface EventBody {
  type?: string;
  period?: number;
  minute?: number | null;
  second?: number | null;
  teamId?: string;
  playerId?: string | null;
  assistPlayerId?: string | null;
  secondaryAssistPlayerId?: string | null;
  penaltyMinutes?: number | null;
  penaltyType?: string | null;
  note?: string | null;
}

type ValidationError = { status: number; error: string };

const isInt = (value: unknown): value is number => Number.isInteger(value);

/**
 * Checks an event against the game it belongs to. Everything here is a rule
 * about the match itself rather than about permissions: which teams are playing,
 * whose players may appear, and which fields the event type allows.
 */
const validate = async (
  body: EventBody,
  game: { id: string; homeTeamId: string; awayTeamId: string }
): Promise<ValidationError | null> => {
  if (!body.type || !EVENT_TYPES.includes(body.type as MatchEventType)) {
    return { status: 400, error: `type must be one of ${EVENT_TYPES.join(', ')}` };
  }
  if (!body.teamId) return { status: 400, error: 'teamId is required' };
  if (body.teamId !== game.homeTeamId && body.teamId !== game.awayTeamId) {
    return { status: 400, error: 'teamId must be one of the teams playing this game' };
  }
  if (body.period !== undefined && (!isInt(body.period) || body.period < 1)) {
    return { status: 400, error: 'period must be a whole number of 1 or more' };
  }
  for (const field of ['minute', 'second'] as const) {
    const value = body[field];
    if (value !== undefined && value !== null && (!isInt(value) || value < 0)) {
      return { status: 400, error: `${field} must be zero or more` };
    }
  }

  const credited = [body.playerId, body.assistPlayerId, body.secondaryAssistPlayerId].filter(
    (id): id is string => typeof id === 'string' && id.length > 0
  );

  // A player cannot assist their own goal, or assist it twice.
  if (new Set(credited).size !== credited.length) {
    return { status: 400, error: 'A player may appear only once on the same event' };
  }

  if (credited.length > 0) {
    const players = await prisma.player.findMany({
      where: { id: { in: credited } },
      select: { id: true, teamId: true },
    });
    if (players.length !== credited.length) {
      return { status: 404, error: 'Player not found' };
    }
    // Credit always goes to a player on the team the event belongs to. An own
    // goal is recorded against the team that benefits, with no scorer named.
    if (players.some(player => player.teamId !== body.teamId)) {
      return { status: 400, error: 'Players credited on an event must belong to that team' };
    }
  }

  if (body.type === 'GOAL') {
    if (body.penaltyMinutes != null) {
      return { status: 400, error: 'penaltyMinutes belongs on a PENALTY event' };
    }
  } else if (body.type === 'PENALTY') {
    if (body.assistPlayerId || body.secondaryAssistPlayerId) {
      return { status: 400, error: 'Assists belong on a GOAL event' };
    }
    if (body.penaltyMinutes != null && (!isInt(body.penaltyMinutes) || body.penaltyMinutes < 0)) {
      return { status: 400, error: 'penaltyMinutes must be zero or more' };
    }
  } else if (body.assistPlayerId || body.secondaryAssistPlayerId || body.penaltyMinutes != null) {
    return { status: 400, error: `${body.type} events carry no assists or penalty minutes` };
  }

  return null;
};

const toData = (body: EventBody) => ({
  type: body.type as MatchEventType,
  period: body.period ?? 1,
  minute: body.minute ?? null,
  second: body.second ?? null,
  playerId: body.playerId || null,
  assistPlayerId: body.assistPlayerId || null,
  secondaryAssistPlayerId: body.secondaryAssistPlayerId || null,
  penaltyMinutes: body.penaltyMinutes ?? null,
  penaltyType: body.penaltyType || null,
  note: body.note || null,
});

const eventInclude = {
  team: { select: { id: true, name: true, logo: true, primaryColor: true } },
  player: { select: { id: true, name: true, number: true } },
  assistPlayer: { select: { id: true, name: true, number: true } },
  secondaryAssistPlayer: { select: { id: true, name: true, number: true } },
} satisfies Prisma.MatchEventInclude;

const orderedByClock: Prisma.MatchEventOrderByWithRelationInput[] = [
  { period: 'asc' },
  { minute: 'asc' },
  { second: 'asc' },
  { createdAt: 'asc' },
];

export const getEventsByGameId = async (req: Request, res: Response): Promise<void> => {
  try {
    const { gameId } = req.params;
    const events = await prisma.matchEvent.findMany({
      where: { gameId },
      include: eventInclude,
      orderBy: orderedByClock,
    });
    res.json(events);
  } catch (error) {
    console.error('Get match events error:', error);
    res.status(500).json({ error: 'Failed to fetch match events' });
  }
};

export const createEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { gameId } = req.params;
    const body = req.body as EventBody;

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true, homeTeamId: true, awayTeamId: true, eventsAuthoritative: true },
    });
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    const invalid = await validate(body, game);
    if (invalid) {
      res.status(invalid.status).json({ error: invalid.error });
      return;
    }

    // Recording the first event hands the game's figures over to the event log,
    // which would silently overwrite anything entered by hand. Refuse instead,
    // so whoever entered those totals decides to give them up.
    if (!game.eventsAuthoritative) {
      const existingStats = await prisma.hockeyGameStatistic.count({ where: { gameId } });
      if (existingStats > 0) {
        res.status(409).json({
          error:
            'This game already has statistics entered by hand. Remove them before recording events, which then become the source of its score and statistics.',
        });
        return;
      }
    }

    const event = await prisma.$transaction(async tx => {
      const created = await tx.matchEvent.create({
        data: {
          ...toData(body),
          gameId,
          teamId: body.teamId!,
          recordedById: req.user?.id ?? null,
        },
        include: eventInclude,
      });
      await recomputeGameFromEvents(tx, gameId);
      return created;
    });

    res.status(201).json(event);
  } catch (error) {
    console.error('Create match event error:', error);
    res.status(500).json({ error: 'Failed to create match event' });
  }
};

export const updateEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const body = req.body as EventBody;

    const existing = await prisma.matchEvent.findUnique({
      where: { id },
      select: { id: true, gameId: true, type: true, teamId: true },
    });
    if (!existing) {
      res.status(404).json({ error: 'Match event not found' });
      return;
    }

    const game = await prisma.game.findUnique({
      where: { id: existing.gameId },
      select: { id: true, homeTeamId: true, awayTeamId: true },
    });
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    // An update is validated as the whole event it will become, so a partial
    // body cannot leave behind a combination the create path would reject.
    const merged: EventBody = {
      ...body,
      type: body.type ?? existing.type,
      teamId: body.teamId ?? existing.teamId,
    };
    const invalid = await validate(merged, game);
    if (invalid) {
      res.status(invalid.status).json({ error: invalid.error });
      return;
    }

    const event = await prisma.$transaction(async tx => {
      const updated = await tx.matchEvent.update({
        where: { id },
        data: { ...toData(merged), teamId: merged.teamId! },
        include: eventInclude,
      });
      await recomputeGameFromEvents(tx, existing.gameId);
      return updated;
    });

    res.json(event);
  } catch (error) {
    console.error('Update match event error:', error);
    res.status(500).json({ error: 'Failed to update match event' });
  }
};

export const deleteEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existing = await prisma.matchEvent.findUnique({
      where: { id },
      select: { id: true, gameId: true },
    });
    if (!existing) {
      res.status(404).json({ error: 'Match event not found' });
      return;
    }

    await prisma.$transaction(async tx => {
      await tx.matchEvent.delete({ where: { id } });
      await recomputeGameFromEvents(tx, existing.gameId);
    });

    res.json({ message: 'Match event deleted' });
  } catch (error) {
    console.error('Delete match event error:', error);
    res.status(500).json({ error: 'Failed to delete match event' });
  }
};
