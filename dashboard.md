# Signed-in dashboard (`/dashboard`)

Status: built 2026-10-18, in PR #41 (`feat/registrations`). Canvas page 12.

## Why

The dashboard was the last signed-in page on the pre-redesign look, and it
hid everything a signed-in person comes for behind the header's "Menu":

- **No way in for a new organiser.** An account that manages nothing could not
  open `/season-management` or `/tournament-management` (access denied), and
  league creation lived only in `/admin`. The landing page's "Open
  applications" button led to a dashboard with no next step.
- **Management lived in a dropdown.** My seasons, My teams, Tournament
  management, Administration, Help and What's new were menu items. The
  dashboard itself showed only active seasons and an email toggle.
- **Nothing pointed at work waiting.** New team applications were visible only
  inside each competition's inbox.
- **Old styling.** The old `Navbar`, `text-gray-*`, Czech copy without
  diacritics ("Planovac Sportovnich Sezon").

## What changed

### Shell
- `/dashboard` moved from `AccountShell` (old `Navbar`) into `PublicLayout`:
  the same header, footer and palette as the public pages.
- The old `Navbar` (still used by sign-in, registration, activation, password
  reset and invites) lost its management links, Help and What's new. It keeps
  the public lists, a link to the dashboard, language and sign-out. Its
  hard-coded "Tournaments" label is translated, and the `nav.*` keys only
  those links used were removed from both locales.

### The page, top to bottom
1. **Hero** (`PublicHero`): today's date, "Hi, {name}" (the full name, since
   accounts store it in either order), the roles the account holds as chips
   (season manager, team manager, tournament manager, administrator), and one
   main action: "N applications to decide", linking to the first inbox with
   work waiting; for an account that manages nothing, "Start a league" and
   "Start a tournament"; otherwise none (the cards below carry the actions).
2. **Your workspaces** (`WorkspacesSection`): one card per role held, each with
   its colour from the manager shells (season navy, team red, tournament
   purple, admin gold), a count ("2 leagues") and, for season and tournament
   managers, the number of applications waiting. Followed by two "start" cards,
   always shown: **Start a league** and **Start a tournament**. Both open
   `CreateCompetitionDialog` (name, sport, visibility); on success the account
   is refreshed (`refreshUser`, so the new role appears) and the person lands
   in season management or on the new series.
3. **Team applications in your competitions** (`ManagedRegistrationsSection`),
   managers only: every running season and tournament they manage with the
   form's state (not published / open / full / past deadline / closed), new and
   waiting-list counts, and a link straight into its inbox
   (`?registrations=1`). Competitions that never published a form get "Open
   applications", the in-product promotion of the feature.
4. Existing sections, restyled into `Panel`s: **My events** (attendance),
   **Teams I play for**, **My applications**, **Teams I manage**.
5. **Open for applications** (`OpenCompetitionsSection`): public seasons and
   tournament series currently taking team applications, linking to the
   form or the series. Promotes the feature to applicants. Followed by a
   compact **Playing now** list (the old "Active seasons").
6. Side column: **What's new** (latest release note, unread dot, link to
   `/updates`), **Help** (help centre, the applications guide, contact),
   **Install the app**, **Round summary emails**.

On a phone the side column follows the main column.

### Onboarding tour
The "Your account menu" step pointed at the old menu. It now points at the
workspaces (`data-tour="workspaces"`); the active seasons step points at the
open-for-applications list.

## API

`GET /api/registrations/managed` (signed in). For every season (not archived,
not completed) and tournament (not completed) whose league or series the
caller manages: `{ kind, id, name, parentName, lifecycle, pending,
waitlisted, inboxPath }`: competitions with applications waiting first (most
first), then published forms, then forms never published; at most 30.
Ownership is the manager relation even for an admin, so an admin's dashboard
is not flooded with every competition. Test: `registrations.test.ts`.

## Verified
- `registrations.test.ts` 23/23, including the new list (order, inbox path,
  nothing for a stranger or for an admin who does not manage the competition).
- `npm run build` passes.
- In the browser, against the local stack:
  - a manager with all three roles: workspaces with counts, the applications
    list, open competitions, side column;
  - an account that manages nothing: start actions in the hero and the
    workspaces;
  - creating a tournament series from the dashboard lands in tournament
    management, which that account could not open before (the test series was
    deleted afterwards);
  - phone width, no horizontal scroll.

## Not done
- Plan limits on creating a league or series (`TODO(free-tier)` in
  `createLeague`) are still not applied, see canvas page 9.
- Leagues still have no home inside `/season-management`; a new league is
  created from the dashboard, editing it stays in `/admin`.
- No dismiss for the "Open applications" prompts; they go away once a form is
  published.
- No release note for the new dashboard yet (`content/updates.ts`).
- The unused `FeaturesSection`, `SetupOptionsSection` and `PricingSection` in
  `pages/Home/components` were left as they were.
