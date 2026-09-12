import { Prisma } from '@prisma/client';

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
    select: { id: true, homeTeamId: true, awayTeamId: true },
  });
  if (!game) return;

  const events = await tx.matchEvent.findMany({ where: { gameId } });

  // The last event was deleted. The game reverts to a plain result that a
  // manager edits by hand; leaving it derived would pin its score at 0-0.
  if (events.length === 0) {
    await tx.hockeyGameStatistic.deleteMany({ where: { gameId } });
    await tx.game.update({ where: { id: gameId }, data: { eventsAuthoritative: false } });
    return;
  }

  const lines = new Map<string, { goals: number; assists: number; penaltyMinutes: number }>();
  const line = (playerId: string) => {
    const existing = lines.get(playerId);
    if (existing) return existing;
    const created = { goals: 0, assists: 0, penaltyMinutes: 0 };
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
  }

  await tx.hockeyGameStatistic.deleteMany({ where: { gameId } });
  if (lines.size > 0) {
    await tx.hockeyGameStatistic.createMany({
      data: Array.from(lines.entries()).map(([playerId, totals]) => ({
        gameId,
        playerId,
        goals: totals.goals,
        assists: totals.assists,
        penaltyMinutes: totals.penaltyMinutes,
      })),
    });
  }

  await tx.game.update({
    where: { id: gameId },
    data: {
      eventsAuthoritative: true,
      homeScore,
      awayScore,
      // Only the three regulation periods have columns. Goals scored in
      // overtime or a shootout still count toward the final score above.
      period1HomeScore: periodGoals.get(1)?.home ?? 0,
      period1AwayScore: periodGoals.get(1)?.away ?? 0,
      period2HomeScore: periodGoals.get(2)?.home ?? 0,
      period2AwayScore: periodGoals.get(2)?.away ?? 0,
      period3HomeScore: periodGoals.get(3)?.home ?? 0,
      period3AwayScore: periodGoals.get(3)?.away ?? 0,
    },
  });
};
