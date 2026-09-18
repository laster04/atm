# Development plan

Status as of 2026-09-17, checked against the code on `main` (`9d3e515`).
Source of the phases: [tier4/05_IMPLEMENTATION_PLAN.md](tier4/05_IMPLEMENTATION_PLAN.md).
This file tracks **what is left** and in which order; the tier 4 plan keeps the
design detail.

## Overview

| # | Phase | State | Next step |
|---|-------|-------|-----------|
| 0 | Stability fixes | **Partly done** — 0.1, 0.3 done (browser check pending); 0.6 code done; 0.2, 0.4, 0.5 open | See [Phase 0](#phase-0--stability-detailed) |
| 1 | Shared manager shell + context switcher | Not started | Decide D4, D11 |
| 2 | Team manager, mobile-first | Backend for own-team match events done; rest not started | Decide D6 |
| 3 | League manager workflow | Not started | — |
| 4 | Help centre `/docs` | Done (routes, articles, lazy load) | Publish line-up / match report articles after Phase 2 |
| 5 | Updates and contact | Done except rate limit | `express-rate-limit` on `POST /api/contact` |
| 6 | PWA (new) | Not started, not in any plan until now | After Phase 2 |
| — | Free-tier quota | Deferred on purpose | Only when the user starts that phase |

Recommended order: **0 → 1 → 2 → 6a**, with 3 and the Phase 5 rate limit in
parallel whenever there is a gap. Phase 3 does not depend on the shell.

---

## Phase 0 — Stability (detailed)

Every item below was checked in the code. File paths are relative to
`frontend/src/` unless stated otherwise.

### 0.1 Modals without a `Dialog` wrapper blank the page — **done 2026-09-17, browser check pending**

`DialogTitle` (Radix, `components/base/dialog.tsx`) throws when rendered outside
`<Dialog>`. Three modals render `DialogHeader`/`DialogTitle` at the top level and
four call sites render them bare (`{show && <XModal …/>}`):

| Call site | Modal | Button |
|-----------|-------|--------|
| `pages/SeasonManager/Screen.tsx:127` | `SeasonFormModal` | **New season** |
| `pages/Admin/pages/SeasonsPage.tsx:266` | `SeasonFormModal` | **Add Season** (and edit) |
| `pages/SeasonManager/components/TeamsTab.tsx:96` | `TeamFormModal` | **Přidat tým** |
| `pages/SeasonManager/components/MoreTab.tsx:179` | `GenerateScheduleModal` | **Vygenerovat rozpis** |

Wrapped correctly today (leave working, but migrate with the refactor):
`PlayersTable` (`PlayerFormModal`, `MovePlayerModal`), `UsersTable`
(`UserFormModal`), `LeaguesTable` (`LeagueFormModal`), `GamesTable`
(`GenerateScheduleModal`, `GameFormModal`, `GameStatisticsModal`),
`Admin/pages/PlayerDetailPage` (`PlayerFormModal`, `MovePlayerModal`).

No error boundary exists anywhere (`grep ErrorBoundary` → nothing), so one throw
unmounts the whole app. The app uses `<BrowserRouter>` + `<Routes>`, so
`errorElement` is not available — a class component is needed.

**Tasks**

1. Move `<Dialog open onOpenChange={(o) => !o && onClose()}><DialogContent>`
   into each of the nine modals in `pages/Admin/components/**` that render
   `DialogTitle`: `SeasonFormModal`, `TeamFormModal`, `GenerateScheduleModal`,
   `GameFormModal`, `GameStatisticsModal`, `PlayerFormModal`, `MovePlayerModal`,
   `UserFormModal`, `LeagueFormModal`. Callers keep
   `{show && <Modal … />}` and drop their own `Dialog`/`DialogContent`.
   `GameStatisticsModal` needs `className="max-w-3xl"` passed through.
   `DialogTrigger` usages in `PlayersTable`/`UsersTable`/`LeaguesTable`/`GamesTable`
   become plain buttons that set state.
2. `components/ErrorBoundary.tsx`: class component, translated fallback
   (`errorBoundary.title`, `errorBoundary.retry`, `errorBoundary.backToDashboard`
   in `en.json` + `cs.json`), `resetKeys` on `location.pathname` so navigating
   away clears it.
3. Wrap `<Outlet />` in `pages/Admin/Layout.tsx:87`,
   `pages/SeasonManager/Layout.tsx:33`, `pages/TeamManager/Layout.tsx:36`,
   `pages/TournamentManagement/Layout.tsx:33`, `components/public/PublicLayout.tsx:14`
   and the account shell in `App.tsx:62`.

**Done when:** all four buttons in the table open their form at 390 px and at
desktop width, Escape and the close button close them, and a thrown error inside
a manager page shows the fallback with the shell still visible.

### 0.2 Team manager bottom navigation wraps — **open, confirmed**

`pages/TeamManager/Detail.tsx:231` uses `grid grid-cols-4` for five tabs
(overview, roster, schedule, events, settings), so **Nastavení** falls onto a
second row hidden under the safe area. `SeasonManager/Detail.tsx:265` already
uses `grid-cols-5` and is fine.

Found while checking — **likely second bug, verify in browser:** `.tm-content`
sets `padding-bottom: calc(3.5rem + safe-area + 1rem)` inside
`@layer components` (`frontend/style/theme.css:1311`), but the same elements
also carry the utility `py-4` (`TeamManager/Detail.tsx:191`,
`SeasonManager/Detail.tsx:226`, `Admin/Layout.tsx:86`). Utilities win over
components, so the bottom padding is probably 1rem and the last ~56 px of every
tab sit under the navigation.

**Tasks**

1. `grid-cols-4` → `grid-cols-5`; check the five labels fit at 360 px with the
   10.5 px label size (Czech labels are the longest).
2. Replace `py-4` with `pt-4` on the three `.tm-content` elements (keep
   `lg:py-6`), or move the padding into the class and drop the utility.

**Done when:** at 360 × 800 all five tabs are on one row and the last card of the
longest tab can be scrolled fully above the navigation, on both team and season
manager and in `/admin`.

### 0.3 Missing translations — **keys done 2026-09-17; checker script still open**

Keys used as `t('…')` in code and absent from **both** locale files:

| Key | Used in |
|-----|---------|
| `common.name` | `pages/TeamManager/components/RosterTab.tsx` |
| `common.unknown` | `pages/Admin/pages/PlayerDetailPage.tsx` |
| `admin.modal.period1`, `period2`, `period3`, `totalScore` | `pages/Admin/components/games/GameFormModal.tsx` |
| `activate.activating`, `error`, `failed`, `goToLogin`, `invalidToken`, `registerAgain`, `success`, `successMessage`, `title` | `pages/Activate/Screen.tsx` (route `/activate/:token` is live) |

The whole account-activation page therefore shows raw keys.

Also `public.leagues.activeCount` exists in `en.json` only as a plain key while
`cs.json` has the plural forms — check that English renders a plural correctly
(`_one`/`_other`).

**Tasks**

1. Add all 15 keys to `en.json` and `cs.json`.
2. Keep the checker: `frontend/scripts/check-i18n.mjs` — walks `src/**/*.ts(x)`,
   collects literal `t('…')` keys, reports keys missing from either locale
   (treating `_one/_few/_many/_other` suffixes as present) and keys present in
   one file only. Add `"i18n:check"` to `frontend/package.json`. Dynamic keys
   (template strings) are out of scope; list them as a warning.

**Done when:** the script prints nothing for missing keys, and `/activate/<bad-token>`
shows real text in both languages.

### 0.4 Accessible names — **open, confirmed**

| Where | Problem |
|-------|---------|
| `components/ManagerHeader.tsx:81`, `pages/TeamManager/Detail.tsx:120`, `pages/SeasonManager/Detail.tsx:153` | Icon-only back button, no `aria-label` |
| `pages/SeasonManager/components/ResultSheet.tsx:131,141` | `aria-label="-"` / `"+"` — does not say which team or what |
| `ResultSheet.tsx:157` | Close button (icon only) has no label |
| `ResultSheet.tsx:225,235` | Period score inputs have no label |
| `pages/SeasonManager/components/RoundDatesSheet.tsx:107,115` | Round default date/time inputs unlabelled |
| `RoundDatesSheet.tsx:154` | Per-game `datetime-local` not tied to its fixture |

Custom full-screen overlays (`fixed inset-0`) with no `role="dialog"`,
`aria-modal`, focus handling or Escape:
`SeasonManager/components/{RoundDatesSheet, RoundSummarySheet, ScoringSheet, DivisionsSheet, ResultSheet, MatchReportSheet}.tsx`,
`TeamManager/components/InviteManagerModal.tsx`,
`Admin/components/leagues/InviteLeagueManagerModal.tsx`,
`TeamDetail/components/PlayerFormModal.tsx`, `components/SpotlightTour.tsx`.

**Tasks**

1. Back buttons: `aria-label={t('common.backTo', { place })}` (new key, both
   locales).
2. Score steppers: `t('seasonManagement.result.decrease', { team })` /
   `increase`; period inputs `t('…period.homeScore', { n, team })`.
3. Round dates: visible or `aria-label` text for the default pair; per-game input
   gets `aria-labelledby` pointing at the fixture name span (give it an `id`).
4. Overlays: small hook `useOverlay(onClose)` — Escape closes, focus moves into
   the sheet on open and back to the trigger on close, body scroll locked; add
   `role="dialog" aria-modal="true" aria-labelledby`. Prefer converting the two
   invite modals to the base `Dialog` instead (they also use the old
   `bg-opacity-50` idiom).

**Done when:** axe DevTools reports no "button has no name" / "form element has
no label" on season manager Games, Result sheet, Round dates and team manager
Settings; every overlay closes with Escape and returns focus.

### 0.5 Invite-manager button shown to people the API refuses — **done 2026-09-18**

Frontend gate: `isAdmin() || isSeasonManager()`
(`TeamManager/components/SettingsTab.tsx:69`, `TeamDetail/Screen.tsx:121`);
`isSeasonManager()` is "manages any league anywhere"
(`context/AuthContext.tsx:88`).
Backend gate: `requireTeamAdmin()` → `canAdministerTeam` on
`POST /api/teams/:id/invite-manager` and `DELETE /api/teams/:id`
(`backend/src/routes/teams.ts:37-38`).
So a league manager from another league sees the button and gets 403.
`GET /api/teams/:id` (`optionalAuth`) does not return any permission flag.

**Tasks**

1. Backend: in `getTeamById`, when `req.user` is set, add
   `canAdminister: await canAdministerTeam(req.user, id)` to the response;
   `false` for anonymous. Add `canAdminister?: boolean` to `Team` in both
   `backend` response type and `frontend/src/types`.
2. Frontend: gate the invite card on `team.canAdminister` in both places.
3. Test in `backend/src/__tests__/` (new `team-access.test.ts` or existing
   `api.test.ts`): admin → true, manager of a league the team plays in → true,
   manager of another league → false, team's own manager → false, anonymous →
   false.

**Done when:** tests pass and the button is visible only when the POST would
succeed.

### 0.6 Time zone — **code done, data step open**

Done: `utils/date.ts` has `APP_TIME_ZONE = 'Europe/Prague'`, `toZonedInput` /
`fromZonedInput`; all `datetime-local` inputs (`GameFormModal`,
`RoundDatesSheet`, `EventsTab`) use them; `SeasonManager/components/util.ts`
re-exports them; backend `src/utils/time.ts` with DST tests
(`__tests__/time.test.ts`); tournament schedule and playoff generation convert.

Left:

1. **Fixture check script** — `backend/scripts/list-future-fixtures.ts` does not
   exist. Print future games per season with the stored value read both ways
   (as UTC instant → Prague, and as wall-clock) so league managers can confirm.
   Do not shift data blindly.
2. `pages/Admin/pages/SupportPage.tsx:48` formats without `timeZone` — add
   `APP_TIME_ZONE`.
3. `pages/SeasonManager/components/MoreTab.tsx:42` uses `timeZone: 'UTC'` for a
   date-only value — correct for a date-only field, leave as is but confirm the
   field is date-only.
4. Tournament game form sends a bare `YYYY-MM-DD` (`TournamentManagePage.tsx:875`,
   `:934`) — check it is shown date-only, otherwise it renders as 02:00.
5. Frontend has no test runner (D5), so the formatter tests from the plan cannot
   be written yet. Either add Vitest (small) or accept backend-only coverage.

**Done when:** the script has been run and the output handed to league managers;
items 2–4 fixed or confirmed.

### Phase 0 order and size

| Step | Items | Size | Why this order |
|------|-------|------|----------------|
| 1 | 0.1 wrappers + ErrorBoundary | M | Users cannot create a season at all |
| 2 | 0.3 keys + checker | S | Activation page broken for every new user |
| 3 | 0.2 nav + padding | S | Hidden tab on every phone |
| 4 | 0.5 `canAdminister` | S | Backend + test, independent |
| 5 | 0.4 accessibility | M | Touches the same sheets as Phase 2/3 — do before them |
| 6 | 0.6 leftovers + script | S | Data step needs the user / league managers |

Verification for every UI step: 360 × 800, 390 × 844 and desktop, in Czech and
English. Dev servers run in Docker; a `tailwind.config.js` change needs
`docker compose restart frontend`, and a host-side `npm run build` can kill the
containers.

---

## Phase 1 — Shared manager shell and context switcher

Not started (`components/manager/` does not exist). Detail in tier 4 plan §1.

- [ ] Decide **D4** (context switcher labels) and **D11** (shell colours vs.
      contrast).
- [ ] `utils/contrast.ts` — text colour for a team colour, navy fallback below
      WCAG AA.
- [ ] `components/manager/ManagerShell.tsx`; migrate Admin, SeasonManager,
      TeamManager, TournamentManagement layouts.
- [ ] `GET /api/auth/contexts` + backend test.
- [ ] `components/manager/ContextSwitcher.tsx`.
- [ ] Dashboard sections per managed area; move `emailDigest` opt-out to an
      account settings page.

## Phase 2 — Team manager, mobile-first

Detail in tier 4 plan §2 and `tier4/02_TEAM_MANAGER_MOBILE_SPEC.md`.

- [ ] Decide **D6** (position list per sport).
- [ ] Navigation: Přehled · Soupiska · Zápasy · Kalendář · Více.
- [ ] Overview: next game first, line-up count, quick actions.
- [ ] Roster: compact rows, "Neúplné údaje" filter, duplicate number warning,
      `config/positions.ts`.
- [ ] Line-up: `GameLineupEntry` model + migration from `HockeyGameStatistic`,
      `GET/PUT /api/games/:gameId/lineup/:teamId`, `LineupPage.tsx`, tests.
- [x] Backend: team manager may edit own-team match events
      (`services/access.ts:94`).
- [ ] Mobile match report screen in the team area.
- [ ] Double-submit protection on every form.

## Phase 3 — League manager workflow

- [ ] Games tab grouped by round, finished rounds collapsed.
- [ ] Round dates: default date/time for the round (labels come from 0.4).
- [ ] Generate schedule: say how many games / results will be deleted.
- [ ] Remove team from season: say what is deleted; consider refusing with
      confirmed games.
- [ ] Warn when score ≠ goals in player statistics for games without events.

## Phase 4 — Help centre

- [x] `/docs`, `/docs/:slug`, lazy loaded, cs + en articles.
- [ ] Publish line-up and team match report articles once Phase 2 ships.

## Phase 5 — Updates and contact

- [x] `/updates`, `/updates/roadmap`, `/contact`, `SupportTicket`, admin support
      page.
- [ ] `express-rate-limit` on `POST /api/contact` (D8).

## Phase 6 — PWA (new)

Nothing exists: no manifest, no service worker, no `theme-color` or
`apple-touch-icon` in `frontend/index.html`. Tier 4 excluded offline cache on
purpose; the roadmap lists "mobile/PWA improvements" only as a late item.

**6a — Installable (small, after Phase 2)**

- [ ] `vite-plugin-pwa` with `registerType: 'prompt'`; precache the app shell
      only, **never** cache `/api` responses.
- [ ] Manifest: name, short name, `start_url: /dashboard`, `display: standalone`,
      theme colour from the palette, icons 192/512 + maskable (from
      `public/icon.png`).
- [ ] `theme-color`, `apple-touch-icon`, iOS status bar meta in `index.html`.
- [ ] Translated "new version available — reload" prompt.
- [ ] Nginx/Docker: serve `sw.js` with `Cache-Control: no-cache`.

**6b — Offline match events (large, needs its own decision)**

- [ ] Decide scope (open question in `tier3/10-live-match-centre.md`): read-only
      offline schedule vs. queued event writes.
- [ ] If writes: IndexedDB queue, idempotency key per event on the backend,
      conflict rule when the league manager confirmed meanwhile.

## Deferred — do not start without the user

- Free-tier quota: `TODO(free-tier)` in
  `backend/src/controllers/leagueController.ts:95` and
  `tournamentSeriesController.ts:56`; registration "what do you want to do?"
  step (`authController.ts:44`).
- Old styling inside the new shell: `/leagues`, `/leagues/:id`, `/tournaments`,
  admin Users and Leagues lists.
- `/admin` stays dual-role until leagues get a home in `/season-management`.

## Housekeeping

- Drop `stash@{0}` (identical to `docs/tier4/` on `main`) and delete branch
  `backup/tier2-pre-rebase` (landed via PR #20).
