# ATM Architecture

## 1. Product goal

ATM (Amateur Team Management) is a web platform for managing amateur sports competitions, initially focused on ice hockey.

The long-term architecture should support multiple sports without forcing hockey-specific rules into the core domain.

Core principle:

> Keep the platform core generic and move sport-specific rules into dedicated sport modules.

---

## 2. Main user roles

### Platform Superadmin
Responsible for the whole ATM platform.

Typical permissions:
- manage users
- manage leagues
- manage global configuration
- manage sports/modules
- manage subscriptions and entitlements
- manage platform-wide moderation
- inspect audit logs
- support league administrators

### League Administrator
Responsible for one league or competition.

Typical permissions:
- create and configure seasons
- manage teams
- create or generate schedules
- manage fixtures
- validate match reports
- correct results
- manage disciplinary decisions
- configure league-specific rules
- publish announcements
- manage sponsors
- manage league branding

### Team Administrator / Team Manager
Responsible for one team.

Typical permissions:
- manage roster
- invite players
- manage player information
- manage attendance
- prepare nominations
- manage team events
- communicate with players
- view team-specific statistics

### Coach
Optional separate role.

Typical permissions:
- nominations
- lineups
- attendance
- training/events
- match preparation

### Player
Typical permissions:
- personal dashboard
- confirm attendance
- see fixtures and events
- see personal statistics
- receive notifications

### Public Visitor
No login required.

Can see:
- league tables
- schedules
- results
- public statistics
- teams
- players
- league news
- tournament pages

---

## 3. Recommended architecture

For the current stage, use a modular monolith rather than microservices.

Suggested logical modules:

### ATM Core
Generic platform capabilities:
- users
- authentication
- authorization
- organizations
- roles and permissions
- audit log
- notifications
- files/media
- feature flags
- subscription entitlements
- common settings

### Competition Engine
Generic competition management:
- leagues
- competitions
- seasons
- divisions/groups
- teams
- fixtures
- standings
- schedules
- competition phases
- playoffs
- tournaments
- disciplinary decisions

### Sport Module
Defines sport-specific behavior.

For hockey:
- periods
- overtime
- shootouts
- penalty types
- hockey scoring rules
- player positions
- goalie statistics
- team/player game events

Future sport modules could include football, floorball, basketball, volleyball, etc.

Important rule:
Competition Engine should not contain hard-coded assumptions such as "3 periods" or "2 points for a win".

### Game Engine
Responsible for one match/game.

Core entities:
- Match
- MatchParticipant
- MatchRoster
- MatchEvent
- MatchStatus
- MatchReport
- Officials
- Venue

For hockey, match events may include:
- goal
- assist
- penalty
- goalie change
- timeout
- period start/end
- shootout attempt

The digital match report should be the single source of truth for match data.

### Statistics Engine
Consumes match events and derives:
- player statistics
- goalie statistics
- team statistics
- leaderboards
- form
- streaks
- head-to-head statistics
- season aggregates
- career aggregates

The preferred model is:

`Match Report -> Match Events -> Statistics -> Standings -> Public presentation`

### Tournament Module
Tournament support should share the generic Competition Engine where possible.

Possible tournament formats:
- round robin
- groups + playoffs
- single elimination
- double elimination
- Swiss system
- custom bracket

Features:
- seeding
- bracket generation
- placement matches
- tournament-specific standings
- live bracket
- public tournament page

### Public Web / League Microsite
Every league should optionally have an automatically generated public website.

Possible sections:
- home
- standings
- schedule
- results
- teams
- players
- statistics
- news
- sponsors
- tournament bracket

This public layer is important for product growth because participants naturally share league pages.

---

## 4. Suggested domain model

High-level entities:

- User
- Organization
- Role
- Permission
- Sport
- SportRuleSet
- League
- Season
- Competition
- CompetitionPhase
- Division
- Team
- TeamMembership
- Player
- Fixture
- Match
- MatchRoster
- MatchEvent
- MatchReport
- Standing
- Statistic
- StatisticDefinition
- Venue
- Official
- DisciplineCase
- Announcement
- Sponsor
- Subscription
- Entitlement
- AuditLog

---

## 5. Sport abstraction

Do not implement sports only as an enum with many conditionals.

Prefer a module/capability approach.

Example:

- `SportDefinition`
- `RuleSet`
- `ScoringPolicy`
- `MatchFormat`
- `StatisticDefinition`
- `EventDefinition`

Hockey module can provide:
- 3 periods
- overtime options
- shootout
- point allocation
- hockey event types
- hockey statistics

This makes future expansion substantially easier.

---

## 6. Permissions model

Use scoped RBAC.

A user can have different roles in different scopes.

Examples:
- Superadmin -> platform
- League Admin -> League A
- Team Admin -> Team X
- Player -> Team X
- League Admin in League A can simultaneously be Player in League B

Recommended authorization structure:

`User + Role + Scope + Permissions`

Avoid relying only on global roles.

---

## 7. Data integrity principles

### Match report as source of truth
Statistics and standings should be reproducible from underlying match data.

### Recalculation
When an administrator edits a historical match, the system should be able to recalculate affected statistics and standings.

### Audit trail
Administrative corrections should be recorded.

Store:
- who made the change
- when
- old value
- new value
- optional reason

### Soft locking
After a match is confirmed, edits should require elevated permissions or reopening the match report.

---

## 8. Recommended technical direction

At the current stage:

- modular monolith
- clear module boundaries
- event-driven internal architecture where useful
- relational database
- background jobs for recalculation and notifications
- feature flags / entitlements for paid functionality
- API-first backend so a mobile app can be added later

Avoid premature microservices.

---

## 9. Priority implementation order

1. Reliable hockey match report
2. Automatic standings
3. Player/team statistics
4. League public pages
5. Roles and scoped permissions
6. Team management
7. Attendance and nominations
8. Notifications
9. Tournament workflows
10. Billing and entitlements
11. Advanced analytics
12. Additional sports

---

## 10. Agent guidance

When implementing new functionality:

- do not hard-code hockey logic into ATM Core
- keep sport-specific behavior inside sport modules
- preserve recalculability of statistics
- treat match events as structured data
- use scoped permissions
- ensure paid features are controlled through entitlements, not scattered conditionals
- prefer incremental changes over a large rewrite
