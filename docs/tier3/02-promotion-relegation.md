# 02 — Promotion and relegation

## The problem

A league with two divisions has no way to say that the bottom two of the first
go down and the top two of the second come up. Today an organiser rebuilds the
divisions by hand each year and nothing records that it happened.

## What it needs

Two separate things, and they are often confused:

1. **A rule** on a division: how many go up, how many go down, and whether a
   play-off decides the last place.
2. **An outcome** recorded when a season ends, so next season can be seeded
   from it and so history can say what happened.

```prisma
model SeasonGroup {
  // ...existing
  promoteCount Int @default(0)   // top N go up
  relegateCount Int @default(0)  // bottom N go down
}

enum MovementKind { PROMOTED, RELEGATED, STAYED }

model TeamMovement {
  id        String       @id @default(uuid())
  kind      MovementKind
  seasonId  String       // the season that produced it
  teamId    String
  fromGroup String?      // names, kept as text so a deleted group cannot erase history
  toGroup   String?
  decidedAt DateTime
}
```

`TeamMovement` deliberately stores group **names**, not ids — the same reason
`SeasonArchiveStanding` denormalises team names. Divisions get renamed and
deleted between seasons; the record of what happened must not.

## Flow

1. Season reaches COMPLETED with every result confirmed.
2. Manager opens "Close the season". It shows, per division, who the rule says
   goes up and down, from the frozen final table.
3. Manager confirms, or overrides an individual team with a reason (withdrawn
   clubs, mergers and refusals are extremely common at amateur level).
4. Movements are written, and the trail records who decided and why.
5. Creating next season offers to place teams from those movements.

## Decisions needed

1. **Does the app move teams, or only record the decision?** Recording is far
   safer: amateur leagues override these constantly. Recommend record-only for
   v1, with next season's draw pre-filled but editable.
2. **Play-off for the last spot** — needs [01](01-league-playoffs.md) first.
3. **Cross-league movement.** A team relegated out of the bottom division
   leaves the league entirely. Is that in scope, or does it stop at the edge?

## Dependencies

Divisions (shipped). [01](01-league-playoffs.md) if a play-off decides places.
Season archive, for the final table to read from.
