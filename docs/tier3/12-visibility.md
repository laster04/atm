# 12 — Hiding a league, season or tournament from the public

**Wanted next.** Asked for on 2026-09-13, alongside the decision that public
rosters carry names and numbers only ([04](04-public-microsite.md)).

## The problem

Everything is public the moment it exists. An organiser building next season's
draw, a tournament that is still half-entered, a league that has folded — all
of it is visible to anyone with the link, with no way to say "not yet".

The only thing resembling this today is the season `DRAFT` status, which
`getAllSeasons` filters out for anyone but the league's manager. That is one
special case in one list endpoint, not a rule.

## What it needs

A single visibility field on each of the three things a person can be sent a
link to:

```prisma
enum Visibility {
  PUBLIC    // anyone
  UNLISTED  // reachable by direct link, absent from every listing
  PRIVATE   // people who manage it, and nobody else
}

model League           { visibility Visibility @default(PUBLIC) }
model Season           { visibility Visibility @default(PUBLIC) }
model TournamentSeries { visibility Visibility @default(PUBLIC) }
```

Three levels rather than a boolean because `UNLISTED` is what an organiser
actually wants while a draw is being built: shareable with the clubs involved,
invisible to everyone else. A boolean forces that case into either "published"
or "nobody can see it".

Tournaments carry it on the **series**, matching how their manager relation
already works, with individual tournaments inheriting.

## Where it has to be enforced

This is the whole risk of the feature: a visibility flag that is checked in
four places out of nine is worse than none, because it tells the organiser they
are hidden when they are not.

Every public read has to go through one helper, the way scoring and the
standings filter already do:

```ts
// services/visibility.ts
export const visibleSeasonFilter = (user?: AuthUser): Prisma.SeasonWhereInput
export const canViewSeason = (user, seasonId): Promise<boolean>
```

The endpoints that need it, at minimum:

- leagues: list, detail
- seasons: list, by league, detail, standings, standings by group, archived
- teams: by season, detail
- players: by team, detail
- games: by season, detail, events
- game statistics: all of the season-scoped reads
- tournaments: series list, series detail, tournament detail, standings,
  scorers, groups, games

**Inheritance matters and is easy to get wrong.** Hiding a league must hide its
seasons, their games and their rosters. A team is not hidden — it exists across
seasons — but the games and tables belonging to a hidden season are.

## Screens

- A visibility control on the league, season and series settings, with plain
  wording: "Anyone can find this", "Only people with the link", "Only people
  who manage it".
- A clear marker wherever a hidden thing is shown to someone who can see it, so
  a manager is never unsure which state they are in.

## Decisions — taken 2026-09-14

1. **A new season starts UNLISTED** and has to be published. Leagues and series
   keep defaulting to PUBLIC: a league with only unlisted seasons shows nothing
   of a draw, and two publish steps would leave a published season unlisted
   because its league was forgotten.
2. **Visibility replaces the DRAFT filter.** DRAFT now only says a season has
   not started (it still gates schedule generation). The migration makes every
   existing DRAFT season UNLISTED, which is exactly what the old filter did to
   it; every other existing row is PUBLIC.
3. **A hidden league hides everything under it**, archives included. The
   strictest level on the way down wins.

## As built

- `services/visibility.ts` holds every rule; `requireVisible(kind, param)` in
  `middleware/access.ts` guards each public single-record route and answers 404
  with the not-found message, so a hidden record and a missing one look alike.
- List endpoints filter with `listed*Where`; the league's own page lists its
  PUBLIC seasons even when the league itself is unlisted.
- Team and player pages stay open but drop seasons, fixtures and statistics
  from seasons that are not listed. Player totals and top scorers count listed
  games only.
- `/teams/available/:seasonId` was anonymous and returned every team with its
  manager's address; it now needs season access.
- `__tests__/visibility.test.ts` walks every public route against a private
  league, a private season and a private series. **Add a route there when you
  add one.**
- Screens: season manager overview has a visibility card with Publish; the
  league, season and series forms have the three-way picker; hero, card and
  admin rows carry a badge when something is not public.

## Risks

Enforcement is a breadth problem, not a depth one. It wants a test that walks
every public endpoint against a hidden league and asserts 404 — written once
and extended whenever a public route is added, or the gaps will creep back.
