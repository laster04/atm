# League plan

Decided 5 and 16 November 2026 (canvas page 9). Built on branch `feat/pl-release-notes-league-plan`.

## The rules

- **Teams and players never pay.** The league does.
- **One free start per organiser account:** the first season of the first league is free, with no team limit (`TRIAL`). It may end at most 12 months after it is created.
- **After that, a yearly plan per league** in two bands: up to 12 teams per season (`SMALL`) and no limit (`LARGE`). Prices are versioned in the pricing catalogue (`LEAGUE_SMALL_YEAR`, `LEAGUE_LARGE_YEAR`); the team limit is the `TEAMS_PER_SEASON` plan limit.
- **Payment is due at publishing, not at creation.** A season waiting for the plan (`UNPAID`) can be prepared in full: teams, schedule, manager invitations, rosters, results typed in. Until the plan is paid (decision 6):
  - it behaves as private, whatever its visibility says (public pages, lists, search, sitemap, embed widget);
  - no results e-mails or round summaries go to players;
  - no result can be confirmed, by hand or by team agreement.
- **Leagues that were in ATM before the plan** are free until the end of 31 August 2027 (`League.freeUntil`). Their managers count as having used the free start.
- **The paywall has a switch** (`app_settings.league_plans`, admin › Ceník a DPH). It started off; while off, every new season is `FREE`.

## How a season's cover is stored

`Season.plan` is decided when the season is created (`services/plans/leaguePlan.ts`, `seasonCoverage`) and never goes back:

| value | when |
|---|---|
| `FREE` | the switch is off, or the league is free until a later date |
| `TRIAL` | the organiser's one free season |
| `LEAGUE` | a League plan runs for the league, or was paid for the waiting season |
| `UNPAID` | none of the above |

Only `UNPAID` changes, to `LEAGUE`, when a plan is paid or granted. So a running season always finishes in the plan it started in, and nothing published is ever hidden again when a plan ends.

## Paying

- The league manager opens the plan from the season overview (`LeaguePlanCard`). Offers come from `GET /api/leagues/:id/plan`. The band offered first fits the largest season still in play.
- `POST /api/leagues/:id/payments` creates a QR payment. It works like a tournament plan payment: one waits per league, and the payer must agree to the immediate start.
- An admin confirms it in `/admin/payments`. That creates a `LeaguePlan` year (starting when a running year ends), covers the waiting seasons and issues the tax document.
- **Upgrade** from SMALL to LARGE costs the difference and runs to the end of the current year. **Renewal** is offered in the last 30 days.

## Admin tools

- `PUT /api/admin/pricing/league-plans`: the switch. Pricing manager only, audited.
- `PUT /api/admin/leagues/:id/plan`: set `freeUntil` (waiver, founding deal) or grant a plan without payment. Audited with the reason. Available from the admin leagues list.

## Not done yet

- The landing page still shows "Cena brzy"; set real prices, then turn the switch on.
- A release note and a help article are written when the switch goes on.
- Founding price (canvas page 9, point 5): grant a plan or set `freeUntil` by hand for now.
