# ATM Pricing & Monetization Proposal

## 1. Monetization principle

Do not charge primarily per player or per user.

For amateur leagues, a more natural payer is the league organizer or club administrator.

Recommended charging unit:

- league
- season
- organization
- premium feature set

The product should remain easy to adopt and easy to demonstrate.

---

## 2. Core freemium philosophy

The free tier must be useful enough for a real league to understand the product.

Do not hide basic public results, standings, or match data behind a paywall.

Charge for:
- scale
- administrative automation
- professional presentation
- historical depth
- advanced analytics
- integrations
- premium support

---

## 3. Acquisition model

### Recommended option: First season free

A new league can run its first complete season without paying.

Benefits:
- low friction
- the organizer can test ATM in real operation
- players become accustomed to the platform
- historical data creates natural retention
- payment decision happens after value is proven

Possible rule:
- first league season free
- applies once per organization/league
- abuse prevention may be added later

---

## 4. Alternative / complementary free tier

A permanently free small league can help organic adoption.

Example:
- up to 4 or 6 teams
- basic schedule
- results
- standings
- basic statistics
- public ATM-branded league page

Avoid hard-coding the team limit in business logic.

Store limits in plan configuration / entitlements.

---

## 5. Suggested plans

Names are placeholders.

### Free
Suitable for testing and very small competitions.

Possible limits:
- 1 active league
- small number of teams
- basic match reports
- basic standings
- basic statistics
- ATM branding
- public league site
- basic team administration

### Standard
For typical amateur leagues.

Includes:
- more teams
- unlimited or higher fixture limit
- full player statistics
- goalie statistics
- attendance
- nominations
- calendar integrations
- email notifications
- exports
- sponsor management

### League Pro
For larger or more professional amateur organizations.

Includes:
- multiple competitions/divisions
- advanced statistics
- custom branding
- custom domain
- historical reports
- API access
- webhooks
- advanced permissions
- priority support
- enhanced exports

### Organization / Federation
Later.

Potential features:
- multiple leagues
- centralized administration
- multiple seasons/competitions
- organization-wide branding
- consolidated statistics
- SSO
- audit/reporting
- SLA/support

---

## 6. What should remain free

Recommended free/public functionality:

- public schedules
- public results
- standings
- basic team pages
- basic player statistics
- public match detail
- mobile-friendly public league page

Why:
Every public league page becomes marketing for ATM.

A result shared in a team chat or on social media exposes new users to the product.

---

## 7. Good candidates for paywall

### Administrative productivity
- automatic schedule generation
- advanced rescheduling tools
- bulk operations
- imports
- advanced notifications
- attendance automation

### Advanced statistics
- historical comparisons
- career statistics
- advanced leaderboards
- split statistics
- trends
- downloadable reports

### Professional presentation
- custom branding
- remove ATM branding
- custom domain
- custom homepage
- premium sponsor placements

### Data and integrations
- CSV/XLSX exports
- advanced PDF reports
- API
- webhooks
- integrations

### Historical depth
Possible model:
- current season free/basic
- multiple archived seasons available in paid plan

Be careful not to lock a league out of its own essential data.

---

## 8. Team-based monetization

A price-per-additional-team model is technically possible.

Example concept:

`Base season price + included teams + fee per additional team`

This can work, but it has disadvantages:
- pricing becomes less predictable
- growth feels penalized
- league administrators need to recalculate cost when teams join/leave

A cleaner model may be size bands.

Example:
- Small: up to 6 teams
- Medium: up to 12 teams
- Large: up to 24 teams
- Custom: above that

Exact numbers should be validated with real customers.

---

## 9. Season-based pricing

For amateur leagues, pricing per season is attractive because it matches how organizers think.

Possible model:

`League subscription = one season`

Advantages:
- simple
- predictable
- tied to real value
- easy invoicing
- no need to count active users monthly

Renewal flow:
1. season ends
2. organizer creates next season
3. ATM offers renewal
4. existing league/team data can be copied forward

---

## 10. Add-ons

Potential paid add-ons:

- custom domain
- SMS notifications
- additional storage
- white-label mode
- premium support
- data migration
- setup/onboarding
- advanced live-display package
- API package

---

## 11. Sponsorship opportunities

ATM can help leagues fund the software.

A league can sell sponsor visibility inside:
- match pages
- standings
- statistics pages
- tournament bracket
- league homepage

This creates a strong sales argument:

> The league can partially or fully fund ATM through sponsor placements.

Premium plans can include more sponsor controls.

---

## 12. Entitlements architecture

Do not implement pricing as scattered code such as:

```text
if plan == PRO
```

Prefer an entitlement layer.

Examples:
- `advanced_statistics`
- `custom_domain`
- `max_teams`
- `season_history_depth`
- `api_access`
- `export_xlsx`
- `remove_atm_branding`

An entitlement can be:
- boolean
- numeric limit
- quota

Example:

```text
plan.free.max_teams = 6
plan.standard.max_teams = 16
plan.pro.max_teams = unlimited
```

This allows pricing to change without rewriting domain logic.

---

## 13. Trial / first-season logic

Model the first-season offer separately from the permanent Free plan.

Conceptually:

- Plan = what the customer owns
- Promotion = temporary commercial condition
- Entitlement = what the product allows

Examples of promotions:
- first season free
- 60-day trial
- free migration
- discount for early adopters

Do not embed promotional logic directly into competition entities.

---

## 14. Recommended initial model for ATM

For launch:

### Free
- one small league
- basic competition management
- match report
- results
- standings
- basic stats
- public ATM-branded site

### First season promotion
- unlock Standard features for the first season

### Standard
- priced per league/season
- full team and league management
- attendance
- nominations
- notifications
- richer statistics
- sponsor tools
- exports

### Pro
- advanced analytics
- custom branding/domain
- API
- advanced exports
- multiple competitions
- priority support

This model gives users a reason to try ATM without making the free product useless.

---

## 15. Metrics to track before fixing final prices

Track:
- leagues created
- leagues that create a first match
- leagues that finish first round
- active players per league
- matches per season
- retention into second season
- number of teams
- public page traffic
- feature usage
- admin time saved
- conversion from first free season to paid

Pricing should be adjusted from usage data, not guessed once and frozen forever.

---

## 16. Agent guidance

When implementing monetization:

- use entitlements
- make pricing configurable
- separate promotions from plans
- never couple core league data to payment status
- do not delete or corrupt historical data after downgrade
- define graceful downgrade behavior
- keep public league content as an acquisition channel
