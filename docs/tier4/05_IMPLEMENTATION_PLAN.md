# Tier 4 — Implementation plan

The design package in this folder (01–04 and `screens/`) describes where the
manager UI, the help centre and the updates/contact pages should end up. This
file turns it into work that can be built against the code as it is on
2026-09-14: which files change, what the database needs, what depends on what,
and **what has to be decided before a phase can start**.

Every finding in the audit was checked against the source; the results are in
[01 — Ověření proti kódu](01_ADMIN_UX_AUDIT.md#ověření-proti-kódu-14-9-2026).
Where the design and the code disagreed, the specs were corrected to the code
and the difference is recorded here.

| # | Phase | Depends on | Size | Decisions open |
|---|-------|-----------|------|----------------|
| 0 | [Stability fixes](#phase-0--stability) | — | M | — (D1 decided) |
| 1 | [Shared manager shell and context switcher](#phase-1--shared-manager-shell-and-context-switcher) | 0 | L | D4, D11 |
| 2 | [Team manager, mobile-first](#phase-2--team-manager-mobile-first) | 1 | L | D6 (D2, D3 decided) |
| 3 | [League manager workflow](#phase-3--league-manager-workflow) | 0 | M | — |
| 4 | [Help centre `/docs`](#phase-4--help-centre-docs) | 1; TM articles after 2 | M | D9 |
| 5 | [Updates and contact](#phase-5--updates-and-contact) | — | M | D7, D8, D10 |
| — | [Frontend test tooling](#testing) | — | S | D5 |

Phases 3 and 5 do not depend on the shell and can run in parallel with 1–2.

## Rules that apply to everything here

1. **Permissions come from manager relations, never from `Role`.** `Role` is
   `ADMIN | USER`. There is no `TEAM_MANAGER`, `LEAGUE_MANAGER` or
   `TOURNAMENT_MANAGER`, and none may be reintroduced — not in the schema, the
   API, the UI copy or the docs. New checks go into
   `backend/src/services/access.ts` and are applied through
   `backend/src/middleware/access.ts`. The client reads `user.manages`.
2. **Every UI string goes into `en.json` and `cs.json` in the same change.**
   Help articles, release notes and roadmap items are content, not locale keys,
   but they also exist in both languages (D9).
3. **The match report is the source of truth.** Once a game has events
   (`Game.eventsAuthoritative`), score and player statistics derive from them;
   standings count confirmed games only (`services/standings/filters.ts`).
   Nothing in this tier weakens that.
4. **Tournaments stay a separate product.** Shell and docs work may cover the
   tournament manager, but no tournament table gains a link to league data.
5. **No new runtime library without a decision.** Where one is proposed below
   it is listed as a decision.

## Decisions to make

**Decided 2026-09-14:** D1 and D3 as recommended. D2 follows from D3 — each team
manager picks event players from their own line-up, so the line-up must be its
own data. Screens: design canvas *ATM — veřejná část*, pages *Tier 4*.

| ID | Question | Blocks | Recommendation |
|----|----------|--------|----------------|
| **D1** ✔ decided | How are game times stored and shown? The app has two conventions today (see Phase 0). | 0.6 | Store a real instant in UTC. Show every time in one app zone, `Europe/Prague`, until a league needs another. Convert existing data once — see 0.6 for why that step needs a human. |
| **D2** ✔ decided | Where does a line-up live? Today "in the line-up" = a `HockeyGameStatistic` row exists, which locks as soon as a match report starts. | 2.4 | New table `GameLineupEntry`. Keep statistics for games without a report. |
| **D3** ✔ decided | May a team manager record match events? Today only the league side can (`canManageMatchEvent`). | 2.5 | Yes, for **their own team's events only** (who played, goals, assists, penalties), on an unconfirmed game. Both teams fill in their side; the league manager confirms the report and only then does it count in the table. Score shows as provisional until then. |
| D4 | What does the context switcher offer for a team? A team is not tied to one season. | 1.2 | Team, then the season it currently plays in; other seasons as a filter, not a context. |
| D5 | Frontend test runner. The frontend has none; the audit asks for component tests. | 0.1, 0.2, 0.6 checks | Vitest + Testing Library as dev dependencies. Playwright later, not in this tier. |
| D6 | Player positions and an "active" flag. `position` is free text; there is no active flag, captain or goalie. | 2.3 | Per-sport position list in frontend config, stored in the same string column; map existing values. Skip active/captain/goalie in this tier. |
| D7 | Where do release notes and roadmap items come from? | 5.1 | TypeScript data in the repo, added in the same PR as the change. No version numbers — the app has none (`0.0.0`). |
| D8 | Rate limiting for the contact form. The backend has none. | 5.3 | `express-rate-limit` on `POST /api/contact` only. |
| D9 | Help articles in English as well as Czech? | 4 | Yes — required by the i18n rule. If Czech-first is wanted, record it as an explicit exception. |
| D10 | Where does a new support ticket go? No support channel exists. | 5.3 | Env var `SUPPORT_EMAIL`; if unset, every active `ADMIN`. Tickets also listed in `/admin`. |
| D11 | Shell colour. The audit wants a neutral shell with the team colour as an accent; the current decision is admin gold, season navy, team shell in the team's own colour. | 1.1 | Keep the three shell identities, but never use an arbitrary team colour as a background without a contrast check; fall back to navy with a team-colour accent when contrast fails. |

## Phase 0 — Stability

Makes the current app safe to use before any redesign. Everything here is a
confirmed bug.

### 0.1 `New season` blanks the page

`SeasonFormModal` (`pages/Admin/components/seasons/`) starts with
`DialogHeader`/`DialogTitle` and expects a `<Dialog><DialogContent>` around it.
Neither `pages/SeasonManager/Screen.tsx` nor `pages/Admin/pages/SeasonsPage.tsx`
provides one, so `DialogTitle` throws — at every width, and for **Add Season**
in `/admin` too. The same unwrapped pattern is in
`SeasonManager/components/TeamsTab.tsx` (`TeamFormModal`, **Přidat tým**) and
`SeasonManager/components/MoreTab.tsx` (`GenerateScheduleModal`,
**Vygenerovat rozpis**); from the code they must fail the same way — confirm in
the browser before and after the fix. The other admin callers
(`UsersTable`, `LeaguesTable`, `PlayersTable`, `PlayerDetailPage`, `GamesTable`)
wrap correctly.

- Move the `Dialog`/`DialogContent` wrapper into `SeasonFormModal` itself (open
  state from the caller), so no caller can forget it; apply the same to all nine
  modals in `pages/Admin/components/` and remove the wrappers from their callers.
- Add `components/ErrorBoundary.tsx` with a translated fallback (retry, back to
  dashboard) and put it around the `<Outlet />` of every manager layout, so one
  broken sheet cannot blank the shell.

### 0.2 Team manager bottom navigation wraps

`pages/TeamManager/Detail.tsx` uses `grid grid-cols-4` for five tabs, so
**Nastavení** lands on a hidden second row.

- `grid-cols-5`, labels that fit at 360 px, `padding-bottom` on the content
  equal to nav height plus `env(safe-area-inset-bottom)` (`.tm-bottom-nav` in
  `frontend/style/theme.css`).
- Phase 2 replaces the tab set; this fix ships first regardless.

### 0.3 Missing translation

`common.name` is used in `TeamManager/components/RosterTab.tsx` and missing from
both locale files. Add it. While there, grep for other keys used in code but
absent from `cs.json`/`en.json` — a small script in `frontend/scripts/` that
lists them is worth keeping.

### 0.4 Accessible names

- Back buttons in the season and team manager layouts: `aria-label` that says
  where they go.
- `SeasonManager/components/RoundDatesSheet.tsx`: label every date/time input
  with the fixture it belongs to.
- `SeasonManager/components/ResultSheet.tsx`: period inputs and +/− buttons
  name the team and the quantity.
- Overlays that are not `Dialog`/`Sheet` get proper dialog semantics.

### 0.5 `Pozvat manažera` shown to people who cannot use it

`TeamManager/components/SettingsTab.tsx` shows the button when
`isSeasonManager()` — any league manager anywhere — but the API
(`requireTeamAdmin`) only accepts the manager of a league the team plays in, or
an admin. A team manager never gets it.

- Return `canAdminister: boolean` from the authenticated team endpoint, computed
  with `canAdministerTeam`, and gate the button on it. Same flag gates team
  deletion in the UI.

### 0.6 Two-hour shift between public pages and management

Two conventions coexist:

| Where | Reads/writes | Treats a stored time as |
|-------|--------------|-------------------------|
| `utils/date.ts` (`formatGameDateTime`, `formatGameTime`, `formatDateShort`, `formatDateTimeForInput`) — public pages, `/admin` game form | `timeZone: 'UTC'` | wall-clock time written as UTC |
| `SeasonManager/components/util.ts` (`toLocalInput`, `fromLocalInput`), ~24 `toLocale*` calls in season and team manager | browser zone | a real instant |

After **D1**:

1. One module, `utils/date.ts`, with `APP_TIME_ZONE = 'Europe/Prague'`: format
   helpers, `toZonedInput(iso)` and `fromZonedInput(value)` that convert
   between the input value and a UTC instant **in the app zone**, not the
   browser's. Replace every direct `toLocale*` call on game, tournament game and
   team event dates.
2. `/admin` `GameFormModal` and the tournament game forms use the same
   converters.
3. **Existing data.** Nothing records which screen entered a date, so there is
   no exact migration. Games last written through `/admin` are shifted, games
   written through the season manager are right. Recommended: a one-off script
   in `backend/scripts/` that lists future fixtures with their stored value in
   both readings, grouped by season, for the league managers to confirm;
   correct the ones they flag. Do not shift everything blindly.
4. Tests: formatter and converter unit tests across both DST changes (needs
   D5); a backend test that a game created through the API round-trips the same
   instant.

## Phase 1 — Shared manager shell and context switcher

### 1.1 One shell

`components/manager/ManagerShell.tsx`: desktop sidebar, mobile top bar with
context and back action, bottom navigation of at most five items that never
wraps, safe-area aware, one place for the user menu and (later) help.

Migrate `SeasonManagerLayout`, `TeamManagerLayout`,
`TournamentManagementLayout` and `AdminLayout` onto it, keeping each area's
identity (D11). Team colour goes through `utils/contrast.ts` — pick black or
white text, and fall back to navy with an accent when the colour cannot carry
text at WCAG AA. Mind the Tailwind alpha-token limitation: `token/alpha`
classes emit nothing except on `muted`, so use explicit colours.

### 1.2 Context switcher

- **API:** `GET /api/auth/contexts` → the leagues the user manages (with their
  seasons), teams (with the season they currently play in) and tournament
  series; everything for an admin. Built from the manager relations; it grants
  nothing — every request is still authorised on its own.
- **UI:** `components/manager/ContextSwitcher.tsx`, labels **Manažer ligy /
  Manažer týmu / Manažer turnaje** + name + season (D4). Switching navigates to
  that area's route; it does not change permissions.
- Backend test: contexts for a user who manages a league and a team in it, and
  for one who manages nothing.

### 1.3 Dashboard

`pages/Home`: sections per managed area from the contexts endpoint.

- Season card opens `/season-management/:id`; **Veřejná stránka** is a secondary
  action (today `ActiveSeasonsSection.tsx` links to `/season-detail/:id`).
- League section: games without a date, games awaiting confirmation, next
  games, quick actions.
- Team section: next game, line-up state (after 2.4), incomplete player
  profiles, next team event.
- Move the round-summary email opt-out (`User.emailDigest`) to an account
  settings page.
- Replace the generic "Amateur Team Manager" heading with a working title.

## Phase 2 — Team manager, mobile-first

Implements [02](02_TEAM_MANAGER_MOBILE_SPEC.md) on the new shell.

### 2.1 Navigation

**Přehled · Soupiska · Zápasy · Kalendář · Více**. **Více** holds team
settings, public profile, help, and — only when `canAdminister` — manager
invitation and team deletion.

### 2.2 Overview

Next game first (opponent, home/away, date and time in the app zone, place,
line-up `12/17`, **Nastavit sestavu**), then next team event, incomplete-profile
warning, further games, season record. At most three quick actions.

### 2.3 Roster

- Compact rows: number, name, position, profile state.
- Filter **Neúplné údaje** (missing number or position).
- Warn on duplicate shirt numbers in the team (client-side; no constraint).
- Search the team roster before **Přidat hráče** opens a blank form.
- Position from a per-sport list (D6): `frontend/src/config/positions.ts` keyed
  by `SportType`, stored in `Player.position`; unknown legacy values shown as
  typed with a prompt to pick one.
- Player detail: edit first, then account link, then statistics. Account link
  explains what access the player gets.

### 2.4 Line-up (D2)

```prisma
model GameLineupEntry {
  id        String   @id @default(uuid())
  gameId    String   @map("game_id")
  game      Game     @relation(fields: [gameId], references: [id], onDelete: Cascade)
  teamId    String   @map("team_id")
  team      Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  playerId  String   @map("player_id")
  player    Player   @relation(fields: [playerId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now()) @map("created_at")

  @@unique([gameId, playerId])
  @@index([gameId, teamId])
  @@map("game_lineup_entries")
}
```

- `GET /api/games/:gameId/lineup/:teamId`, `PUT` (full replace) —
  `requireTeamAccess('teamId')`, team must be one of the game's two sides,
  rejected once the game is confirmed or the season archived. Not blocked by
  `eventsAuthoritative`.
- Migration: create entries from existing `HockeyGameStatistic` rows so past
  line-ups survive.
- Decide in review whether "games played" in player totals and the season
  archive should count line-up entries instead of statistic rows; today
  `SeasonArchivePlayerStat.gamesPlayed` comes from statistics.
- UI `pages/TeamManager/components/LineupPage.tsx`: search, `Vybráno X z Y`,
  all/selected toggle, **Vybrat poslední sestavu**, **Vybrat všechny**,
  **Zrušit výběr**, one sticky **Uložit sestavu**. No goals, assists or
  penalties.
- Backend tests: access (own team, other team, league manager, visitor), lock
  after confirmation, replace semantics.

### 2.5 Match report for the team manager (D3)

Decided (D3):

- `canManageMatchEvent` / create-event check: league side as today, **or** the
  manager of `MatchEvent.teamId`, only while the game is unconfirmed. A team
  manager may not touch the opponent's events, confirm, or reopen.
- Mobile report screen in the team area reusing the season manager's event
  forms: sticky provisional score, **Přidat událost** → **Gól** / **Trest**,
  players from the line-up first, others with a warning, chronological list with
  edit/delete.
- `GameStatsPage.tsx` loses its line-up checkbox and stays only for games
  without a report — or is removed if every team records events.
- Audit entries for team-manager edits come for free through the existing
  match-event audit path; verify with a test.

Event players come from that team's line-up (2.4); a player outside the line-up
can be picked only with a warning.

### 2.6 Calendar, settings, saving

- Event form: visible labels, native date/time inputs, warn before discarding.
- Settings: sections per spec 02 §7; colour preview through `utils/contrast.ts`.
- One saving model per screen; disable submit while a request is running so a
  double tap cannot create two players or events.
- No offline cache in this tier (no service worker exists).

## Phase 3 — League manager workflow

- **Games tab:** group by round, collapse finished rounds, filters stay sticky.
- **Round dates:** `RoundDatesSheet` already saves only changed games; add a
  default date/time for the round and the labels from 0.4.
- **Generate schedule:** before confirming, say how many games will be deleted
  and how many of them have a result (count from the season's games).
- **Remove team from season:** before confirming, say how many games and results
  will be deleted with it (`removeTeamFromSeason` deletes them in a
  transaction). Consider refusing when the team has confirmed games.
- **Score validation without a report:** when a game has no events, warn in
  `ResultSheet` and at **Potvrdit zápis** if the recorded score differs from the
  goals in its player statistics. Warn, do not block.

## Phase 4 — Help centre `/docs`

Implements [03](03_DOCUMENTATION_SPEC.md).

- Route `/docs` and `/docs/:slug` inside `PublicLayout` in `App.tsx`;
  `pages/Docs/` lazily imported.
- Content in `frontend/src/content/docs/*.ts` (`DocsArticle`, cs + en, D9);
  publish only articles whose feature is live — line-up and team match report
  wait for Phase 2.
- Search on `components/public/SearchBox.tsx`, diacritic-insensitive, published
  articles in the current language only.
- Recommended articles from `user.manages`; admin gets all.
- `document.title` and meta description set in an effect; no canonical URL or
  sitemap in this tier.
- Links: `PublicHeader` (desktop + mobile), `PublicFooter` group `Projekt`,
  `Navbar` user menu, help icon in `ManagerShell`, contextual links per the
  mapping table in 03 (hidden for unpublished articles).

## Phase 5 — Updates and contact

Implements [04](04_UPDATES_CONTACT_SPEC.md).

### 5.1 `/updates`

- `frontend/src/content/updates.ts`: `ReleaseNote[]` and `RoadmapItem[]`,
  cs + en, no versions (D7). Seed with the real releases (Tier 1 on
  2026-09-12, Tier 2 on 2026-09-13, Tier 3 slice on 2026-09-14) and roadmap
  items from this tier and `docs/tier3`; nothing already shipped goes on the
  roadmap.
- Tabs **Vydané** / **Připravujeme**, each its own URL
  (`/updates`, `/updates/roadmap`).

### 5.2 Unread indicator

- `User.updatesSeenAt DateTime? @map("updates_seen_at")`.
- `POST /api/auth/updates-seen` sets it to now; `/auth/me` returns it.
- Dot on **Co je nového** when a published release is newer.

### 5.3 `/contact`

```prisma
enum SupportCategory { QUESTION PROBLEM COMPLAINT IDEA }
enum SupportTicketStatus { NEW IN_PROGRESS WAITING_FOR_USER RESOLVED CLOSED }

model SupportTicket {
  id          String              @id @default(uuid())
  category    SupportCategory
  subject     String
  message     String
  email       String?
  context     Json?               // only when the user ticked the box
  status      SupportTicketStatus @default(NEW)
  clientToken String              @unique @map("client_token") // idempotency
  userId      String?             @map("user_id")
  user        User?               @relation(fields: [userId], references: [id], onDelete: SetNull)
  createdAt   DateTime            @default(now()) @map("created_at")
  updatedAt   DateTime            @updatedAt @map("updated_at")

  @@index([status, createdAt])
  @@map("support_tickets")
}
```

- `backend/src/routes/contact.ts`: `POST /api/contact` with `optionalAuth`,
  server validation and length limits, honeypot field, rate limit (D8); a repeat
  `clientToken` returns the first ticket instead of creating a second.
- Status changes go through the existing audit log.
- Notification through `services/emailService.ts` to `SUPPORT_EMAIL` or admins
  (D10), user input escaped in the mail body.
- `GET /api/contact`, `PUT /api/contact/:id` behind `authorize('ADMIN')`;
  page `/admin/support`.
- No attachments, CAPTCHA, analytics or case numbers in this tier.
- Backend tests: validation, honeypot, idempotency, admin-only listing,
  notification called.

## Testing

- **Backend** (Jest, `backend/src/__tests__/`): one file per new endpoint or
  access change — contexts, line-up, team-manager match events, contact,
  updates-seen.
- **Frontend** (after D5): `ErrorBoundary`, `SeasonFormModal` open/close inside
  the season manager, bottom navigation renders five items in one row,
  date helpers across DST, locale-key check.
- **Manual matrix** for every phase that touches UI: 360 × 800, 390 × 844,
  430 × 932, 768 × 1024, 1024 × 768, 1440 × 900; accounts — visitor, team
  manager only, league manager only, league + team manager, tournament series
  manager, admin.

## Removed from the original plan

Kept out of this tier on purpose, each because the project has nothing to build
it on yet: offline cache, captain/goalie/active-player flags, canonical URLs
and sitemap, analytics, version numbers, CAPTCHA, attachments, generated case
numbers. The original plan's "single source of truth for the score" is already
implemented; only validation for games without a report remains (Phase 3).
