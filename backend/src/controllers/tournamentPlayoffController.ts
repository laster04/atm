import { Response } from 'express';
import prisma from '../config/database.js';
import { AuthRequest, GenerateTournamentPlayoffsRequest, TournamentGamePhase } from '../types/index.js';
import { computeGroupStandings } from '../utils/tournamentStandings.js';

// Bracket rounds in play order; BRONZE branches off SEMI_FINAL but never
// feeds forward, so it's handled separately from this advancement chain.
const ADVANCE_SEQUENCE: TournamentGamePhase[] = ['ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'FINAL'];

// Standard single-elimination bracket seeding (1v8, 4v5, 2v7, 3v6 for 8 teams,
// etc.) so top seeds are kept apart until later rounds instead of meeting a
// naive 1v2 pairing immediately.
function seedOrder(n: number): number[] {
  if (n === 1) return [1];
  const prev = seedOrder(n / 2);
  const result: number[] = [];
  for (const s of prev) {
    result.push(s);
    result.push(n + 1 - s);
  }
  return result;
}

export const generateTournamentPlayoffs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tournamentId } = req.params;
    const tid = parseInt(tournamentId);
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
    const dayStart = new Date(lastGroupGame.date);
    dayStart.setDate(dayStart.getDate() + 1);

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
    // built from multiple groups.
    const seeds: number[] = [];
    for (let rank = 0; rank < qualifiersPerGroup; rank++) {
      const rankTeams = standingsByGroup
        .map(s => s[rank])
        .sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor);
      for (const t of rankTeams) seeds.push(t.teamId);
    }

    const totalQualifiers = seeds.length;
    const isPowerOfTwo = totalQualifiers >= 2 && (totalQualifiers & (totalQualifiers - 1)) === 0;
    if (!isPowerOfTwo) {
      res.status(400).json({ error: `Total qualifiers (${totalQualifiers}) must be a power of two (2, 4, 8 or 16)` });
      return;
    }
    if (totalQualifiers > 16) {
      res.status(400).json({ error: 'Playoff brackets larger than 16 teams are not supported' });
      return;
    }

    const order = seedOrder(totalQualifiers);
    const seededTeams = order.map(seed => seeds[seed - 1]);

    const totalRounds = Math.log2(totalQualifiers);
    const phases = ADVANCE_SEQUENCE.slice(ADVANCE_SEQUENCE.length - totalRounds);

    interface PendingGame {
      phase: TournamentGamePhase; bracketSlot: number;
      homeTeamId: number | null; awayTeamId: number | null;
      homeSeed: number | null; awaySeed: number | null;
    }
    const rounds: PendingGame[][] = [];

    for (let r = 0; r < totalRounds; r++) {
      const phase = phases[r];
      const gamesInRound = totalQualifiers / 2 ** (r + 1);
      const isFinalRound = r === totalRounds - 1;
      const round: PendingGame[] = [];

      // Bronze-medal match shares the final's day and mirrors its single
      // slot, since both semifinal games feed into bracketSlot 0.
      if (isFinalRound && totalRounds >= 2) {
        round.push({ phase: 'BRONZE', bracketSlot: 0, homeTeamId: null, awayTeamId: null, homeSeed: null, awaySeed: null });
      }
      for (let slot = 0; slot < gamesInRound; slot++) {
        const homeSeed = r === 0 ? order[slot * 2] : null;
        const awaySeed = r === 0 ? order[slot * 2 + 1] : null;
        round.push({
          phase,
          bracketSlot: slot,
          homeTeamId: r === 0 && groupStageComplete ? seededTeams[slot * 2] : null,
          awayTeamId: r === 0 && groupStageComplete ? seededTeams[slot * 2 + 1] : null,
          homeSeed,
          awaySeed,
        });
      }
      rounds.push(round);
    }

    const created = await prisma.$transaction(
      rounds.flatMap((round, dayIndex) =>
        round.map((g, i) => {
          const gameDate = new Date(dayStart);
          gameDate.setDate(gameDate.getDate() + dayIndex);
          gameDate.setHours(startHour, startMinute + i * slotDurationMinutes, 0, 0);

          return prisma.tournamentGame.create({
            data: {
              phase: g.phase,
              tournamentId: tid,
              homeTeamId: g.homeTeamId,
              awayTeamId: g.awayTeamId,
              homeSeed: g.homeSeed,
              awaySeed: g.awaySeed,
              bracketSlot: g.bracketSlot,
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
    res.status(201).json({ message: `Generated ${created.length} playoff game(s) across ${rounds.length} round(s).${note ?? ''}` });
  } catch (error) {
    console.error('Generate tournament playoffs error:', error);
    res.status(500).json({ error: 'Failed to generate playoffs' });
  }
};

export const deleteTournamentPlayoffs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tournamentId } = req.params;
    const tid = parseInt(tournamentId);

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
// any seed-only first-round playoff games (generated before the group stage
// finished) into real team assignments.
export async function resolvePlayoffSeeds(tournamentId: number): Promise<void> {
  const unresolved = await prisma.tournamentGame.findMany({
    where: { tournamentId, phase: { not: 'GROUP' }, homeTeamId: null, homeSeed: { not: null } },
  });
  if (unresolved.length === 0) return;

  const incompleteGroupGames = await prisma.tournamentGame.count({
    where: { tournamentId, phase: 'GROUP', status: { notIn: ['COMPLETED', 'CANCELLED'] } },
  });
  if (incompleteGroupGames > 0) return;

  const groups = await prisma.tournamentGroup.findMany({ where: { tournamentId } });
  if (groups.length === 0) return;

  const totalQualifiers = unresolved.length * 2;
  const qualifiersPerGroup = totalQualifiers / groups.length;
  if (!Number.isInteger(qualifiersPerGroup)) return; // groups changed since generation, bail rather than guess

  const standingsByGroup = await Promise.all(groups.map(g => computeGroupStandings(tournamentId, g.id)));
  if (standingsByGroup.some(s => s.length < qualifiersPerGroup)) return;

  const seeds: number[] = [];
  for (let rank = 0; rank < qualifiersPerGroup; rank++) {
    const rankTeams = standingsByGroup
      .map(s => s[rank])
      .sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor);
    for (const t of rankTeams) seeds.push(t.teamId);
  }

  await prisma.$transaction(
    unresolved.map(g => prisma.tournamentGame.update({
      where: { id: g.id },
      data: {
        homeTeamId: g.homeSeed != null ? seeds[g.homeSeed - 1] : null,
        awayTeamId: g.awaySeed != null ? seeds[g.awaySeed - 1] : null,
      },
    }))
  );
}

interface CompletableGame {
  tournamentId: number;
  phase: TournamentGamePhase;
  bracketSlot: number | null;
  homeTeamId: number | null;
  awayTeamId: number | null;
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

  const currentIdx = ADVANCE_SEQUENCE.indexOf(game.phase);
  if (currentIdx === -1 || currentIdx === ADVANCE_SEQUENCE.length - 1) return;
  const nextPhase = ADVANCE_SEQUENCE[currentIdx + 1];
  const nextSlot = Math.floor(game.bracketSlot / 2);
  const role = game.bracketSlot % 2 === 0 ? 'home' : 'away';

  const nextGame = await prisma.tournamentGame.findFirst({
    where: { tournamentId: game.tournamentId, phase: nextPhase, bracketSlot: nextSlot },
  });
  if (nextGame) {
    await prisma.tournamentGame.update({
      where: { id: nextGame.id },
      data: role === 'home' ? { homeTeamId: winnerId } : { awayTeamId: winnerId },
    });
  }

  if (game.phase === 'SEMI_FINAL') {
    const bronzeGame = await prisma.tournamentGame.findFirst({
      where: { tournamentId: game.tournamentId, phase: 'BRONZE', bracketSlot: nextSlot },
    });
    if (bronzeGame) {
      await prisma.tournamentGame.update({
        where: { id: bronzeGame.id },
        data: role === 'home' ? { homeTeamId: loserId } : { awayTeamId: loserId },
      });
    }
  }
}
