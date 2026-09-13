# 05 — Sponsors

## The problem

Amateur leagues run on sponsor money, and the pricing doc names sponsor tools
as a monetisation argument in their own right: an organiser who can show a
sponsor a logo on a public page has a reason to pay for the platform.

## What it needs

```prisma
model Sponsor {
  id        String    @id @default(uuid())
  name      String
  logo      String
  url       String?
  // Scope: a sponsor belongs to a league, or to one team
  leagueId  String?
  teamId    String?
  // Where it may appear, and when
  placements String[]   // ["LEAGUE_HOME", "STANDINGS", "MATCH", "TEAM"]
  activeFrom DateTime?
  activeTo   DateTime?
  position   Int @default(0)
}
```

Dated because sponsorship is seasonal and nobody wants to remember to take last
year's logo down.

## Where they appear

League home, standings footer, match detail, team page, and — later — the
tournament public page. Placement is a list rather than a boolean so one
sponsor can be a title sponsor and another only appear on the schedule.

## Decisions needed

1. **Does the free tier carry ATM's own branding** on public pages, removable
   by paying? That is the classic model and it is a
   [06](06-billing-entitlements.md) decision, not a sponsor one.
2. **Image hosting.** There is no upload pipeline in the product today — logos
   are URLs. Sponsors will not accept "host it yourself", so this feature
   probably forces a file-upload story.
3. **Click tracking.** Sponsors ask. It means a redirect route and a counter,
   and it means the public page starts collecting behaviour.

## Dependencies

[04](04-public-microsite.md) — a sponsor slot needs a page worth being on.
File uploads, which do not exist yet anywhere in the product.
