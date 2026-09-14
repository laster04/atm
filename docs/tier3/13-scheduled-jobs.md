# 13 — Scheduled jobs, starting with kick-off

**Wanted next.** Asked for on 2026-09-13 as the way to make the live table real
([10](10-live-match-centre.md)).

## The problem

The standings already project what a game in progress would do to the table.
Nothing feeds it: a fixture only becomes `IN_PROGRESS` if a manager opens the
app mid-game and changes the status by hand, which nobody does. The feature is
built and invisible.

The immediate ask: **when a fixture's start time passes, set it to
IN_PROGRESS automatically.**

## The wider point

That is one job, but there is no job runner in the product at all. Three
features want the same machinery, and building it three times would be silly:

| Wants it | For |
|---|---|
| kick-off | flip a fixture to live at its start time |
| round summary ([06 of Tier 2]) | send after a round rather than when a manager remembers |
| webhooks ([08](08-webhooks.md)) | deliver with retries, off the request path |

Round summary emails are currently sent **inline in the request**, which is
fine at their volume and will not be for webhooks.

## What it needs

`pg-boss` keeps the queue in Postgres and adds no new service to the compose
file, which matters for a product deployed with `docker compose up`. The
alternative — Redis plus a worker — is more machinery than this needs.

```
backend/src/jobs/
  runner.ts        boot the scheduler, register handlers
  kickoff.ts       fixtures whose start time has passed -> IN_PROGRESS
  digest.ts        round summaries, when scheduling is added
  webhooks.ts      delivery with backoff, later
```

### The kick-off job

Every few minutes:

```
games where status = SCHEDULED
  and date <= now()
  and date >= now() - 6 hours     // do not resurrect last month's backlog
  -> status = IN_PROGRESS
```

The lower bound is the important part. Without it, the first run would sweep up
every past fixture that was never given a result and mark them all live.

## Decisions needed

1. **Does a game ever go to COMPLETED by itself?** Almost certainly not: a
   finished game needs a score, and only a person has one. Auto-live, manual
   finish.
2. **What about a game nobody ever finishes?** It sits IN_PROGRESS forever,
   projecting a 0-0 into the table's live view. Either the projection ignores a
   game that has been live for more than N hours, or a second job flags it to
   the manager. The first is simpler and lies less.
3. **Timezone.** Fixture times are stored as instants, so the job is
   timezone-free — but a league spanning timezones would need the venue's, and
   there is no venue model yet.
4. **Does the manager get told** that their fixture went live by itself?

## Risks

- A scheduler that runs in every replica will do the work several times. Locking
  is `pg-boss`'s job, but it has to be configured for it.
- A background process changing game state means the audit trail gains entries
  with no actor. `recordAudit` already allows a null actor for exactly this;
  the migration that confirmed old results set the precedent.
