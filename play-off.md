# Play-off in a season (roadmap phase 1, first item)

> **Status:** built 16 Oct 2026 on branch feat/season-playoff (uncommitted). Backend 413 tests green, UI checked in the browser on a local "Play-off test" league. Decisions below were made with the user.

## Context
Hobby hockey leagues finish their season with a play-off in Feb–Mar 2027, during their first season on ATM. Seasons have no knockout stage today; only tournaments do (`tournamentPlayoffController.ts`). Canvas page 8 (P1) and roadmap page 10 make this the first item of phase 1.

Decided with the user (15 Oct 2026):
- A round is a **series**. The manager picks best-of 1/3/5/7 **per round**.
- Qualifiers = **top N of the overall table**, seeded 1..N. Divisions are ignored.
- **Byes** for the top seeds when N is not a power of two (N = 2–16).
- The bracket can be created **any time**. It shows seeds ("1. vs 8.") until every regular-season game is settled, then the teams fill in automatically.

Play-off games **must not count in the table**. A play-off game needs a winner (the final score includes overtime or a shootout).

Order of work:
1. Tournament play-off tests (they pin today's behaviour).
2. Shared `bracket.ts`, with the tournament switched onto it.
3. Season data and sync.
4. API.
5. UI.

## Readiness check (16 Oct 2026, before starting)
- **Branch:** main is at `28fff4d` (#37 merged), so start from it on a new `feat/season-playoff` branch. Only my `play-off.md` and your draft locales are untracked.
- **Seeding tie-break (correction to the plan):**
  - The tournament code ranks qualifiers by points, goal difference, goals for.
  - A season table is ranked by `rankTable` (`services/standings/compute.ts`), using the league's own tiebreakers, head-to-head included.
  - So `seedsFromTables` takes **already-ranked tables** and keeps their order inside a table. It compares points → goal difference → goals for only across groups at the same rank (tournament). A season passes one table, so its seeds are exactly the official table order.
- **Tournament hooks to keep:** `tournamentGameController.updateGame` calls `resolvePlayoffSeeds` after a COMPLETED group game, and `advancePlayoffBracket` after every update. These calls stay where they are and only their bodies switch to the shared functions. Tournaments have no confirmation step; seasons advance only on confirm or reopen.
- **Tournament deletes:** a play-off game can be deleted with no guard (`tournamentGameController.deleteGame`). Noted, not changed here.
- **Canvas:** page 10 says the chat link is "waiting for merge"; it is merged. Fix it when the play-off card is next updated.
- **`play-off.md`:** the copy in the repo predates this check. Copy this plan over it first thing once plan mode ends.

## Approach: a series table, games only once both teams are known
`Game.homeTeamId` and `awayTeamId` are required and many places rely on that (match report, stats, confirmation, team calendar, digests). So the bracket lives in a new `PlayoffSeries` table. Real `Game` rows are created for a series only once both of its teams are known. Every existing game feature then works on play-off games unchanged.

### Data (`backend/prisma/schema.prisma` + migration)
- `enum PlayoffRound { ROUND_OF_16 QUARTER_FINAL SEMI_FINAL FINAL BRONZE }`
- `model PlayoffSeries` (`playoff_series`) has these fields:
  - `id`, `seasonId` (Cascade)
  - `round`, `slot` (`@@unique([seasonId, round, slot])`)
  - `bestOf`
  - `homeSeed?`, `awaySeed?` (home = better seed; carried forward on advance)
  - `homeTeamId?`, `awayTeamId?`, `winnerTeamId?` (Team, SetNull)
  - timestamps
- `Game.playoffSeriesId String?`, relation, Cascade. Play-off games keep `round = null`.
- `Season.playoffSeries PlayoffSeries[]`

### One generator for seasons and tournaments: `backend/src/services/playoff/bracket.ts`
The user asked for the same generators in both use cases. Bracket logic therefore moves out of `tournamentPlayoffController.ts` into pure functions that both use. Only the storage differs:
- A tournament keeps one `TournamentGame` per slot, with nullable teams.
- A season keeps a `PlayoffSeries` per slot plus real `Game` rows.

The shared functions:
- **`seedOrder(n)`:** moved as is.
- **`seedsFromTables(rankedTables, perTable)`:**
  - Takes tables that are already ranked and keeps their order inside each table.
  - Across groups at the same rank (winners first, then runners-up…) it compares points → goal difference → goals for, as tournaments do today.
  - A season passes its one table, ranked by `rankTable`, so its seeds follow the league's own tiebreakers; a tournament passes its group tables.
- **`buildBracket(qualifiers, { bronze })`:** bracket size B = next power of two ≥ qualifiers, pairs from `seedOrder(B)`.
  - A pair with a seed > qualifiers is a **bye**: no first-round slot, and that seed is pre-placed in its second-round slot.
  - Returns `{ round, slot, homeSeed, awaySeed }[]`, with the round names (`ROUND_OF_16`…`FINAL`, `BRONZE`) shared by both.
- **`advanceTarget(round, slot)`:** gives the next round's slot, home or away; a semi-final loser goes to `BRONZE`. Replaces the inline maths in `advancePlayoffBracket`.
- **`seriesWinner(results, bestOf)`:** a tournament is bestOf 1, a season is per round.

What the tournament side gets from this:
- `generateTournamentPlayoffs`, `resolvePlayoffSeeds` and `advancePlayoffBracket` call the shared functions. Behaviour stays the same for 2/4/8/16 qualifiers.
- Byes now work there too (e.g. 3 groups × 2 = 6 qualifiers, refused today).
  - `resolvePlayoffSeeds` resolves seeds in any round, not only the first.
  - It takes the qualifier count from the highest seed instead of `unresolved.length * 2`, which breaks with byes.
- Tournaments stay single games; the rest of tournaments is untouched.
- `TournamentDetail/components/PlayoffBracket.tsx` places games by `bracketSlot` instead of list order, and shows a bye card ("volný postup") where a first-round slot has no game.

There are no tournament play-off tests today, so tests come first (see Verification): they pin current tournament behaviour before the refactor.

Out of scope, noted for later: the round-robin generators are also duplicated, with the circle method in `tournamentGroupController.ts` and its own pairing loop in `gameController.generateSchedule`. Unifying them changes existing season schedules, so it's a separate task.

### Season series sync: `backend/src/services/playoff/sync.ts`
- `syncPlayoff(seasonId)`: idempotent, recomputes everything from confirmed games.
  1. **Seeds.** Unresolved and every non-play-off game is COMPLETED+confirmed or CANCELLED → seed from the official overall table (`computeTable`, same inputs as `getSeasonStandings` in `seasonController.ts`) and set the teams on the series.
  2. **Wins.** Per series with both teams: wins = confirmed games won. Needed = ⌈bestOf/2⌉. When a team reaches it → set `winnerTeamId` and move the winner (with its seed) into the next series (slot ⌊slot/2⌋, home/away by seed). A semi-final loser goes to BRONZE.
  3. **Games.** No winner yet → make sure open games (not played, not cancelled) = needed − max(wins). Bo3 starts with 2 games; at 1–1 game 3 is added. Each new game:
     - is undated
     - has the better seed at home in odd games
     - gets `syncFixtureEvents()` (`services/teamEvents/mirror.ts`), like `createGame` does.
     
     Winner decided → delete the open games left in that series that have no score and no events.
- Call `syncPlayoff` after every confirm or unconfirm path in `gameController.ts`: `confirmGame`, `reopenGame`, `updateGame` (`confirms` / `unconfirms` and an admin edit of a confirmed game).

### Guards (in `gameController.ts`)
- Confirm, or an admin save that confirms, a play-off game with equal scores → 400 "A play-off game needs a winner (count overtime or shootout)".
- Reopen or edit a play-off game whose series feeds a series that already has a confirmed game → 409 (the next round is already played).
- `deleteGame` and `createGame`: play-off games are managed through the bracket. Delete is refused; `playoffSeriesId` is not accepted on create.
- `generateSchedule` (it deletes every game of the season) → 409 while a bracket exists.

### Table stays clean (`services/standings/filters.ts`)
Add `playoffSeriesId: null` to `COUNTS_TOWARD_TABLE` and `PENDING_RESULTS`, and check it in `countsTowardTable()`. The table, live projection, archive and round summary all go through these filters. Player stats and leaderboards keep counting play-off games.

### API (new `seasonPlayoffController.ts`, routes in `routes/seasons.ts`)
- `GET /seasons/:id/playoff` (optionalAuth, `requireVisible('season')`) returns:
  - per series: teams, seeds and series score
  - its games (team refs, scores, status, confirmed)
  - `seedsResolved`, `bracketSize`
- `POST /seasons/:id/playoff` (`requireSeasonAccess`) takes `{ qualifiers: 2–16, bestOf: { [round]: 1|3|5|7 }, bronze: boolean }`.
  - Refused (409) if a bracket exists, or if `qualifiers` is more than the teams in the season.
  - Builds the bracket in one transaction, then runs `syncPlayoff` (fills teams straight away if the regular season is done).
- `DELETE /seasons/:id/playoff`: only while no play-off game has a score or is confirmed. Deletes series and games (Cascade).

### Frontend
- **Data layer:**
  - `types/index.ts`: `PlayoffSeries`, `PlayoffRound`, `Game.playoffSeriesId`
  - `services/api.ts`: `seasonApi.getPlayoff / createPlayoff / deletePlayoff`
- **Shared bracket:** `components/public/SeriesBracket.tsx`, used both public and in management.
  - Columns per round (same grid idea as `TournamentDetail/components/PlayoffBracket.tsx`).
  - Each card: team names, or "1. místo" / "8. místo" until seeds resolve; series score "2:1"; best-of label; game links.
  - Champion above the final, bronze under it.
- **Season manager:**
  - **Create:** `SeasonManager/components/PlayoffSheet.tsx`, opened from `MoreTab`. Form fields:
    - number of qualifiers (default 8, capped at the season's team count)
    - best-of per round present in the bracket
    - bronze toggle
    - live preview of first-round pairs and byes using current table names
    
    Once created, the sheet shows the bracket and a "Smazat play-off" button while that's allowed.
  - **Table tab** (`StandingsTab`): bracket under the table when one exists.
  - **Games tab** (`GamesTab`): "Play-off" filter chip next to the round chips. A play-off game shows "Čtvrtfinále · zápas 2" instead of the round.
  - A play-off game is entered, reported and confirmed exactly like any other game.
- **Public:** `SeasonDetail/Screen.tsx` gets a "Play-off" tab shown only when a bracket exists.
- **i18n:** every string in `en.json` and `cs.json` (round names, best-of, seed placeholders, errors). The draft de/pl/sk files stay untouched.

## Files
- **Backend, new:** `services/playoff/bracket.ts` (shared), `services/playoff/sync.ts`, `controllers/seasonPlayoffController.ts`, the migration, `__tests__/playoff-bracket.test.ts`, `__tests__/tournament-playoff.test.ts`, `__tests__/season-playoff.test.ts`
- **Backend, changed:** `schema.prisma`, `routes/seasons.ts`, `controllers/gameController.ts`, `services/standings/filters.ts`, `controllers/tournamentPlayoffController.ts` (onto the shared generator, byes), `types/index.ts`
- **Frontend, tournaments:** `TournamentDetail/components/PlayoffBracket.tsx` (place games by slot, bye cards)
- **Frontend, new:** `components/public/SeriesBracket.tsx`, `SeasonManager/components/PlayoffSheet.tsx`
- **Frontend, changed:** `MoreTab`, `StandingsTab`, `GamesTab`, `SeasonDetail/Screen.tsx`, `types`, `api.ts`, `en.json`, `cs.json`

## Verification
- **`tournament-playoff.test.ts`:** written and green before the refactor; still green after it.
  - 4 and 8 qualifiers from groups: pairs, seeds, bronze game created
  - generated before the group stage ends → seeds only; the last group game fills the teams
  - winner advances; semi-final loser goes to bronze
  - delete is refused once a result exists
  - new: 3 groups × 2 qualifiers → byes for seeds 1 and 2
- **`playoff-bracket.test.ts`:** unit tests for the shared module: `seedOrder`, `buildBracket` for 2–16 qualifiers (byes), `advanceTarget`, `seriesWinner`.
- **`season-playoff.test.ts`:**
  - `buildBracket` for 8 teams (1v8, 4v5, 2v7, 3v6) and for 6 (seeds 1 and 2 get byes into the semi-finals)
  - created mid-season → seeds only, no games; confirming the last regular game fills the teams and creates the first games
  - bo3: 2 games created; 1–1 → game 3 appears; 2–0 → open game 3 removed, winner moves into the next series
  - semi-final loser lands in bronze
  - play-off games stay out of `/seasons/:id/standings`
  - confirming a draw → 400
  - reopening a game whose next round is played → 409
  - regenerating the schedule with a bracket → 409; deleting the bracket after a result → 409
  - a stranger cannot create a bracket
- **Commands:** run `npm test` in the backend (whole suite) and `npx tsc --noEmit -p tsconfig.json` in the frontend. Don't use `tsc -b`, it emits stray files.
- **Manual:**
  1. Restart the backend container to apply the migration.
  2. In a test season, create a 6-team bracket mid-season and check the seed placeholders.
  3. Confirm the remaining games, check the teams fill in, play a bo3 series to 2–0, and check the public Play-off tab.
- **Afterwards:**
  - Leave the work uncommitted unless asked.
  - Update canvas page 10: play-off "in progress / done".
