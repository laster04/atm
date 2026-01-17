# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sport Season Scheduling application - a full-stack web app for managing sports seasons, teams, players, and game schedules.

## Tech Stack

- **Backend**: Node.js + Express.js + TypeScript (ES modules), Prisma ORM, PostgreSQL, JWT authentication
- **Frontend**: React 19 + Vite + TypeScript, React Router v7, Tailwind CSS, Axios

## Commands

### Backend (from `backend/` directory)
```bash
npm run dev          # Start dev server with tsx watch (port 3001)
npm run build        # Compile TypeScript to dist/
npm start            # Start production server from dist/
npm run db:migrate   # Run Prisma migrations
npm run db:generate  # Generate Prisma client
npm run db:seed      # Seed database
```

### Frontend (from `frontend/` directory)
```bash
npm run dev      # Start Vite dev server (port 5173)
npm run build    # TypeScript check + production build
npm run lint     # Run ESLint
npm run preview  # Preview production build
```

### Docker
```bash
docker compose up --build  # Build and start all services (db, backend, frontend)
docker compose down        # Stop all services
```

## Architecture

### Backend Structure
- `src/index.ts` - Express app entry point, route mounting
- `src/routes/` - Route definitions (auth, seasons, teams, players, games)
- `src/controllers/` - Request handlers for each route
- `src/middleware/auth.ts` - JWT auth middleware: `authenticate`, `authorize(roles...)`, `optionalAuth`
- `src/config/database.ts` - Prisma client instance
- `src/types/index.ts` - TypeScript type definitions (AuthUser, AuthRequest, JwtPayload)
- `prisma/schema.prisma` - Database schema

### Frontend Structure
- `src/App.tsx` - Root component with routing
- `src/context/AuthContext.tsx` - Auth state management via React Context
- `src/services/api.ts` - Axios instance with auth interceptors and typed API functions
- `src/types/index.ts` - TypeScript type definitions (User, Season, Team, Player, Game, Standing)
- `src/pages/` - Page components (Home, Login, Register, Seasons, SeasonDetail, TeamDetail, Admin)
- `src/components/` - Reusable components (Navbar)

### Data Model
- **User**: email, password, name, role (ADMIN/TEAM_MANAGER/VIEWER)
- **Season**: name, sportType, dates, status (DRAFT/ACTIVE/COMPLETED), has many teams and games
- **Team**: name, logo, belongs to season, optional manager (User), has players
- **Player**: name, number, position, belongs to team
- **Game**: date, location, scores, status, round, belongs to season with home/away teams

### API Routes
All routes prefixed with `/api`:
- `/auth` - register, login, profile
- `/seasons` - CRUD + standings
- `/teams` - CRUD by season
- `/players` - CRUD by team
- `/games` - CRUD by season + schedule generation

### Environment
- Backend: `.env` with `DATABASE_URL`, `JWT_SECRET`, `PORT`
- Frontend: `VITE_API_URL` (defaults to `http://localhost:3001/api`)
- Vite proxies `/api` to backend in development
