import { Response } from 'express';
import { AttendanceStatus, Prisma, TeamEventType } from '@prisma/client';
import prisma from '../config/database.js';
import { AuthRequest } from '../types/index.js';
import { canManageTeam } from '../services/access.js';

const EVENT_TYPES = Object.values(TeamEventType);
const STATUSES = Object.values(AttendanceStatus);

interface EventBody {
  type?: string;
  title?: string;
  description?: string | null;
  startsAt?: string;
  endsAt?: string | null;
  location?: string | null;
  gameId?: string | null;
}

const eventInclude = {
  attendances: {
    include: { player: { select: { id: true, name: true, number: true, userId: true } } },
  },
} satisfies Prisma.TeamEventInclude;

/**
 * Answers left behind by players who have since moved to another team. They are
 * dropped on the move, but an event read should not show one even if a row
 * survives some other way.
 */
const onThisTeam = <T extends { player: { id: string } }>(
  attendances: T[],
  rosterIds: Set<string>
): T[] => attendances.filter(row => rosterIds.has(row.player.id));

type EventWithAttendance = {
  id: string;
  teamId: string;
  attendances: {
    id: string;
    playerId: string;
    status: AttendanceStatus;
    note: string | null;
    player: { id: string; name: string; number: number | null; userId: string | null };
  }[];
};

/**
 * Fills in the roster members who have no answer on record.
 *
 * Rows are written when someone answers, not when the event is created, so that
 * a player who joins the squad afterwards still appears on every event they
 * could turn up to instead of being invisible until someone thinks to re-create
 * it. The filled-in entries carry no id, which is what marks them as unanswered.
 */
const withRoster = async <T extends EventWithAttendance>(events: T[]): Promise<T[]> => {
  if (events.length === 0) return events;

  const roster = await prisma.player.findMany({
    where: { teamId: { in: [...new Set(events.map(event => event.teamId))] } },
    select: { id: true, name: true, number: true, userId: true, teamId: true },
    orderBy: { number: 'asc' },
  });

  return events.map(event => {
    const rosterIds = new Set(
      roster.filter(player => player.teamId === event.teamId).map(player => player.id)
    );
    const current = onThisTeam(event.attendances, rosterIds);
    const answered = new Set(current.map(row => row.playerId));
    const missing = roster
      .filter(player => player.teamId === event.teamId && !answered.has(player.id))
      .map(player => ({
        id: null,
        playerId: player.id,
        status: 'NO_RESPONSE' as AttendanceStatus,
        note: null,
        player: { id: player.id, name: player.name, number: player.number, userId: player.userId },
      }));
    return { ...event, attendances: [...current, ...missing] };
  });
};

const parseDate = (value: unknown): Date | null => {
  if (typeof value !== 'string' || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * A team's calendar, with who is coming.
 *
 * Who turns up to training is the team's own business, so this is never public.
 * Whoever manages the team sees every answer; a player on that team sees the
 * events and their own answer, but not their team-mates'.
 */
export const getEventsByTeam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { teamId } = req.params;

    const manages = await canManageTeam(req.user!, teamId);
    const ownPlayers = manages
      ? []
      : await prisma.player.findMany({
          where: { teamId, userId: req.user!.id },
          select: { id: true },
        });

    if (!manages && ownPlayers.length === 0) {
      res.status(403).json({ error: 'Not authorized to see this team calendar' });
      return;
    }

    const events = await prisma.teamEvent.findMany({
      where: { teamId },
      include: eventInclude,
      orderBy: { startsAt: 'asc' },
    });

    if (!manages) {
      const own = new Set(ownPlayers.map(player => player.id));
      res.json(
        events.map(event => ({
          ...event,
          attendances: event.attendances.filter(row => own.has(row.playerId)),
        }))
      );
      return;
    }

    res.json(await withRoster(events));
  } catch (error) {
    console.error('Get team events error:', error);
    res.status(500).json({ error: 'Failed to fetch team events' });
  }
};

/**
 * Creates an event and opens attendance for the whole roster at once, so the
 * manager sees who has not answered rather than only who has.
 */
export const createEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { teamId } = req.params;
    const body = req.body as EventBody;

    if (!body.title || !body.title.trim()) {
      res.status(400).json({ error: 'Title is required' });
      return;
    }
    const startsAt = parseDate(body.startsAt);
    if (!startsAt) {
      res.status(400).json({ error: 'A valid start time is required' });
      return;
    }
    const endsAt = body.endsAt ? parseDate(body.endsAt) : null;
    if (body.endsAt && !endsAt) {
      res.status(400).json({ error: 'End time is not a valid date' });
      return;
    }
    if (endsAt && endsAt < startsAt) {
      res.status(400).json({ error: 'An event cannot end before it starts' });
      return;
    }
    if (body.type && !EVENT_TYPES.includes(body.type as TeamEventType)) {
      res.status(400).json({ error: `type must be one of ${EVENT_TYPES.join(', ')}` });
      return;
    }

    // A mirrored fixture has to be one this team actually plays in.
    if (body.gameId) {
      const game = await prisma.game.findUnique({
        where: { id: body.gameId },
        select: { homeTeamId: true, awayTeamId: true },
      });
      if (!game) {
        res.status(404).json({ error: 'Game not found' });
        return;
      }
      if (game.homeTeamId !== teamId && game.awayTeamId !== teamId) {
        res.status(400).json({ error: 'That game does not involve this team' });
        return;
      }
    }

    const event = await prisma.teamEvent.create({
      data: {
        teamId,
        type: (body.type as TeamEventType) ?? 'OTHER',
        title: body.title!.trim(),
        description: body.description?.trim() || null,
        startsAt,
        endsAt,
        location: body.location?.trim() || null,
        gameId: body.gameId || null,
        createdById: req.user?.id ?? null,
      },
      include: eventInclude,
    });

    const [withAttendance] = await withRoster([event]);
    res.status(201).json(withAttendance);
  } catch (error) {
    if ((error as Prisma.PrismaClientKnownRequestError).code === 'P2002') {
      res.status(409).json({ error: 'This team already has an event for that game' });
      return;
    }
    console.error('Create team event error:', error);
    res.status(500).json({ error: 'Failed to create the event' });
  }
};

export const updateEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const body = req.body as EventBody;

    const existing = await prisma.teamEvent.findUnique({ where: { id }, select: { startsAt: true } });
    if (!existing) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    const startsAt = body.startsAt !== undefined ? parseDate(body.startsAt) : undefined;
    if (body.startsAt !== undefined && !startsAt) {
      res.status(400).json({ error: 'A valid start time is required' });
      return;
    }
    const endsAt = body.endsAt === null ? null : body.endsAt !== undefined ? parseDate(body.endsAt) : undefined;
    if (body.endsAt && endsAt === null) {
      res.status(400).json({ error: 'End time is not a valid date' });
      return;
    }
    const effectiveStart = startsAt ?? existing.startsAt;
    if (endsAt && endsAt < effectiveStart) {
      res.status(400).json({ error: 'An event cannot end before it starts' });
      return;
    }
    if (body.type && !EVENT_TYPES.includes(body.type as TeamEventType)) {
      res.status(400).json({ error: `type must be one of ${EVENT_TYPES.join(', ')}` });
      return;
    }

    const event = await prisma.teamEvent.update({
      where: { id },
      data: {
        ...(body.type !== undefined && { type: body.type as TeamEventType }),
        ...(body.title !== undefined && { title: body.title.trim() }),
        ...(body.description !== undefined && { description: body.description?.trim() || null }),
        ...(startsAt != null && { startsAt }),
        ...(endsAt !== undefined && { endsAt }),
        ...(body.location !== undefined && { location: body.location?.trim() || null }),
      },
      include: eventInclude,
    });

    const [withAttendance] = await withRoster([event]);
    res.json(withAttendance);
  } catch (error) {
    console.error('Update team event error:', error);
    res.status(500).json({ error: 'Failed to update the event' });
  }
};

export const deleteEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.teamEvent.delete({ where: { id } });
    res.json({ message: 'Event deleted' });
  } catch (error) {
    if ((error as Prisma.PrismaClientKnownRequestError).code === 'P2025') {
      res.status(404).json({ error: 'Event not found' });
      return;
    }
    console.error('Delete team event error:', error);
    res.status(500).json({ error: 'Failed to delete the event' });
  }
};

/**
 * Answers for one player.
 *
 * Two kinds of caller are allowed and they are checked separately: whoever
 * manages the team may answer for anyone on it, and a player linked to an
 * account may answer for themselves. Nobody may answer for another player.
 */
export const setAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, playerId } = req.params;
    const { status, note } = req.body as { status?: string; note?: string | null };

    if (!status || !STATUSES.includes(status as AttendanceStatus)) {
      res.status(400).json({ error: `status must be one of ${STATUSES.join(', ')}` });
      return;
    }

    const event = await prisma.teamEvent.findUnique({ where: { id }, select: { teamId: true } });
    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    const player = await prisma.player.findUnique({
      where: { id: playerId },
      select: { id: true, teamId: true, userId: true },
    });
    if (!player || player.teamId !== event.teamId) {
      res.status(404).json({ error: 'Player is not on this team' });
      return;
    }

    const isSelf = player.userId != null && player.userId === req.user!.id;
    if (!isSelf && !(await canManageTeam(req.user!, event.teamId))) {
      res.status(403).json({ error: 'Not authorized to answer for this player' });
      return;
    }

    const attendance = await prisma.attendance.upsert({
      where: { eventId_playerId: { eventId: id, playerId } },
      create: {
        eventId: id,
        playerId,
        status: status as AttendanceStatus,
        note: note?.trim() || null,
        respondedById: req.user?.id ?? null,
        respondedAt: new Date(),
      },
      update: {
        status: status as AttendanceStatus,
        note: note?.trim() || null,
        respondedById: req.user?.id ?? null,
        respondedAt: new Date(),
      },
      include: { player: { select: { id: true, name: true, number: true, userId: true } } },
    });

    res.json(attendance);
  } catch (error) {
    console.error('Set attendance error:', error);
    res.status(500).json({ error: 'Failed to save the response' });
  }
};

/**
 * The signed-in user's own calendar: every upcoming event for every roster spot
 * they hold, with their own answer alongside it.
 */
export const getMyEvents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const players = await prisma.player.findMany({
      where: { userId: req.user!.id },
      select: { id: true, teamId: true },
    });
    if (players.length === 0) {
      res.json([]);
      return;
    }

    const events = await prisma.teamEvent.findMany({
      where: {
        teamId: { in: players.map(player => player.teamId) },
        // Past events belong in a history view, not in what to answer next.
        startsAt: { gte: new Date() },
      },
      include: {
        team: { select: { id: true, name: true, logo: true, primaryColor: true } },
        attendances: {
          where: { playerId: { in: players.map(player => player.id) } },
          select: { id: true, playerId: true, status: true, note: true },
        },
      },
      orderBy: { startsAt: 'asc' },
    });

    res.json(
      events.map(event => ({
        ...event,
        // One row per event from this player's point of view.
        myAttendance: event.attendances[0] ?? null,
        attendances: undefined,
      }))
    );
  } catch (error) {
    console.error('Get my events error:', error);
    res.status(500).json({ error: 'Failed to fetch your events' });
  }
};
