# 03 — Discipline

## The problem

Penalties are recorded in the match report and then nothing happens. A player
who collects a match penalty is supposed to miss the next game, and today that
is tracked in somebody's notebook.

## What it needs

```prisma
enum DisciplineStatus { OPEN, UPHELD, DISMISSED, SERVED }

model DisciplineCase {
  id        String           @id @default(uuid())
  status    DisciplineStatus @default(OPEN)
  // What triggered it: usually a penalty event, sometimes a report after the fact
  eventId   String?          // MatchEvent
  gameId    String
  playerId  String?
  teamId    String
  reason    String
  // The punishment
  banGames  Int      @default(0)
  banUntil  DateTime?
  fine      Int?
  note      String?
  decidedById String?
  decidedAt   DateTime?
  createdAt   DateTime @default(now())
}

model DisciplineSuspension {
  id       String @id @default(uuid())
  caseId   String
  gameId   String   // a game this ban covers
  served   Boolean  @default(false)
}
```

Two tables rather than one because "banned for three games" only becomes real
when those three games are named — otherwise nobody can answer "is this player
eligible on Saturday?", which is the only question that matters.

## Where it plugs in

- **Match report**: a penalty over a threshold offers "open a case".
- **Team calendar / nominations**: a suspended player is shown as unavailable
  for the fixtures their ban covers.
- **Audit log**: every decision goes through `recordAudit` — this is exactly
  the kind of administrative act the trail exists for.

## API sketch

```
GET    /api/seasons/:id/discipline
POST   /api/games/:gameId/discipline
PUT    /api/discipline/:id            rule on it
GET    /api/teams/:id/suspensions     who is unavailable, and for which games
```

## Decisions needed

1. **Who rules?** League manager only, or a disciplinary panel role? The
   permission model is relation-based, so a panel means a new relation, not a
   new role enum value.
2. **Automatic bans.** Should a match penalty create a case automatically, or
   only suggest one? Automatic is tidier and much angrier when it is wrong.
3. **Ban arithmetic.** Does a ban count league games only, or any fixture? What
   happens if the season ends with games unserved — does it carry over?
4. **Public or private.** Do suspensions show on the public site?

## Dependencies

Match events (shipped), audit log (shipped). Nominations, if suspensions should
block selection, are still unbuilt — see Tier 2 leftovers.
