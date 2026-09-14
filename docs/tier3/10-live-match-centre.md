# 10 — Live match centre

## The problem

The standings already project what a game in progress would do to the table —
that shipped. But nothing feeds it: a manager enters the result once, at the
end, so `IN_PROGRESS` with a running score almost never exists in practice.

**The projection is built and currently invisible.** This feature is what makes
it real.

## What it needs

No new tables. `MatchEvent` already records goals with assists, penalties,
period markers and goalie changes, with a timestamp; the score, period scores
and player lines already recompute on every write.

What is missing is a way to enter events **as they happen**:

- A running clock, or at least a period selector that does not need five taps.
- Big targets: a goal is two taps — scorer, assist — from the team's roster.
- Works on a phone at a cold rink, with one hand, possibly with gloves on.
- Survives the connection dropping, which it will. Queue events locally and
  send when the connection returns; the log is append-mostly, so this is
  tractable.
- Sets the game `IN_PROGRESS` on the first event and offers `COMPLETED` at the
  end — the status should follow from what the operator does, not be a separate
  chore they forget.

## The viewer side

- Public match page with the timeline, updating without a refresh.
- Season page showing what is being played right now.
- A big-screen view for a projector or a TV in the clubhouse: score, period,
  scorers, nothing else.

## Updating without a refresh

Polling every 15–30s is almost certainly enough at this scale and needs no new
infrastructure — the standings already poll at 30s. SSE is a modest step up and
one-way, which fits. WebSockets are almost certainly overkill here.

## Decided

**2026-09-13.** Next up, and it starts with the smallest piece: a **scheduled
job that sets a fixture to IN_PROGRESS when its start time passes**. That alone
makes the projection visible without anyone learning a new screen, and it needs
the job runner that notifications and webhooks will want anyway — see
[13](13-scheduled-jobs.md).

The full live-entry screen follows once games reliably enter the live state.

## Decisions needed

1. **Who operates it?** The home team manager is the obvious answer and the
   one with a conflict of interest. Does the away side get to dispute? That
   ties into the reopen-with-reason flow that already exists, and possibly into
   [03](03-discipline.md).
2. **Does the live score need confirming separately** from the final result?
   Standings count confirmed results only, so a live game never touches the
   table — the existing rule already handles this cleanly.
3. **How much offline support.** Full offline is a large piece of work; a queue
   that survives a two-minute dropout is much smaller and covers the real case.

## Dependencies

Match events (shipped). Live projection in standings (shipped). This is the
missing input, not new machinery.
