# Statistics by sport (roadmap phase 1, next item)

> **Status:** built 16 Oct 2026 on branch feat/sport-stats (from main after #38), uncommitted. Backend 424 tests green; football, basketball and volleyball checked in the browser on local test leagues.

## Context
Every sport is recorded the hockey way today:
- player lines are goals, assists and penalty minutes (`HockeyGameStatistic`)
- the score has exactly three periods (`Game.period1..3Home/AwayScore`)
- the match report knows goals, penalties, goalie changes and shootouts

Summer leagues start in April 2027 (roadmap page 10, phase 1): small football, floorball, and later basketball and volleyball. They need their own numbers before then.

Decided with the user (16 Oct 2026):
- This round covers **football, floorball, basketball and volleyball**. Handball and tennis keep today's fields until a league asks.
- The **score follows the sport** too: halves, quarters or sets instead of three fixed periods.

## Approach: one sport profile drives everything
A new `SPORT_PROFILES` table in code, like `SPORT_POSITIONS` (`backend/src/utils/playerPositions.ts`, mirrored in the frontend). It says, per sport:

| Sport | Score parts | Score is | Player stats |
|---|---|---|---|
| Hockey | 3 periods (+ OT, shootout) | goals | goals, assists, penalty minutes |
| Floorball | 3 periods (+ OT, shootout) | goals | goals, assists, penalty minutes |
| Football | 2 halves (+ penalties) | goals | goals, assists, yellow cards, red cards |
| Basketball | 4 quarters (+ OT) | points | points, fouls |
| Volleyball | up to 5 sets | sets won (3:1) | none |
| Handball, tennis, other | as today | as today | as today |

Every screen and query reads the profile instead of assuming hockey. Adding a sport later means adding a row.

### Data (`schema.prisma` + migration)
- **Player lines:** `HockeyGameStatistic` becomes `PlayerGameStatistic`. It keeps `goals`, `assists`, `penaltyMinutes` and gets `yellowCards`, `redCards`, `points`, `fouls`, all nullable.
  - These are typed columns, not JSON, so leaderboards stay plain `groupBy` sums.
  - The migration renames the table and moves no data.
  - `SeasonArchivePlayerStat` gets the same new columns.
- **Score parts:** `Game.periodScores Json?` replaces `period1..3HomeScore/AwayScore`. It is a list `[{ home, away }]`: halves, quarters or sets, with overtime as an extra entry.
  - The migration copies the existing three periods into it, then drops the old columns.
- **Volleyball:** `homeScore`/`awayScore` hold the **sets won**, computed from the set scores on save. The points of each set live in `periodScores`.

### Backend
- **Profile:** `services/sports/profile.ts` holds `SPORT_PROFILES` and helpers such as `statsFor(sport)`. A game's sport comes from its season's league.
- **Statistics API** (`gameStatisticController.ts`):
  - It accepts only the stats of the game's sport, so cards are refused on a hockey game and fouls on a football game.
  - The team endpoints return them the same way.
- **Match report** (`matchEventController.ts`, `services/matchEvents/derive.ts`):
  - New event type `CARD` (yellow or red) for football.
  - `derive.ts` writes `periodScores` for any number of parts, and card counts into the player lines.
  - Basketball and volleyball get no event log this round (decision 3). Their results and player lines are entered by hand.
- **Leaderboards and totals:** these all choose their columns and sort key from the profile.
  - Covered: `getTopScorers`, the season top list, `playerController` career totals, the round summary e-mail lines (`services/digest/roundSummary.ts`) and the season archive.
  - Sort key: hockey/floorball by points (G+A), football by goals, basketball by points.
  - The global stats page shows one sport at a time, because mixed totals mean nothing.
- **Scoring:** volleyball tables can score by set result (decision 1) through the existing `otWinPoints`/`otLossPoints` in `services/scoring/policy.ts`. Here "decided after regulation" means "went to the fifth set".

### Frontend
- **Profile mirror:** `utils/sportProfiles.ts`, kept in step with the backend like `playerPositions.ts`.
- **Entering results:**
  - `SeasonManager/components/ResultSheet.tsx` and `Admin/.../GameFormModal.tsx` show score-part inputs from the profile: halves, quarters, or sets with points per set.
  - For volleyball the final score is computed from the sets.
- **Player lines:** `TeamManager/components/GameStatsPage.tsx` and `Admin/.../GameStatistic(sModal).tsx` show the columns of the game's sport.
- **Match report:** `MatchReportSheet.tsx` offers the event types of the sport (cards for football).
- **Showing stats:** these screens use profile columns and labels:
  - `SeasonDetail/components/PlayersStatsTable.tsx` and `TopScorers`
  - `Stats/Screen.tsx`, which gets a sport filter
  - `PlayerDetail` statistics and `Players/Screen.tsx`
  - the team pages
  - `GameSchedule.tsx` period line, as "(1:0, 2:1)" or "25:21, 23:25, 25:19"
- **Texts:** all labels in `en.json` and `cs.json` (poločas, čtvrtina, set, žlutá/červená karta, body, fauly…).

### Out of scope
- Tournaments (`TournamentGameStatistic`) keep goals and assists. The profile is shared, so they can switch to it later in the same way, matching the shared play-off generator.
- Handball and tennis profiles.
- Live entry from a phone (phase 3 item).

## Order of work
1. **Profile and rename:** `SPORT_PROFILES` and the `PlayerGameStatistic` rename, with no visible change. The whole test suite stays green.
2. **Score parts:** `periodScores`, with the data migration, `derive.ts` and the result inputs per sport.
3. **Football:** cards in the match report and in player lines.
4. **Basketball and volleyball:** points and fouls lines; volleyball sets and the sets-won score; volleyball scoring (decision 1).
5. **Display:** leaderboards, tables and pages driven by the profile; the sport filter on the stats page.
6. **Texts and docs:** i18n, and the help article on entering results if it mentions periods.

## Verification
- Unit tests for the profile helpers: stats per sport, score parts, volleyball sets-won from set scores.
- **Migration test:** existing three-period games keep their period scores in `periodScores`, and existing player lines keep their numbers.
- **API tests:**
  - a card is refused on a hockey game and accepted on football
  - basketball points and fouls round-trip
  - volleyball 3:1 is computed from four sets
  - football cards from the match report land in the player line
  - leaderboards sort by the sport's key
- Run the whole existing suite (`npm test`) and the frontend typecheck (`npx tsc --noEmit -p tsconfig.json`).
- **Manual check** in the browser on local test leagues: one each for football, basketball and volleyball. Enter a result with its parts, player lines, and a football match report with a card, then check the public season page and the stats page.

## Decisions (16 Oct 2026)
1. **Volleyball table points:** the season manager chooses in the scoring sheet. Either plain win/loss points, or points by set result: 3:0/3:1 win, 3:2 win, 2:3 loss and other losses each get their own points (default 3/2/1/0). It is stored in the existing `otWinPoints`/`otLossPoints`; a volleyball game that went to five sets counts as decided after regulation.
2. **Volleyball player stats:** none.
3. **Basketball and volleyball:** results and player lines entered by hand; no event log this round.
4. **Basketball player line:** points and fouls.
