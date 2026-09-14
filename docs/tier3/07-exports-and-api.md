# 07 — Exports and the public API

Two features that look different and are the same thing: getting data out.

## Exports

What organisers actually ask for, in order:

1. **Printable schedule** — a round, or the whole season, on paper for a
   noticeboard.
2. **Printable match report** — a sheet to fill in by hand at the rink, and the
   completed version as a PDF afterwards.
3. **Standings and scorers** as CSV/XLSX, for a club's own newsletter.
4. **Season report** — everything, at the end.

### How

CSV needs no dependency. XLSX needs one. **PDF is the decision**: server-side
rendering (puppeteer, ~300MB of Chromium in the image) versus a print
stylesheet on a dedicated route that the user prints from the browser.

For a schedule and a match sheet, a print stylesheet is almost certainly right:
no dependency, no memory, and it already renders in the language the user is
reading in. Recommend `/print/season/:id/schedule` and
`/print/game/:id/report`, styled for A4, and only reach for real PDF generation
if someone needs an emailed attachment.

```
GET /api/seasons/:id/export/standings.csv
GET /api/seasons/:id/export/schedule.csv
GET /api/seasons/:id/export/scorers.csv
```

Everything derives from confirmed results through the existing filter.

## The public API

The pricing doc puts an API in a paid tier. Shape:

```
GET /api/v1/leagues/:slug/seasons
GET /api/v1/seasons/:id/standings
GET /api/v1/seasons/:id/fixtures
GET /api/v1/seasons/:id/results
GET /api/v1/teams/:id
```

Read-only, JSON, versioned under `/v1` — the internal API is not versioned and
must not be, or every refactor becomes a breaking change for somebody.

### Auth

Not JWT: these are machine callers with no session. An API key per league,
hashed at rest, passed as a header, checked against the league's entitlement.

```prisma
model ApiKey {
  id         String   @id @default(uuid())
  leagueId   String
  name       String
  hash       String   @unique
  lastUsedAt DateTime?
  revokedAt  DateTime?
}
```

Show the key exactly once, at creation. Store only the hash.

## Decisions needed

1. **Is the public API actually paid?** Public results are free to read on the
   website; an API over the same data is a convenience, not different data.
   Charging for it is defensible but it is a decision, not an obvious truth.
2. **Rate limiting.** There is none anywhere in the product today. An API
   invites the problem.
3. **Whether exports are gated at all.** A CSV of your own league's table is
   hard to justify charging for.

## Dependencies

[06](06-billing-entitlements.md) if any of it is gated.
