# 06 — Billing and entitlements

> **Postponed — 2026-09-13.** Deliberately deferred to a later stage. Nothing
> in Tier 3 is to be gated in the meantime: build features as free and
> unrestricted, and add the entitlement check when this is picked up.
>
> The cost of that choice is understood and written down here rather than
> discovered later: every feature built before entitlements exist will need a
> check added afterwards. That is the accepted trade.

Entitlements decide whether every other feature here is free, paid, or capped.

`docs/ATM_PRICING.md` has a full proposal and **no code whatsoever** behind it:
`subscription`, `entitlement`, `stripe`, `billing` all return zero hits in the
codebase.

## What the pricing doc already settles

- Charge the **organiser**, not the player. Per league or per season, never per
  head.
- The free tier must be genuinely usable, so a real league can evaluate it.
- Never paywall basic public results, standings or match data.
- Charge for: scale, administrative automation, presentation, historical depth,
  analytics, integrations, support.
- Acquisition: first season free.

## What it needs

```prisma
enum PlanTier { FREE, CLUB, LEAGUE, PRO }

model Subscription {
  id         String   @id @default(uuid())
  tier       PlanTier @default(FREE)
  // Who is paying for what. A subscription covers a league, not a user:
  // the organiser may change without the league changing hands.
  leagueId   String?  @unique
  seriesId   String?  @unique   // tournament series, the other payable unit
  status     String              // active, past_due, cancelled, trialing
  currentPeriodEnd DateTime?
  externalId String?             // the provider's id; never the source of truth for access
  createdAt  DateTime @default(now())
}

model Entitlement {
  id             String @id @default(uuid())
  subscriptionId String
  key            String   // "seasons.max", "customDomain", "api.read"
  limit          Int?     // null means unlimited
}
```

Two tables, not one, because the pricing doc explicitly warns against paid
features being "scattered conditionals". Code asks
`can(league, 'customDomain')` or `within(league, 'teams.max')` — never
`if (tier === 'PRO')`. A plan change then edits data, not code.

## The enforcement layer

One service, mirroring `services/access.ts`, which is the shape that already
works here:

```ts
// services/entitlements/check.ts
export const entitlementsFor = (leagueId: string): Promise<Entitlements>
export const can = (e: Entitlements, key: string): boolean
export const within = (e: Entitlements, key: string, current: number): boolean
```

and a guard, mirroring `middleware/access.ts`, for routes that create things
against a quota.

## Grandfathering, which is the part that goes wrong

Every league in the database today has no subscription. Whatever the free tier
caps, existing leagues are probably already over it. The migration must create
a subscription for every existing league with limits set at or above what that
league currently uses — the same principle as the scoring migration: **shipping
a rule must not change what existing users already have.**

## Decisions needed — all of them yours

1. **The unit.** League, season, or organisation? The doc leans league. A club
   running one team in someone else's league pays for what, exactly?
2. **The free tier's exact shape.** Your memory records a plan of one league +
   one season + ~4 teams, deferred. Is that still the shape?
3. **What "first season free" means mechanically** — a trial flag with an end
   date, or a season counter?
4. **Provider.** Stripe is the obvious answer. Czech leagues paying by bank
   transfer is the realistic one. Invoice-and-mark-paid may matter more than
   card payments at this size.
5. **What happens at the cap.** Refuse to create, or accept and nag? Refusing a
   league admin mid-setup is how you lose them.
6. **What happens when a subscription lapses.** Public pages must not go dark —
   the doc is explicit that results stay free. So lapsing restricts
   administration, not reading. Confirm.

## Risks

- Access must never be read live from the payment provider. Store the state,
  update it from webhooks, and fail **open** on a provider outage: a league
  locked out of its own fixtures on a Saturday because a webhook was late is a
  lost customer.
- Entitlement checks in hot paths will be N+1 queries unless cached per request.
