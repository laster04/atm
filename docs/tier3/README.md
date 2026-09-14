# Tier 3 — Competition maturity and the commercial layer

What remains after Tier 1 (core domain) and Tier 2 (team operations). One file
per feature. Each says what problem it solves, what it needs in the database,
what the API and the screens look like, what it depends on, and — most
importantly — **what has to be decided before it can be built**.

Built so far: divisions, which shipped as the first Tier 3 slice, and
visibility (12).

| # | Feature | Depends on | Size | Decisions open |
|---|---------|-----------|------|----------------|
| — | [Divisions and groups](../../backend/prisma/schema.prisma) | — | — | **shipped** |
| 01 | [League playoffs](01-league-playoffs.md) | divisions | L | seeding, series format |
| 02 | [Promotion and relegation](02-promotion-relegation.md) | 01, divisions | M | who moves, when |
| 03 | [Discipline](03-discipline.md) | match events, audit | M | who rules, suspension maths |
| 04 | [Public league microsite](04-public-microsite.md) | — | L | domains, what is public |
| 05 | [Sponsors](05-sponsors.md) | 04 | S | placement, whether it gates |
| 06 | [Billing and entitlements](06-billing-entitlements.md) | — | XL | **the whole pricing model** |
| 07 | [Exports and the public API](07-exports-and-api.md) | 06 for gating | M | formats, auth |
| 08 | [Webhooks](08-webhooks.md) | 07 | M | delivery guarantees |
| 09 | [Imports](09-imports.md) | — | M | format, conflict handling |
| 10 | [Live match centre](10-live-match-centre.md) | match events | L | who operates it |
| 11 | [Historical records](11-historical-records.md) | season archive | M | what survives a rename |
| 12 | [Visibility](12-visibility.md) | — | M | **shipped** |
| 13 | [Scheduled jobs](13-scheduled-jobs.md) | — | M | **deferred** — stale live games |

## Where this stands — 2026-09-13

Decided in conversation and recorded in each file:

- **Public data is minimal.** A visitor sees a player's name and shirt number,
  nothing else, and no manager email. **Shipped.**
- **06 billing — postponed.** Nothing is gated for now. Every feature built
  before entitlements exist will need a check added later; that is accepted.
- **09 imports — postponed.**
- **02 promotion/relegation — record the decision only**, never move teams
  automatically. Not urgent: no league on the platform uses it yet.
- **10 live match centre — next**, starting with [13](13-scheduled-jobs.md):
  a job that sets a fixture live when its start time passes.
- **12 visibility — shipped 2026-09-14.** New seasons start unlisted,
  visibility replaced the DRAFT filter, a hidden league hides its archives.
- **13 scheduled jobs — deferred 2026-09-14.** Not to be built yet.

## Reading order

12 is done. **13** waits for a later stage; it brings the job runner that
scheduled emails and webhooks will also want, so it comes back before either.

**06 whenever it is picked up.** It was going to be first because entitlements
decide whether everything else is free, paid or capped. Postponing it is a
deliberate trade, not an oversight.

## Two rules that apply to everything here

1. **Tournaments are a separate product.** Nothing in this tier may reach
   across into the tournament tables. Logic can be shared as a service — the
   way scoring and standings already are — but data must not be.
2. **The match report is the source of truth.** Anything that derives from
   results derives from confirmed results, through the filter in
   `backend/src/services/standings/filters.ts`. Do not re-invent the condition.
