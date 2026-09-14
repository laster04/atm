/**
 * Lists upcoming fixtures whose stored time may be two hours off, for the
 * people running each competition to check. Reads only; changes nothing.
 *
 * Until game times were unified, two screens disagreed about what a stored
 * time meant. The season manager saved a real instant (19:30 in Prague as
 * 17:30 UTC). The admin game form and tournament schedule generation saved the
 * typed wall-clock time as if it were UTC (19:30 as 19:30 UTC). Nothing records
 * which screen wrote a given game, so there is no safe automatic migration:
 * every time is now shown as an instant in Europe/Prague, and anything written
 * the old way shows one or two hours late.
 *
 * For each upcoming game this prints both readings. Whoever knows the real
 * kick-off picks the right one and corrects the game in the app if needed.
 *
 *   npx tsx prisma/review-game-times.ts
 */
import { PrismaClient } from '@prisma/client';
import { APP_TIME_ZONE } from '../src/utils/time.js';

const prisma = new PrismaClient();

const asInstant = new Intl.DateTimeFormat('cs-CZ', {
  timeZone: APP_TIME_ZONE,
  dateStyle: 'short',
  timeStyle: 'short',
});
const asWallClock = new Intl.DateTimeFormat('cs-CZ', {
  timeZone: 'UTC',
  dateStyle: 'short',
  timeStyle: 'short',
});

const describe = (date: Date) =>
  `now shown ${asInstant.format(date).padEnd(18)} | if typed the old way ${asWallClock.format(date)}`;

async function main() {
  const now = new Date();

  const games = await prisma.game.findMany({
    where: { date: { gte: now } },
    orderBy: [{ seasonId: 'asc' }, { date: 'asc' }],
    select: {
      id: true,
      date: true,
      updatedAt: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
      season: { select: { name: true, league: { select: { name: true } } } },
    },
  });

  const tournamentGames = await prisma.tournamentGame.findMany({
    where: { date: { gte: now } },
    orderBy: [{ tournamentId: 'asc' }, { date: 'asc' }],
    select: {
      id: true,
      date: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
      tournament: { select: { name: true, series: { select: { name: true } } } },
    },
  });

  let heading = '';
  for (const game of games) {
    const title = `${game.season.league.name} — ${game.season.name}`;
    if (title !== heading) {
      console.log(`\n${title}`);
      heading = title;
    }
    console.log(`  ${game.homeTeam.name} – ${game.awayTeam.name}`.padEnd(48), describe(game.date!), `(${game.id})`);
  }

  heading = '';
  for (const game of tournamentGames) {
    const title = `${game.tournament.series.name} — ${game.tournament.name} (turnaj)`;
    if (title !== heading) {
      console.log(`\n${title}`);
      heading = title;
    }
    const sides = `${game.homeTeam?.name ?? '?'} – ${game.awayTeam?.name ?? '?'}`;
    console.log(`  ${sides}`.padEnd(48), describe(game.date!), `(${game.id})`);
  }

  console.log(`\n${games.length} league and ${tournamentGames.length} tournament games upcoming.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
