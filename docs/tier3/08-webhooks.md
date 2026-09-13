# 08 — Webhooks

## The problem

A club wants its own site to update when a result is confirmed. Polling the API
is the alternative and it is worse for everyone.

## Events worth sending

Deliberately few, and all of them things that just became **true** — not things
that are in progress:

- `match.confirmed` — a result became official
- `match.reopened` — an official result was reopened, with the reason
- `fixture.scheduled` / `fixture.rescheduled` / `fixture.cancelled`
- `standings.updated` — derived, fires after a confirmation
- `season.archived`

Note what is missing: nothing fires for an unconfirmed score or a live one. A
subscriber that acted on those would be acting on numbers the table itself does
not count.

## What it needs

```prisma
model WebhookEndpoint {
  id        String   @id @default(uuid())
  leagueId  String
  url       String
  secret    String              // for the signature
  events    String[]
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
}

model WebhookDelivery {
  id          String   @id @default(uuid())
  endpointId  String
  event       String
  payload     Json
  status      Int?                // last HTTP status
  attempts    Int      @default(0)
  nextAttempt DateTime?
  deliveredAt DateTime?
  createdAt   DateTime @default(now())
}
```

`WebhookDelivery` is the whole feature. Without a queue with retries this is a
`fetch()` in a request handler that silently drops on the first timeout.

## Delivery rules

- Sign the body with the endpoint secret (HMAC-SHA256, timestamped header) so
  the receiver can verify it. An unsigned webhook is an open invitation.
- Retry with backoff, cap the attempts, mark the endpoint unhealthy after
  repeated failure and tell the league.
- **Never** let a delivery failure fail the request that caused it. Confirming
  a result must succeed whether or not somebody's server answers.

## The infrastructure question

There is no job runner in this product. Round summary emails are sent inline in
the request, which is acceptable at their volume and would not be here. This
feature needs a queue and a worker, which is the real cost — the schema above
is the easy half.

## Decisions needed

1. **Queue technology**, and whether a worker process is acceptable
   operationally. `pg-boss` keeps it inside Postgres and adds no new service.
2. **Whether this predates a job runner at all.** Notifications and scheduled
   round summaries want the same infrastructure — build it once for all three.

## Dependencies

[07](07-exports-and-api.md) for the key/endpoint management UI.
Shares infrastructure with scheduled emails and notifications.
