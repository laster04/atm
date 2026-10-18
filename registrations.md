# Season and tournament registrations (roadmap: moved into phase 1)

> **Status:** built 17 Oct 2026 on branch feat/registrations, uncommitted. Backend 435 tests green; season and tournament flows checked in the browser. Spec: canvas page 11 "Přihlášky do sezóny a turnaje".

## Context
Organisers collect teams by hand today: a season or tournament manager adds every team themselves. With registrations, the manager opens a form, teams apply, and the manager approves, rejects or waitlists. An approved application creates the team in the competition.

On 17 Oct 2026 the user moved this from phase 3 to phase 1 ("build now"). Plan limits are ignored for now: an approval always goes through, and the limits from page 9 plug in later.

Decided on page 11 (14 Oct 2026):
- **Season:** the applicant must be signed in (or register on the way) and becomes team manager on approval. A returning team picks one of the applicant's existing teams and keeps its history.
- **Tournament:** a team (or, in tennis singles, a player) applies with an optional roster (name, number, position). No account is needed, because tournament teams have no manager. Spam guards are the contact form's: honeypot, per-IP rate limit, client token.
- **Manager settings:** open/closed and a deadline, maximum teams with a waiting list, rules text the applicant must accept, and the entry fee as text only.

## Data (`schema.prisma` + migration)
- **`RegistrationWindow`:** one per season *or* tournament (a CHECK constraint like on `manager_invites`).
  - Fields: `open`, `deadline?`, `maxTeams?`, `rules?`, `rulesVersion` (bumped when the rules text changes), `fee?`.
- **`Registration`:**
  - Belongs to a window, with a `status`: PENDING, WAITLISTED, APPROVED, REJECTED or WITHDRAWN.
  - Applicant: `applicantId?` (a user, required for a season); `contactName`, `email`, `phone?`, `note?`.
  - Team: `existingTeamId?` (a returning season team), `teamName`, `primaryColor?`, and `roster` (a JSON list, tournament only).
  - Rules: `rulesAcceptedAt` and `rulesVersion`.
  - Decision: `decidedAt?`, `decidedById?`, `reason?`.
  - Result: `teamId?` or `tournamentTeamId?`, the team the approval created or added.
  - `clientToken` (unique) makes a retried submit idempotent.

## Rules
- **When the form takes applications:** open, the deadline not passed, and the competition not archived. A season must also be one its visibility lets the applicant see: unlisted works through the link, private does not.
- **Capacity:** a new application goes straight to the waiting list once the competition's teams (season teams or tournament teams) plus pending applications reach `maxTeams`. Approval re-checks capacity inside the transaction, so two approvals can't overshoot the maximum.
- **Approving a season application:**
  - A new team becomes a `Team` with the applicant as manager, plus a `SeasonTeam`.
  - A returning team must be managed by the applicant and not already be in the season; it gets a `SeasonTeam`.
- **Approving a tournament application:** creates a `TournamentTeam` and its players from the roster.
- **Duplicates:** the same team name can't have two live (pending, waitlisted or approved) applications in one competition. A season applicant can't apply twice with the same team.
- **Withdrawing:** a signed-in applicant can withdraw their own pending or waitlisted application. Withdrawing frees the place, but nobody moves up automatically; the manager decides who comes off the waiting list.
- **Emails, in Czech or English:**
  - confirmation to the applicant
  - notice to the manager (league manager or series manager; admins when there is none)
  - the decision to the applicant, with the reason when rejected

## API
- **Public:**
  - `GET /registrations/season/:id` and `GET /registrations/tournament/:id`: the form, i.e. settings, competition name, places and whether it's open. The season one goes through `requireVisible('season')`.
  - `POST` to the same paths submits an application. The season one requires sign-in. The tournament one uses optional auth plus the honeypot, rate limit and client token.
- **Signed in:** `GET /registrations/mine` and `POST /registrations/:id/withdraw`.
- **Manager** (season or tournament access):
  - `GET` and `PUT .../:id/settings` for each kind
  - `GET .../:id/inbox` for each kind
  - `POST /registrations/:id/approve`, `/reject` (`{ reason? }`) and `/waitlist`

## Frontend
- **Public form:** `/prihlaska/sezona/:id` and `/prihlaska/turnaj/:id`.
  - Season form: sign-in prompt, pick a team or name a new one, contact details, rules to accept.
  - Tournament form: team, contact, optional roster rows, rules to accept.
  - The public season and tournament pages show a "Přihlásit tým" button while registrations are open.
- **Season manager:** a "Přihlášky" sheet from the More tab, with a count of new applications. It holds the settings, the shareable link and the inbox with approve, reject and waitlist.
- **Tournament management:** the same panel on the tournament page.
- **Dashboard:** a "Moje přihlášky" section with status and a withdraw button.
- **Texts:** everything in `cs.json` and `en.json`.

## Follow-ups from docs/REGISTRATION_FLOW_REVIEW.md (18 Oct 2026, same branch)
- **Publish lifecycle:** `RegistrationWindow.publishedAt`/`closedAt`; settings return `lifecycle` (DRAFT, OPEN, FULL, PAST_DEADLINE, CLOSED), `capacity` and `competitionName`. The panel prepares the terms, previews the form (`?preview=1`, managers only, submit disabled), publishes and closes behind an inline confirmation, then shows a share panel: link, native share, QR code (`qrcode`), WhatsApp and email messages, social post, and a printable poster at `/prihlaska/:kind/:id/plakat`.
- **One capacity model** (`approved`, `pending`, `waitlisted`, `max`, `free`) in the form, the inbox, the settings and the organiser's emails. The form says before sending whether the application would be waitlisted.
- **Waiting list stays manual:**
  - `POST /registrations/:id/promote` moves a waitlisted application to pending, but only into a free place.
  - Moving one up ahead of an older one is recorded (`promotedAt`, `promotedById`, `promotedOutOfOrder`).
  - Approving from the waiting list may not take a place held by a pending application.
  - Withdrawing a pending application emails the organiser when teams are waiting.
- **Season sign-up keeps its way back:** `?next=` passes through register, the activation email and the activation page (`safeNextPath` on both sides).
- **Tournament status link:**
  - A random token (only its SHA-256 is stored in `statusTokenHash`) goes into the 201 answer and the receipt.
  - `GET /registrations/status/:token` shows the application, and `POST .../withdraw` takes it back.
  - The link stops working (410) 30 days after the application was decided or withdrawn.
  - The page is `/prihlaska/stav/:token`.
- **Discovery:**
  - `registrationOpen` on public season and series lists, with an "Applications open" badge and filter.
  - Deadline, free places and fee next to the public Apply button.
  - A landing section, a release note, the help article `prihlasky-tymu`, a season checklist step and a tournament setup card.
- **Funnel:** `GET /registrations/funnel` (admin only), shown as a card on the admin More page.
- **Email in dev and tests:** tests never send (`NODE_ENV=test`). Without a Resend key, development logs each email and its links instead.

Out of scope for now: plan limits (page 9), a tournament team manager account, single players applying to a season, QR payment of the entry fee (phase 3), and a "Open registrations" step in the season setup checklist.

## Verification
- **Backend tests (`registrations.test.ts`):**
  - closed form and past deadline refused
  - season requires sign-in
  - tournament without an account, with honeypot, rate limit and client-token retry
  - waiting list once full
  - approving a new team creates the team with the applicant as manager; a returning team is added
  - tournament approval creates the team and players
  - capacity re-check on approval
  - reject with a reason; withdraw
  - a stranger cannot read the inbox or decide
- **Commands:** run the full `npm test` and the frontend `tsc`.
- **Browser:** open registrations on a local season and tournament, apply as a test user and without an account, then approve and check the team appears.
