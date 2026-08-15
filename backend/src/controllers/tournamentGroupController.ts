import { Request, Response } from 'express';
import prisma from '../config/database.js';
import {
  AuthRequest,
  CreateTournamentGroupRequest,
  UpdateTournamentGroupRequest,
  AssignTeamToGroupRequest,
  GenerateTournamentScheduleRequest,
} from '../types/index.js';

const groupInclude = {
  teams: {
    include: { team: true },
    orderBy: { team: { name: 'asc' } } as const,
  },
  _count: { select: { games: true } },
};

// Circle method: each round pairs every team at most once, so a team never
// plays twice in the same round instead of front-loading against everyone.
function buildRoundRobinRounds(teamIds: number[]): [number, number][][] {
  const arr: (number | null)[] = [...teamIds];
  if (arr.length % 2 !== 0) arr.push(null); // bye slot for odd team counts
  const rounds: [number, number][][] = [];
  const roundCount = arr.length - 1;
  const half = arr.length / 2;
  let list = arr;

  for (let r = 0; r < roundCount; r++) {
    const round: [number, number][] = [];
    for (let i = 0; i < half; i++) {
      const a = list[i];
      const b = list[list.length - 1 - i];
      if (a !== null && b !== null) round.push([a, b]);
    }
    rounds.push(round);
    list = [list[0], list[list.length - 1], ...list.slice(1, list.length - 1)];
  }
  return rounds;
}

// Greedily resequences fixtures so both teams in a fixture last played at
// least `minGap` slots ago, falling back to the least-bad option when the
// constraint can't be fully satisfied (e.g. too few teams for the gap size).
function scheduleWithRestGap<T extends { homeTeamId: number; awayTeamId: number }>(fixtures: T[], minGap: number): T[] {
  const pool = [...fixtures];
  const scheduled: T[] = [];
  const lastPlayedAt = new Map<number, number>();

  while (pool.length > 0) {
    let bestIndex = 0;
    let bestGap = -Infinity;
    for (let i = 0; i < pool.length; i++) {
      const f = pool[i];
      const homeGap = scheduled.length - (lastPlayedAt.get(f.homeTeamId) ?? -Infinity) - 1;
      const awayGap = scheduled.length - (lastPlayedAt.get(f.awayTeamId) ?? -Infinity) - 1;
      const gap = Math.min(homeGap, awayGap);
      if (gap >= minGap) { bestIndex = i; bestGap = gap; break; }
      if (gap > bestGap) { bestGap = gap; bestIndex = i; }
    }
    const [chosen] = pool.splice(bestIndex, 1);
    lastPlayedAt.set(chosen.homeTeamId, scheduled.length);
    lastPlayedAt.set(chosen.awayTeamId, scheduled.length);
    scheduled.push(chosen);
  }
  return scheduled;
}

export const getGroupsByTournament = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tournamentId } = req.params;
    const groups = await prisma.tournamentGroup.findMany({
      where: { tournamentId: parseInt(tournamentId) },
      include: groupInclude,
      orderBy: { name: 'asc' },
    });
    res.json(groups);
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
};

export const getGroupById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const group = await prisma.tournamentGroup.findUnique({
      where: { id: parseInt(id) },
      include: {
        ...groupInclude,
        games: {
          include: {
            homeTeam: { select: { id: true, name: true, logo: true, primaryColor: true, country: true } },
            awayTeam: { select: { id: true, name: true, logo: true, primaryColor: true, country: true } },
          },
          orderBy: { date: 'asc' },
        },
      },
    });
    if (!group) { res.status(404).json({ error: 'Group not found' }); return; }
    res.json(group);
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({ error: 'Failed to fetch group' });
  }
};

export const createGroup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tournamentId } = req.params;
    const { name } = req.body as CreateTournamentGroupRequest;
    if (!name) { res.status(400).json({ error: 'Name is required' }); return; }

    const group = await prisma.tournamentGroup.create({
      data: { name, tournamentId: parseInt(tournamentId) },
      include: groupInclude,
    });
    res.status(201).json(group);
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ error: 'Failed to create group' });
  }
};

export const updateGroup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name } = req.body as UpdateTournamentGroupRequest;

    const group = await prisma.tournamentGroup.update({
      where: { id: parseInt(id) },
      data: { ...(name !== undefined && { name }) },
      include: groupInclude,
    });
    res.json(group);
  } catch (error) {
    console.error('Update group error:', error);
    res.status(500).json({ error: 'Failed to update group' });
  }
};

export const deleteGroup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.tournamentGroup.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Group deleted' });
  } catch (error) {
    console.error('Delete group error:', error);
    res.status(500).json({ error: 'Failed to delete group' });
  }
};

export const assignTeamToGroup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { teamId } = req.body as AssignTeamToGroupRequest;
    if (!teamId) { res.status(400).json({ error: 'teamId is required' }); return; }

    const group = await prisma.tournamentGroup.findUnique({ where: { id: parseInt(id) } });
    if (!group) { res.status(404).json({ error: 'Group not found' }); return; }

    const team = await prisma.tournamentTeam.findUnique({ where: { id: teamId } });
    if (!team) { res.status(404).json({ error: 'Team not found' }); return; }
    if (team.tournamentId !== group.tournamentId) {
      res.status(400).json({ error: 'Team does not belong to this tournament' });
      return;
    }

    const existingMembership = await prisma.tournamentGroupTeam.findFirst({
      where: { teamId, group: { tournamentId: group.tournamentId } },
      include: { group: true },
    });
    if (existingMembership && existingMembership.groupId !== group.id) {
      res.status(400).json({ error: `Team is already assigned to group "${existingMembership.group.name}"` });
      return;
    }

    await prisma.tournamentGroupTeam.upsert({
      where: { groupId_teamId: { groupId: parseInt(id), teamId } },
      create: { groupId: parseInt(id), teamId },
      update: {},
    });

    const updated = await prisma.tournamentGroup.findUnique({
      where: { id: parseInt(id) },
      include: groupInclude,
    });
    res.json(updated);
  } catch (error) {
    console.error('Assign team to group error:', error);
    res.status(500).json({ error: 'Failed to assign team' });
  }
};

export const removeTeamFromGroup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, teamId } = req.params;
    await prisma.tournamentGroupTeam.delete({
      where: { groupId_teamId: { groupId: parseInt(id), teamId: parseInt(teamId) } },
    });
    res.json({ message: 'Team removed from group' });
  } catch (error) {
    console.error('Remove team from group error:', error);
    res.status(500).json({ error: 'Failed to remove team from group' });
  }
};

export const generateTournamentSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tournamentId } = req.params;
    const { startDate, startTime, endTime, slotDurationMinutes, locations, minRestGames } = req.body as GenerateTournamentScheduleRequest;
    const restGap = minRestGames ?? 1;
    if (restGap < 0) {
      res.status(400).json({ error: 'minRestGames cannot be negative' });
      return;
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id: parseInt(tournamentId) },
      include: { series: { select: { sportType: true } } },
    });
    if (!tournament) {
      res.status(404).json({ error: 'Tournament not found' });
      return;
    }
    // Tennis matches have no fixed duration, so slot/venue scheduling doesn't
    // apply — just build the fixture list with date and location left unset.
    const isTennis = tournament.series?.sportType === 'TENNIS';

    let dayStart = new Date(0);
    let startHour = 0, startMinute = 0, capacityPerDayPerVenue = 0, slotDuration = 0;
    let venues: string[] = [];

    if (!isTennis) {
      if (!startDate || !startTime || !endTime) {
        res.status(400).json({ error: 'startDate, startTime and endTime are required' });
        return;
      }
      if (!slotDurationMinutes || slotDurationMinutes <= 0) {
        res.status(400).json({ error: 'slotDurationMinutes must be a positive number' });
        return;
      }
      venues = (locations ?? []).map(l => l.trim()).filter(Boolean);
      if (venues.length === 0) {
        res.status(400).json({ error: 'At least one location is required' });
        return;
      }

      const [sh, sm] = startTime.split(':').map(Number);
      const [eh, em] = endTime.split(':').map(Number);
      if ([sh, sm, eh, em].some(Number.isNaN)) {
        res.status(400).json({ error: 'startTime and endTime must be in HH:MM format' });
        return;
      }
      const windowMinutes = (eh * 60 + em) - (sh * 60 + sm);
      if (windowMinutes < 0) {
        res.status(400).json({ error: 'endTime must be after startTime' });
        return;
      }
      startHour = sh;
      startMinute = sm;
      slotDuration = slotDurationMinutes;
      capacityPerDayPerVenue = Math.floor(windowMinutes / slotDuration) + 1;

      dayStart = new Date(startDate);
      if (Number.isNaN(dayStart.getTime())) {
        res.status(400).json({ error: 'startDate is invalid' });
        return;
      }
    }

    let groups = await prisma.tournamentGroup.findMany({
      where: { tournamentId: parseInt(tournamentId) },
      include: { teams: true, _count: { select: { games: true } } },
      orderBy: { name: 'asc' },
    });

    // No manual group setup yet — fall back to one default group holding
    // every team so a schedule can still be generated.
    if (groups.length === 0) {
      const allTeams = await prisma.tournamentTeam.findMany({ where: { tournamentId: parseInt(tournamentId) } });
      if (allTeams.length >= 2) {
        await prisma.tournamentGroup.create({
          data: {
            name: 'A',
            tournamentId: parseInt(tournamentId),
            teams: { create: allTeams.map(t => ({ teamId: t.id })) },
          },
        });
        groups = await prisma.tournamentGroup.findMany({
          where: { tournamentId: parseInt(tournamentId) },
          include: { teams: true, _count: { select: { games: true } } },
          orderBy: { name: 'asc' },
        });
      }
    }

    const eligible = groups.filter(g => g.teams.length >= 2 && g._count.games === 0);
    if (eligible.length === 0) {
      res.status(400).json({ error: 'No eligible groups to generate (need at least 2 teams and no existing games)' });
      return;
    }

    // Build each group's schedule as rounds via the circle method, so within
    // a round every team plays at most once (no team gets clustered at the
    // front of the list the way a naive i<j pairing would produce).
    const groupRounds = eligible.map(group => ({
      groupId: group.id,
      tournamentId: group.tournamentId,
      rounds: buildRoundRobinRounds(group.teams.map(gt => gt.teamId)),
    }));

    const interleaved: { groupId: number; tournamentId: number; homeTeamId: number; awayTeamId: number }[] = [];
    const maxRounds = Math.max(...groupRounds.map(g => g.rounds.length));
    for (let r = 0; r < maxRounds; r++) {
      for (const group of groupRounds) {
        const round = group.rounds[r] ?? [];
        for (const [homeTeamId, awayTeamId] of round) {
          interleaved.push({ groupId: group.groupId, tournamentId: group.tournamentId, homeTeamId, awayTeamId });
        }
      }
    }

    // Round-robin interleaving alone doesn't guarantee rest between a team's
    // matches once groups/venues combine into one flat slot list, so greedily
    // resequence: at each slot, prefer the earliest still-pending fixture
    // whose both teams last played at least `restGap` slots ago.
    const pending = scheduleWithRestGap(interleaved, restGap);

    const slotsPerDayTotal = capacityPerDayPerVenue * venues.length;
    const created = await prisma.$transaction(
      pending.map((g, index) => {
        if (isTennis) {
          return prisma.tournamentGame.create({
            data: {
              phase: 'GROUP',
              tournamentId: g.tournamentId,
              groupId: g.groupId,
              homeTeamId: g.homeTeamId,
              awayTeamId: g.awayTeamId,
              status: 'SCHEDULED',
              date: null,
              location: null,
            },
          });
        }

        const dayIndex = Math.floor(index / slotsPerDayTotal);
        const slotInDay = index % slotsPerDayTotal;
        const timeSlot = Math.floor(slotInDay / venues.length);
        const venueIndex = slotInDay % venues.length;

        const gameDate = new Date(dayStart);
        gameDate.setDate(gameDate.getDate() + dayIndex);
        gameDate.setHours(startHour, startMinute + timeSlot * slotDuration, 0, 0);

        return prisma.tournamentGame.create({
          data: {
            phase: 'GROUP',
            tournamentId: g.tournamentId,
            groupId: g.groupId,
            homeTeamId: g.homeTeamId,
            awayTeamId: g.awayTeamId,
            status: 'SCHEDULED',
            date: gameDate,
            location: venues[venueIndex],
          },
        });
      })
    );

    res.status(201).json({ message: `Generated ${created.length} games across ${eligible.length} group(s)` });
  } catch (error) {
    console.error('Generate tournament schedule error:', error);
    res.status(500).json({ error: 'Failed to generate schedule' });
  }
};

export const deleteTournamentSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tournamentId } = req.params;

    const tournament = await prisma.tournament.findUnique({ where: { id: parseInt(tournamentId) } });
    if (!tournament) { res.status(404).json({ error: 'Tournament not found' }); return; }
    if (tournament.status !== 'DRAFT') {
      res.status(400).json({ error: 'Schedule can only be deleted while tournament is in DRAFT status' });
      return;
    }

    const { count } = await prisma.tournamentGame.deleteMany({
      where: { tournamentId: parseInt(tournamentId), phase: 'GROUP' },
    });

    res.json({ message: `Deleted ${count} game(s)` });
  } catch (error) {
    console.error('Delete tournament schedule error:', error);
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
};
