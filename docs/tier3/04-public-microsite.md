# 04 — Public league microsite

## The problem

Every league already has public pages — `/leagues/:id`, `/season-detail/:id` —
but they look like part of someone else's product. The architecture doc calls
the public layer the main growth lever, because participants share league pages
without being asked to.

## What exists

Public and working: league list, league detail, season detail with standings,
schedule, teams, players, top scorers, archived seasons. All already
unauthenticated.

## What is missing

- **Identity.** No league branding beyond a logo: no colours, no cover image,
  no description shown well.
- **A home page.** `/leagues/:id` is a season list, not a front page.
- **News.** Nothing to announce anything with.
- **Share cards.** No Open Graph tags, so a shared link is a grey rectangle.
- **A short address.** `/leagues/8f3c-…-uuid` is not something anyone types.
- **Embedding.** No way to put a table on a club's own site.

## What it needs

```prisma
model League {
  // ...existing
  slug        String?  @unique   // "prague-amateur-hockey"
  coverImage  String?
  primaryColor String?
  about       String?            // markdown
}

model Announcement {
  id         String   @id @default(uuid())
  leagueId   String
  title      String
  body       String
  publishedAt DateTime?
  authorId   String?
}
```

A slug is the cheapest win on the list: `/l/prague-amateur-hockey` is shareable
and the uuid route keeps working.

## Server-rendered share cards

Share cards need meta tags in the HTML at request time, and the frontend is a
Vite SPA — the crawler sees an empty shell. Options, cheapest first:

1. A tiny express route on the **backend** that serves the HTML shell with meta
   tags filled in for `/l/:slug` and `/season-detail/:id`, proxied ahead of the
   SPA. No new infrastructure.
2. Prerender only those routes at build time. Breaks as soon as data changes.
3. Move the frontend to a framework that renders on the server. Enormous.

Recommend 1.

## Widgets

An embeddable table is an iframe route plus a permissive `X-Frame-Options` on
that route only: `/embed/season/:id/table`. Small, and a genuinely good reason
for a club to link back.

## Decided

**2026-09-13.** A logged-out visitor sees a player's **name and shirt number,
and nothing else**. Position, birth year, notes and the linked account are all
withheld; so is a team manager's email address. Amateur leagues include minors,
so this is the floor, not a starting position to be negotiated upward later.

Implemented in `backend/src/services/publicView.ts`, applied to
`GET /players/team/:id`, `GET /players/:id` and `GET /teams/:id`. Those routes
stay public but use `optionalAuth`, so a signed-in manager still sees the full
roster they entered. A signed-in stranger sees exactly what a visitor sees.

**Next, and wanted:** a way to hide a whole league, season or tournament from
public view — see [12](12-visibility.md).

## Decisions needed

1. **Custom domains** — real product value, real operational cost (TLS, DNS
   verification, a proxy). Probably belongs behind a paid tier; see
   [06](06-billing-entitlements.md).
2. **Whether news is per league or per season.**

## Dependencies

None technically. Interacts with [05](05-sponsors.md) and
[06](06-billing-entitlements.md).
