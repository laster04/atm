# 01 — League playoffs

## The problem

A season ends when the fixtures run out. There is no way to say "the top four
play off for the title", which is how most amateur leagues actually finish.

Playoffs exist today, but only inside the tournament tree
(`tournamentPlayoffController.ts`, ~300 lines: bracket generation, seeding,
placement matches). Leagues cannot use any of it, because tournaments are a
separate product and their tables are separate on purpose.

## What it needs

A season already has divisions. A playoff is a **phase** that comes after the
regular one and takes its entrants from a table.

```prisma
enum SeasonPhaseKind { REGULAR, PLAYOFF, PLACEMENT }

model SeasonPhase {
  id       String          @id @default(uuid())
  kind     SeasonPhaseKind
  name     String
  position Int
  seasonId String
  // Where the entrants come from: the top N of each division, or of the
  // season table when the season is not divided.
  qualifyFrom Json?   // { source: "GROUP" | "SEASON", take: 4 }
  games    Game[]
}
```

`Game` gains `phaseId String?` and `bracketSlot Int?` / `homeSeed` / `awaySeed`,
mirroring what tournament games already carry. A game with no phase is a
regular-season fixture, so nothing existing has to change.

## What can be shared

The bracket maths in `tournamentPlayoffController` is pure: given N seeds,
produce pairings and the slot each winner advances to. Extract it to
`services/brackets/` the way scoring was extracted, and have both trees call
it. **Do not** share the tables.

Seeding reads the confirmed table through the existing standings service, so a
playoff cannot be seeded off results nobody confirmed.

## API sketch

```
GET    /api/seasons/:id/phases
POST   /api/seasons/:id/phases              create a playoff phase
POST   /api/seasons/:id/phases/:phaseId/seed  generate the bracket from the table
DELETE /api/seasons/:id/phases/:phaseId
```

## Screens

- Season manager: a phase list in More, and a bracket view alongside the table.
- Public season page: a bracket tab, reusing `PlayoffBracket.tsx` from the
  tournament side if it can be made to take plain props.

## Decisions needed

1. **Series or single games?** Best-of-three and best-of-five are common in
   amateur hockey. A series is several `Game` rows that resolve to one bracket
   slot, which is a real modelling difference — decide before building.
2. **Seeding across divisions.** Two divisions of six, top four each: does A1
   play B4, or is there one combined seeding order? Different brackets.
3. **What happens to the regular table** once the playoff starts. Frozen, or
   still shown?
4. **Third-place and placement matches** — worth it, or noise?

## Risks

- A playoff phase that changes the meaning of "the table" will interact with
  the round summary email and the archive. Both assume one table per season.
- Archiving currently deletes games. A playoff bracket has to survive the
  archive in a readable form or it is lost.
