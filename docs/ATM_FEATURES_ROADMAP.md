# ATM Features & Product Roadmap

## 1. Product direction

ATM should combine two areas that are often separated:

1. league / competition administration
2. everyday team management

The strongest differentiator can be that both are connected through one data model.

---

## 2. Core league features

### League and season management
- create league
- create seasons
- archive completed seasons
- copy settings from previous season
- multiple divisions/groups
- playoffs
- relegation/promotion support
- custom scoring rules

### Team management
- add/remove teams
- team branding
- logos
- colors
- roster
- contacts
- home venue
- team administrators

### Schedule
- manual fixture creation
- automatic schedule generation
- round robin generation
- home/away balancing
- rescheduling
- postponed matches
- venues
- collision checks

### Digital match report
Already a key part of ATM.

Recommended additions:
- pre-match roster confirmation
- starting goalie
- officials
- period tracking
- goals
- assists
- penalties
- goalie changes
- shootout
- notes
- match confirmation workflow
- edit history
- dispute/correction workflow

---

## 3. Statistics

### Player statistics
For hockey:
- games played
- goals
- assists
- points
- penalty minutes
- points per game
- goals per game
- current streak
- last N games

Potential future statistics:
- power-play goals
- short-handed goals
- game-winning goals
- plus/minus if input data allows it

### Goalie statistics
- games
- starts
- wins/losses
- goals against
- goals-against average
- save percentage if shots are recorded
- shutouts

### Team statistics
- wins
- losses
- overtime losses
- goals for/against
- goal difference
- home/away performance
- form
- winning/losing streak
- power play / penalty kill if underlying data exists

### Rankings
- top scorers
- top goal scorers
- top assists
- penalty leaders
- goalie leaders
- team form
- season records

### Historical statistics
- season history
- all-time leaders
- team records
- league records
- player career profile

---

## 4. Personal area – My ATM

A logged-in player should have a useful personal dashboard.

Possible widgets:
- next match
- upcoming events
- attendance requests
- personal statistics
- recent matches
- team announcements
- current league position
- unread notifications

This can become the main daily entry point for players.

---

## 5. Team management

### Attendance / RSVP
For:
- matches
- training
- team events

Statuses:
- attending
- not attending
- maybe
- no response

Manager view:
- summary
- missing responses
- filters
- reminders

### Nominations
Coach selects players from available roster.

Possible workflow:

`Event -> Attendance -> Nomination -> Match Roster -> Match Report`

### Lineups
Future feature:
- forward lines
- defense pairs
- starting goalie
- scratches

### Team calendar
Events:
- league matches
- friendly matches
- training
- meetings
- tournaments
- custom events

### Calendar integration
- iCal feed
- Google Calendar
- Apple Calendar
- Outlook

---

## 6. Notifications

Channels:
- in-app
- email
- push later

Triggers:
- new fixture
- fixture changed
- attendance request
- nomination
- match reminder
- result published
- announcement
- disciplinary decision

Allow per-user notification preferences.

---

## 7. Public league microsite

Each league should receive a public page automatically.

Possible pages:
- homepage
- standings
- schedule
- results
- teams
- players
- statistics
- news
- tournaments
- sponsors

Nice-to-have:
- custom logo/colors
- custom domain
- social sharing cards
- widgets embeddable into another website

---

## 8. Tournament features

- tournament creation
- team registration
- groups
- bracket
- seeding
- automatic advancement
- placement matches
- live results
- tournament statistics
- QR code to public tournament page
- printable schedule
- TV / big-screen view

---

## 9. Communication

Do not prioritize full chat initially.

Start with:
- announcements
- targeted announcements
- email broadcast
- read confirmation
- simple polls

Later:
- comments
- team chat
- league chat

---

## 10. Finance / payments

Potential team features:
- membership fees
- event fees
- tournament fees
- payment status
- reminders

Potential league features:
- team registration fees
- invoice tracking
- payment status

Online payment processing can come later.

---

## 11. Sponsors

League/team sponsor management:
- sponsor logo
- website
- placement
- active period

Display options:
- league homepage
- standings
- match detail
- team profile
- tournament page

This can be valuable both as a product feature and as a monetization argument.

---

## 12. Advanced features

### Live match center
- live score
- timeline
- penalties
- period
- goal scorers

### Live display mode
Designed for TV/projector/arena display.

### Exports
- CSV
- XLSX
- PDF
- printable match reports
- season reports

### API
Paid/API tier:
- fixtures
- results
- standings
- statistics
- players
- teams

### Webhooks
Examples:
- match.finished
- result.updated
- fixture.changed

### Imports
- CSV roster import
- team import
- historical data import

---

## 13. AI-assisted features – later

Only after the core data model is reliable.

Possible applications:
- automatic match recap from structured match events
- weekly league summary
- player form summary
- automatic social media post draft
- anomaly detection in match reports
- natural-language statistics queries

Example:

> Who has scored the most goals in the last five rounds?

---

## 14. Roadmap proposal

### Phase 1 – Hockey league core
- match report
- results
- standings
- statistics
- public league page

### Phase 2 – Team operations
- users/players
- scoped roles
- attendance
- nominations
- calendar
- notifications

### Phase 3 – Competition maturity
- playoffs
- tournament module
- disciplinary workflows
- audit log
- advanced statistics

### Phase 4 – Commercial layer
- entitlements
- subscriptions
- sponsor tools
- exports
- custom branding
- API

### Phase 5 – Expansion
- mobile/PWA improvements
- additional sports
- AI-generated content
- partner integrations

---

## 15. Agent guidance

When selecting the next feature, prefer functionality that:

1. saves administrators time
2. improves data quality
3. increases recurring player usage
4. creates useful public content
5. works from structured match data
6. can later support multiple sports
