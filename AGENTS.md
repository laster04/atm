# AGENTS.md

Guidance for AI coding agents working in this repo. Same rules as `CLAUDE.md` — read that too.

## Project

Sport Season Scheduling app — manage sports seasons, teams, players, games, and tennis tournaments.

## Stack

- Backend: Node.js + Express + TypeScript (ES modules), Prisma ORM, PostgreSQL, JWT auth
- Frontend: React 19 + Vite + TypeScript, React Router v7, Tailwind CSS, Axios

## Commands

Backend (from `backend/`):
```bash
npm run dev          # dev server, tsx watch, port 3001
npm run build        # tsc + prisma generate + prisma migrate deploy
npm start             # run compiled dist/
npm test              # jest (backend/src/__tests__/*.test.ts)
npm run db:migrate    # prisma migrate dev
npm run db:generate   # prisma generate
npm run db:seed       # seed db
```

Frontend (from `frontend/`):
```bash
npm run dev      # vite dev server, port 5173
npm run build    # tsc check + vite build
npm run lint     # eslint
npm run preview  # preview prod build
```

Docker (repo root):
```bash
docker compose up --build
docker compose down
```

No backend lint script configured. Frontend has no test script — verification there is `npm run build` (type-check) + manual browser check.

## Before finishing a task

- Backend changes: run `npx tsc --noEmit -p .` in `backend/` and `npm test` if logic touched.
- Frontend changes: run `npx tsc --noEmit -p .` (or `npm run build`) and `npm run lint` in `frontend/`.
- Frontend UI changes: start dev server, exercise the feature (and edge cases) in a browser before calling it done. Type-check/tests verify correctness of code, not of the feature.

## Architecture

Backend (`backend/src/`):
- `index.ts` — Express entry point, route mounting
- `routes/` — route definitions (auth, seasons, teams, players, games, tournaments...)
- `controllers/` — request handlers
- `middleware/auth.ts` — `authenticate`, `authorize(roles...)`, `optionalAuth`
- `config/database.ts` — Prisma client instance
- `types/index.ts` — shared TS types (AuthUser, AuthRequest, JwtPayload, request DTOs)
- `utils/` — shared logic used by multiple controllers (e.g. `tournamentStandings.ts`)
- `prisma/schema.prisma` — DB schema
- `__tests__/` — jest tests

Frontend (`frontend/src/`):
- `App.tsx` — root component, routing
- `context/AuthContext.tsx` — auth state via React Context
- `services/api.ts` — axios instance, auth interceptors, typed API functions
- `types/index.ts` — shared TS types (User, Season, Team, Player, Game, Standing, Tournament...)
- `pages/` — page components, often split into `Screen.tsx` + `components/` subfolder per page
- `components/` — reusable components
- `i18n/locales/{en,cs}.json` — translation strings

### Data model (core)

- **User**: email, password, name, role (ADMIN/TEAM_MANAGER/VIEWER)
- **Season**: name, sportType, dates, status (DRAFT/ACTIVE/COMPLETED); has teams + games
- **Team**: name, logo, belongs to season, optional manager (User), has players
- **Player**: name, number, position, belongs to team
- **Game**: date, location, scores, status, round, belongs to season with home/away teams
- **Tournament** (series-based, e.g. tennis): teams (single-player entities for TENNIS), groups, group games, standings, playoff bracket. See `tournamentStandings.ts` for scoring — sport-specific: default win=3/draw=1/loss=0 + goal-diff tiebreak; TENNIS win=1/draw=0/loss=0 + head-to-head tiebreak.

### API routes

All prefixed `/api`: `/auth`, `/seasons`, `/teams`, `/players`, `/games`, tournament routes (teams/groups/schedule/standings/playoff).

### Environment

- Backend `.env`: `DATABASE_URL`, `JWT_SECRET`, `PORT`, `CORS_ORIGIN`, `APP_URL`, `RESEND_API_KEY`, `EMAIL_FROM` (see `backend/.env.example`)
- Frontend: `VITE_API_URL` (defaults `http://localhost:3001/api`); Vite proxies `/api` to backend in dev

## Hard rules

### i18n

Every user-visible string added to any frontend component **must** be added to both `frontend/src/i18n/locales/en.json` and `frontend/src/i18n/locales/cs.json` at the same time. Use `useTranslation` + `t('key')`. Never hardcode English strings in JSX. No exceptions.

### Code style / scope

- Prefer editing existing files over creating new ones.
- No speculative abstractions, feature flags, or backwards-compat shims — match the size of the change to the size of the ask.
- No comments explaining *what* code does; only *why*, when non-obvious (hidden constraint, workaround, subtle invariant).
- Don't add error handling/validation for cases that can't occur; validate only at real system boundaries (user input, external APIs).
- Security: avoid injection/XSS/SQL-injection-class bugs; fix immediately if introduced.

### Git

- Only commit when the user explicitly asks.
- Never `--no-verify`, never force-push, never amend published commits, unless explicitly told to.
- Create new commits rather than amending, by default.
