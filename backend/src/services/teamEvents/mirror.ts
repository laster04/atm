import prisma from '../../config/database.js';

/**
 * Keeps each side's calendar in step with a league fixture.
 *
 * A fixture only becomes something to turn up to once it has a date, so that is
 * the trigger: generating a schedule of undated games puts nothing in anyone's
 * calendar and asks nobody whether they are coming. Setting the date creates the
 * event for both teams, moving it moves both, and clearing the date or calling
 * the game off takes it back out.
 *
 * The event is a mirror, never the fixture itself: the season still owns its
 * schedule, and a player sees one list instead of two.
 */
export const syncFixtureEvents = async (gameId: string): Promise<void> => {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: {
      id: true,
      date: true,
      status: true,
      location: true,
      homeTeamId: true,
      awayTeamId: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
  });
  if (!game) return;

  // A game with no date, or one that will not be played, is not an appointment.
  // Removing the mirror drops the answers with it, which is the point: nobody
  // should still be marked as attending a game that is no longer happening.
  if (!game.date || game.status === 'CANCELLED') {
    await prisma.teamEvent.deleteMany({ where: { gameId } });
    return;
  }

  // Language-neutral on purpose: this string is stored, and the two sides read
  // the calendar in whichever language they have chosen.
  const title = `${game.homeTeam.name} - ${game.awayTeam.name}`;

  for (const teamId of [game.homeTeamId, game.awayTeamId]) {
    await prisma.teamEvent.upsert({
      where: { teamId_gameId: { teamId, gameId } },
      create: {
        teamId,
        gameId,
        type: 'MATCH',
        title,
        startsAt: game.date,
        location: game.location,
      },
      // Only what the fixture owns is overwritten. A manager may have added a
      // note or corrected the venue on their own copy; that survives a reschedule.
      update: {
        startsAt: game.date,
        title,
      },
    });
  }
};
