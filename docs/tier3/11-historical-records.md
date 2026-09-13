# 11 — Historical records

## The problem

Archiving a season freezes its table and its player stats, then deletes the live
games. That is per season, and nothing reads across seasons. A club cannot
answer "who has scored most for us, ever?" — which is exactly the question
amateur clubs care most about.

The pricing doc lists historical depth as something worth charging for.

## What exists

`SeasonArchiveStanding` and `SeasonArchivePlayerStat`, both denormalising names
and nulling their foreign keys on delete, so history survives a team or player
being removed. The data for most of this is already in the database.

## What is missing

Queries and pages, mostly — not tables:

- **All-time scorers** for a league, and for a club.
- **Player career profile**: every season, every club, totals.
- **Club records**: biggest win, longest run, best finish.
- **League honours**: who won what, by year.
- **Head to head** between two clubs across seasons.

## The hard part: identity over time

Aggregating across seasons means deciding that two rows are the same person or
the same club. That is genuinely difficult here:

- `SeasonArchivePlayerStat.playerId` is null once the player row is deleted,
  leaving only a name.
- Players change clubs. A career profile has to follow the person.
- Clubs rename, merge and re-found, and their supporters have strong opinions
  about which of those happened.

Two honest options:

1. **Aggregate on the live `Player`/`Team` rows only**, and show archived rows
   with null ids as unattributed. Undercounts, never lies.
2. **Introduce a `Person` and a `Club`** that survive above players and teams,
   and link rows to them over time. This is the correct model and it is a large
   piece of work that touches everything.

Recommend 1 now, with 2 written down as where it goes. Do not silently match on
name — two Jan Nováks become one player and the record is wrong forever.

## Decisions needed

1. Which of the two identity models above.
2. **Does a club rename rewrite history**, or does each season show the name
   used at the time? (Archive rows currently store the name at the time, which
   is the better answer — keep it.)
3. Whether any of this is gated by [06](06-billing-entitlements.md).

## Dependencies

Season archive (shipped). Interacts with
[04](04-public-microsite.md) — records are exactly the kind of page people
share.
