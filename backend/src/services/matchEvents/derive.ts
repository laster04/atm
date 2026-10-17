import { Prisma } from '@prisma/client';
import { profileFor } from '../sports/profile.js';

/**
 * Rebuilds everything a game's event log implies: each player's line, the final
 * score and the score after each period.
 *
 * This runs on every event write rather than adjusting totals in place. A game
 * holds a few dozen events at most, so recomputing from scratch costs nothing
 * and removes the whole class of bug where an edit or a delete leaves a total
 * that no longer matches the events behind it.
 */
export const recomputeGameFromEvents = async (
  tx: Prisma.TransactionClient,
  gameId: string
): Promise<void> => {
  const game = await tx.game.findUnique({
    where: { id: gameId },
    select: { id: true, homeTeamId: true, awayTeamId: true, season: { select: { league: { select: { sportType: true } } } } },
  });
  if (!game) return;
  const profile = profileFor(game.season.league.sportType);

  const events = await tx.matchEvent.findMany({ where: { gameId } });

  // The last event was deleted. The game reverts to a plain result that a
  // manager edits by hand; leaving it derived would pin its score at 0-0.
  if (events.length === 0) {
    await tx.playerGameStatistic.deleteMany({ where: { gameId } });
    await tx.game.update({ where: { id: gameId }, data: { eventsAuthoritative: false } });
    return;
  }

  const lines = new Map<string, { goals: number; assists: number; penaltyMinutes: number; yellowCards: number; redCards: number }>();
  const line = (playerId: string) => {
    const existing = lines.get(playerId);
    if (existing) return existing;
    const created = { goals: 0, assists: 0, penaltyMinutes: 0, yellowCards: 0, redCards: 0 };
    lines.set(playerId, created);
    return created;
  };

  let homeScore = 0;
  let awayScore = 0;
  const periodGoals = new Map<number, { home: number; away: number }>();

  for (const event of events) {
    if (event.type === 'GOAL') {
      if (event.teamId === game.homeTeamId) homeScore++;
      else if (event.teamId === game.awayTeamId) awayScore++;

      const period = periodGoals.get(event.period) ?? { home: 0, away: 0 };
      if (event.teamId === game.homeTeamId) period.home++;
      else if (event.teamId === game.awayTeamId) period.away++;
      periodGoals.set(event.period, period);

      // A goal counts for the team whether or not a scorer was named; an
      // unattributed goal is common on an amateur scoresheet.
      if (event.playerId) line(event.playerId).goals++;
      if (event.assistPlayerId) line(event.assistPlayerId).assists++;
      if (event.secondaryAssistPlayerId) line(event.secondaryAssistPlayerId).assists++;
    }

    if (event.type === 'PENALTY' && event.playerId) {
      line(event.playerId).penaltyMinutes += event.penaltyMinutes ?? 0;
    }

    if (event.type === 'CARD' && event.playerId) {
      if (event.cardColor === 'YELLOW') line(event.playerId).yellowCards++;
      if (event.cardColor === 'RED') line(event.playerId).redCards++;
    }
  }

  // Only the numbers the sport keeps are written; the rest of the line stays null.
  const kept = (key: 'goals' | 'assists' | 'penaltyMinutes' | 'yellowCards' | 'redCards', value: number) =>
    profile.stats.includes(key) ? value : null;

  await tx.playerGameStatistic.deleteMany({ where: { gameId } });
  if (lines.size > 0) {
    await tx.playerGameStatistic.createMany({
      data: Array.from(lines.entries()).map(([playerId, totals]) => ({
        gameId,
        playerId,
        goals: kept('goals', totals.goals),
        assists: kept('assists', totals.assists),
        penaltyMinutes: kept('penaltyMinutes', totals.penaltyMinutes),
        yellowCards: kept('yellowCards', totals.yellowCards),
        redCards: kept('redCards', totals.redCards),
      })),
    });
  }

  const lastScoringPart = Math.max(0, ...periodGoals.keys());
  const partCount = Math.min(profile.parts.max, Math.max(profile.parts.regulation, lastScoringPart));

  await tx.game.update({
    where: { id: gameId },
    data: {
      eventsAuthoritative: true,
      homeScore,
      awayScore,
      // Every regulation part, scoreless ones included, then overtime if a
      // goal was scored in it.
      periodScores: Array.from({ length: partCount }, (_, i) => ({
        home: periodGoals.get(i + 1)?.home ?? 0,
        away: periodGoals.get(i + 1)?.away ?? 0,
      })),
    },
  });
};
