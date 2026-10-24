# Tournament plans, payments and Turnaj Plus

How paid tournaments work in the code. The product decisions (prices, what each
plan includes, the order of work A–E) live on page 13 of the planning canvas;
this file describes what is built.

Built in: A file storage (#42), F/G administration, prices, VAT and limits
(#43), B plans, limits, QR payments and tax documents (#44), C Turnaj Plus
(#51). B6 (billing details, full tax document) waits for the accountant;
E (exports, entry-fee records) is a later phase.

## Plans

| Plan | Where it is set | What it adds |
|------|-----------------|--------------|
| `FREE` | default of every tournament | a small tournament |
| `TOURNAMENT` | `Tournament.plan` | more teams |
| `TOURNAMENT_PLUS` | `Tournament.plan` | no team limit, partners, documents, light brand |
| `ORGANIZER` | `OrganizerPlan` of the series manager, for a year | Plus for every tournament of their series |

`services/plans/tournamentPlan.ts` → `teamAllowance(tournamentId)` resolves the
plan a tournament runs on **now**: the series manager's Organizátor while it
lasts, else the tournament's own plan. Everything plan-dependent asks it.

Prices, VAT rates and limits are never in config: they are versioned rows read
through `services/pricing/catalog.ts` (`priceAt`, `limitAt`), edited in the
admin pricing screen. Limit keys: `TEAMS_PER_TOURNAMENT`, `SPONSOR_LOGOS`,
`DOCUMENTS`, `DOCUMENT_MAX_MB`, `LOGO_MAX_MB`. A limit never set counts as
unlimited for teams and as zero for the paid features.

**When a plan ends nothing is removed.** Teams, partners and documents stay;
only adding more past the new plan's limit is refused.

## Limits

- Teams: checked on the server when a team is added, when the sign-up maximum
  is set and when an application is approved, in the same transaction as the
  capacity check, under a row lock (`lockCompetition`). Refusal: `409` with
  `code: 'PLAN_LIMIT'` (`planLimitBody`).
- Partners and documents: `services/tournaments/plus.ts` → `plusAllowance`.
  Refusal: `409` (`413` for a file over the size) with `code: 'PLAN_FEATURE'`
  and `feature: SPONSOR_LOGOS | DOCUMENTS | DOCUMENT_SIZE`.

The frontend opens the plan offer (`UpgradeDialog`) on either refusal.

## Payments

1. `POST /api/tournaments/:id/payments` creates a `Payment` with a numeric
   variable symbol; the dialog shows an SPD QR code for the ATM account
   (`services/payments/account.ts`, hardcoded).
2. An admin confirms the transfer in the admin payments screen
   (`POST /api/admin/payments/confirm`). The plan applies from then on.
3. A tax document (`TaxDocument`, numbered `ATM26-0001`) is rendered as PDF
   (`services/invoices`), stored privately and e-mailed to the payer in their
   language. The document itself is Czech and English.

Until confirmation the organiser keeps preparing the tournament and taking
applications; approving past the old limit waits.

## Turnaj Plus (celek C)

| What | Model | Endpoints |
|------|-------|-----------|
| Partners | `TournamentSponsor` (name, url?, logo, position) | `POST/PUT/DELETE /api/tournaments/:id/sponsors[/:sponsorId]`, `PUT …/sponsors/order` |
| Documents | `TournamentDocument` → `StoredFile` (kind `DOCUMENT`, `PRIVATE`) | `POST /api/tournaments/:id/documents` (multipart, PDF checked by content), `PUT/DELETE …/:documentId`, `GET …/:documentId/download` |
| Manager view | — | `GET /api/tournaments/:id/plus` (limits, usage, items) |

- Partner logos go through the logo pipeline (`POST /api/files/logo`, WebP,
  512 px) and count as referenced while a partner shows them; removing the
  partner lets the sweep delete the logo.
- Document downloads check `requireVisible('tournament')` and redirect to a
  five-minute signed link; the file is never public. Deleting the tournament
  deletes its document files (`releaseFiles`).
- The public tournament payload (`GET /api/tournaments/:id`) carries
  `sponsors`, `documents` and `branding`.

### Branding

`brandingFor(plan)` is `LIGHT` for `TOURNAMENT_PLUS` and `ORGANIZER`, else
`FULL`. On `LIGHT`:

- the tournament page, its sign-up form and the application status page call
  `useLightChrome(true)`; `PublicLayout` then drops the site header, menu and
  footer and shows only `PoweredByAtm` ("Běží na ATM"), and the pages drop
  their links back into ATM;
- the sign-up, decision and organiser e-mails of that tournament show the
  series logo (or name) instead of the ATM logo, and the credit;
- the embed widget may hide its "Výsledky z ATM" credit.

The sign-up poster carries the small credit on every plan, and the partners
when the tournament has them.

Later: partners in the embed widget.

## Migrations

`20261021180000_pricing` (prices, VAT, limits), `20261022100000_tournament_plans`,
`20261022140000_tax_documents`, `20261025100000_tournament_plus`. All add
tables or columns only and run without downtime.

## Tests

`tournament-plan.test.ts`, `plan-payment.test.ts`, `tax-document.test.ts`,
`pricing.test.ts`, `files.test.ts`, `tournament-plus.test.ts`.
