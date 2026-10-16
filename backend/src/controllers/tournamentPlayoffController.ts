import { Response } from 'express';
import prisma from '../config/database.js';
import { AuthRequest, GenerateTournamentPlayoffsRequest, TournamentGamePhase } from '../types/index.js';
import { computeGroupStandings } from '../utils/tournamentStandings.js';
import {
  MAX_QUALIFIERS,
  MIN_QUALIFIERS,
  advanceTarget,
  buildBracket,
  roundsFor,
  seedsFromTables,
} from '../services/playoff/bracket.js';
import { zonedDateTime, zonedParts } from '../utils/time.js';

export const generateTournamentPlayoffs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tournamentId } = req.params;
    const tid = tournamentId;
    const { qualifiersPerGroup, startTime, slotDurationMinutes, location } =
      req.body as GenerateTournamentPlayoffsRequest;

    if (!qualifiersPerGroup || qualifiersPerGroup < 1) {
      res.status(400).json({ error: 'qualifiersPerGroup must be a positive number' });
      return;
    }
    if (!startTime) {
      res.status(400).json({ error: 'startTime is required' });
      return;
    }
    if (!slotDurationMinutes || slotDurationMinutes <= 0) {
      res.status(400).json({ error: 'slotDurationMinutes must be a positive number' });
      return;
    }
    const venue = (location ?? '').trim() || null;

    const [startHour, startMinute] = startTime.split(':').map(Number);
    if ([startHour, startMinute].some(Number.isNaN)) {
      res.status(400).json({ error: 'startTime must be in HH:MM format' });
      return;
    }

    const existingPlayoffGames = await prisma.tournamentGame.count({
      where: { tournamentId: tid, phase: { not: 'GROUP' } },
    });
    if (existingPlayoffGames > 0) {
      res.status(400).json({ error: 'Playoffs have already been generated for this tournament' });
      return;
    }

    // Playoffs pick up the day after the group stage's last generated game,
    // instead of asking the admin to retype a date that's already implied.
    const lastGroupGame = await prisma.tournamentGame.findFirst({
      where: { tournamentId: tid, phase: 'GROUP', date: { not: null } },
      orderBy: { date: 'desc' },
    });
    if (!lastGroupGame?.date) {
      res.status(400).json({ error: 'Generate the group-stage schedule before generating playoffs' });
      return;
    }
    // The day after the group stage ends, as a calendar day where it is played.
    const lastGroupDay = zonedParts(lastGroupGame.date);

    const groups = await prisma.tournamentGroup.findMany({ where: { tournamentId: tid } });
    if (groups.length === 0) {
      res.status(400).json({ error: 'Tournament has no groups' });
      return;
    }

    const standingsByGroup = await Promise.all(groups.map(g => computeGroupStandings(tid, g.id)));
    for (const s of standingsByGroup) {
      if (s.length < qualifiersPerGroup) {
        res.status(400).json({ error: `Not enough teams in one of the groups for ${qualifiersPerGroup} qualifiers per group` });
        return;
      }
    }

    // If the group stage isn't finished yet, standings (and therefore seeds)
    // are still provisional — build the bracket with seed numbers only
    // ("1st place" vs "8th place") and fill in real teams automatically
    // once every group game completes (see resolvePlayoffSeeds).
    const incompleteGroupGames = await prisma.tournamentGame.count({
      where: { tournamentId: tid, phase: 'GROUP', status: { notIn: ['COMPLETED', 'CANCELLED'] } },
    });
    const groupStageComplete = incompleteGroupGames === 0;

    // Seed order: all group winners first (ranked amongst themselves), then
    // all runners-up, etc. — mirrors how real tournaments seed a bracket
    // built from multiple groups. Same generator as a season's play-off.
    const totalQualifiers = qualifiersPerGroup * groups.length;
    if (totalQualifiers < MIN_QUALIFIERS || totalQualifiers > MAX_QUALIFIERS) {
      res.status(400).json({ error: `Total qualifiers (${totalQualifiers}) must be between ${MIN_QUALIFIERS} and ${MAX_QUALIFIERS}` });
      return;
    }
    const seeds = seedsFromTables(standingsByGroup, qualifiersPerGroup);
    const teamFor = (seed: number | null) => (seed !== null && groupStageComplete ? seeds[seed - 1] : null);

    // One round per day after the group stage; the bronze game shares the
    // final's day and goes first. A count that is not a power of two gives the
    // top seeds a bye: they start in the second round.
    const rounds = roundsFor(totalQualifiers);
    const slots = buildBracket(totalQualifiers, { bronze: true });
    const days = rounds.map(round => [
      ...(round === 'FINAL' ? slots.filter(s => s.round === 'BRONZE') : []),
      ...slots.filter(s => s.round === round),
    ]);

    const created = await prisma.$transaction(
      days.flatMap((day, dayIndex) =>
        day.map((g, i) => {
          const gameDate = zonedDateTime(
            lastGroupDay.year,
            lastGroupDay.month,
            lastGroupDay.day + 1 + dayIndex,
            startHour,
            startMinute + i * slotDurationMinutes,
          );

          return prisma.tournamentGame.create({
            data: {
              phase: g.round,
              tournamentId: tid,
              homeTeamId: teamFor(g.homeSeed),
              awayTeamId: teamFor(g.awaySeed),
              homeSeed: g.homeSeed,
              awaySeed: g.awaySeed,
              bracketSlot: g.slot,
              status: 'SCHEDULED',
              date: gameDate,
              location: venue,
            },
          });
        })
      )
    );

    const note = groupStageComplete
      ? undefined
      : ' Group stage not finished yet — first-round matchups are shown by seed and will fill in with real teams once it completes.';
    res.status(201).json({ message: `Generated ${created.length} playoff game(s) across ${days.length} round(s).${note ?? ''}` });
  } catch (error) {
    console.error('Generate tournament playoffs error:', error);
    res.status(500).json({ error: 'Failed to generate playoffs' });
  }
};

export const deleteTournamentPlayoffs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tournamentId } = req.params;
    const tid = tournamentId;

    const completedCount = await prisma.tournamentGame.count({
      where: { tournamentId: tid, phase: { not: 'GROUP' }, status: 'COMPLETED' },
    });
    if (completedCount > 0) {
      res.status(400).json({ error: 'Cannot delete playoffs after results have been recorded' });
      return;
    }

    const { count } = await prisma.tournamentGame.deleteMany({
      where: { tournamentId: tid, phase: { not: 'GROUP' } },
    });
    res.json({ message: `Deleted ${count} playoff game(s)` });
  } catch (error) {
    console.error('Delete tournament playoffs error:', error);
    res.status(500).json({ error: 'Failed to delete playoffs' });
  }
};

// Called after a group game completes: if that was the last one, resolves
// any seed-only playoff sides (generated before the group stage finished)
// into real teams. A bye puts a seed in the second round, so every round is
// looked at, not only the first.
export async function resolvePlayoffSeeds(tournamentId: string): Promise<void> {
  const playoffGames = await prisma.tournamentGame.findMany({
    where: { tournamentId, phase: { not: 'GROUP' } },
  });
  const unresolved = playoffGames.filter(g =>
    (g.homeSeed != null && g.homeTeamId == null) || (g.awaySeed != null && g.awayTeamId == null));
  if (unresolved.length === 0) return;

  const incompleteGroupGames = await prisma.tournamentGame.count({
    where: { tournamentId, phase: 'GROUP', status: { notIn: ['COMPLETED', 'CANCELLED'] } },
  });
  if (incompleteGroupGames > 0) return;

  const groups = await prisma.tournamentGroup.findMany({ where: { tournamentId } });
  if (groups.length === 0) return;

  // The lowest seed always plays in the first round, so the highest seed
  // number on the bracket is the number of qualifiers.
  const totalQualifiers = Math.max(...playoffGames.flatMap(g => [g.homeSeed ?? 0, g.awaySeed ?? 0]));
  const qualifiersPerGroup = totalQualifiers / groups.length;
  if (!Number.isInteger(qualifiersPerGroup)) return; // groups changed since generation, bail rather than guess

  const standingsByGroup = await Promise.all(groups.map(g => computeGroupStandings(tournamentId, g.id)));
  if (standingsByGroup.some(s => s.length < qualifiersPerGroup)) return;

  const seeds = seedsFromTables(standingsByGroup, qualifiersPerGroup);

  await prisma.$transaction(
    unresolved.map(g => prisma.tournamentGame.update({
      where: { id: g.id },
      data: {
        ...(g.homeSeed != null && g.homeTeamId == null && { homeTeamId: seeds[g.homeSeed - 1] }),
        ...(g.awaySeed != null && g.awayTeamId == null && { awayTeamId: seeds[g.awaySeed - 1] }),
      },
    }))
  );
}

interface CompletableGame {
  tournamentId: string;
  phase: TournamentGamePhase;
  bracketSlot: number | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
}

// Called after a playoff game is updated: propagates the winner into the next
// round's slot, and (from a semifinal) the loser into the bronze match.
export async function advancePlayoffBracket(game: CompletableGame): Promise<void> {
  if (game.phase === 'GROUP' || game.phase === 'FINAL' || game.phase === 'BRONZE') return;
  if (game.status !== 'COMPLETED') return;
  if (game.homeScore == null || game.awayScore == null || game.homeScore === game.awayScore) return;
  if (game.bracketSlot == null || game.homeTeamId == null || game.awayTeamId == null) return;

  const winnerId = game.homeScore > game.awayScore ? game.homeTeamId : game.awayTeamId;
  const loserId = game.homeScore > game.awayScore ? game.awayTeamId : game.homeTeamId;

  const { winner, loser } = advanceTarget(game.phase, game.bracketSlot);
  for (const [target, teamId] of [[winner, winnerId], [loser, loserId]] as const) {
    if (!target) continue;
    const nextGame = await prisma.tournamentGame.findFirst({
      where: { tournamentId: game.tournamentId, phase: target.round, bracketSlot: target.slot },
    });
    if (nextGame) {
      await prisma.tournamentGame.update({
        where: { id: nextGame.id },
        data: target.side === 'home' ? { homeTeamId: teamId } : { awayTeamId: teamId },
      });
    }
  }
}
