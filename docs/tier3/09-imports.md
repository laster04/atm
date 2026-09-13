# 09 — Imports

## The problem

Adoption. A league with twelve teams and 250 players will not type them in to
evaluate the product, and a league with ten years of history behind it will not
abandon that history to move.

## Three imports, increasing in difficulty

### 1. Roster CSV — easy, high value

`name, number, position, born_year, note`, pasted or uploaded, into one team.
Solves the worst part of onboarding for a team manager.

### 2. Teams and fixtures — moderate

A season's teams, then a fixture list with dates and venues. Most leagues have
this in a spreadsheet already, in a shape nobody else uses.

### 3. Historical seasons — hard

Past standings and scorers, landing in the archive tables rather than as live
games — they have no match reports behind them. `SeasonArchiveStanding` and
`SeasonArchivePlayerStat` already denormalise names precisely so rows can exist
without live teams to point at, so this fits the existing model well.

## Shape

Import is a two-step operation, never one:

```
POST /api/teams/:id/import/players/preview   -> parsed rows + per-row problems
POST /api/teams/:id/import/players/commit    -> applies the rows the user kept
```

Preview-then-commit, because a silent import that guessed wrong about 250
players is worse than no import. The preview marks each row: new, duplicate of
an existing player, or unparseable — and the user chooses per row.

## Decisions needed

1. **Duplicate rule.** Is a player identified by name, by name + birth year, or
   by shirt number? Amateur rosters have two Jan Nováks more often than not.
2. **Encoding.** Czech spreadsheets export CP1250 at least as often as UTF-8,
   and a mangled diacritic in a player's name is a bad first impression. Detect
   rather than assume.
3. **Does an import become undoable?** A single audit entry with the batch, so
   a mistaken import can be reversed, is worth far more than it costs.
4. **Where it lives.** Team managers import rosters; league managers import
   fixtures. Different screens, different permissions.

## Dependencies

None. Genuinely independent and probably the highest adoption value per hour of
work in this tier.
