# Aura Volley Group Tournament System

Tournament management platform for organizing and scoring competitive volleyball events. Handles team registration, bracket generation, match scheduling, live scoring, and tournament administration with built-in integrity constraints and role-based access controls.

---

## Features

**Team and player management** — Register teams with multiple players, manage roster assignments, and handle team withdrawals with automatic bracket reconciliation.

**Tournament brackets** — Generate single-elimination or round-robin brackets with constraint-based scheduling. Handles complex pool configurations including 6/7-team pools spanning multiple courts.

**Match scheduling** — Automatic schedule generation with conflict detection, court allocation, and match slot management. Validates resource constraints before committing schedules.

**Live scoring** — Real-time score entry with validation, forfeit handling, and match completion tracking. Work team assignments manage which team scores next match.

**Score links** — One-time token-based scoring links for authorized teams, preventing unauthorized score modifications.

**Bracket propagation** — Automatic winner advancement through bracket layers with head-to-head tiebreaker support and withdrawn team forfeit handling.

**Admin panel** — Tournament management, bracket corrections, score reversals, and team withdrawal controls with audit trails.

**Ranking and standings** — Real-time standings calculation with sets-won primary sorting, head-to-head tiebreaks, and point differential fallback.

---

## Technology stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | Next.js 16.1.1 | Full-stack React with app router |
| Runtime | React 19.2.3 | UI components and hooks |
| Styling | Tailwind CSS 4 | Utility-first CSS framework |
| Database | PostgreSQL (Supabase) | Tournament and match data |
| Auth | NextAuth 5.0 | Authentication and session management |
| Payments | Stripe 20.4.1 | Payment processing |
| Email | Resend 6.12.0 | Transactional email delivery |
| Testing | Vitest 3.2.4, Playwright 1.60.0 | Unit, integration, and E2E tests |
| Linting | ESLint 9 | Code quality and style enforcement |

---

## Getting started

Install dependencies:

```bash
npm install
```

Start the local development database:

```bash
npm run db:start
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

### Database setup

The integration test suite requires local database scripts. They are managed via:

```bash
npm run db:start    # Start Postgres and PostgREST
npm run db:reset    # Drop and recreate schema from migrations
npm run db:stop     # Stop database services
```

---

## Build and release

### Development

```bash
npm run build   # Compile TypeScript and Next.js
npm start       # Start production server
npm run lint    # Run ESLint on codebase
```

### Testing

```bash
npm test              # Run unit and integration tests
npm run test:unit     # Unit tests only (vitest)
npm run test:integration  # Integration tests with real DB
npm run test:e2e      # End-to-end tests (Playwright)
```

### Production build

The `npm run build` command produces an optimized Next.js bundle. Deploy the `.next/` directory and `public/` assets.

---

## Project structure

- `src/app/` — Next.js pages and route handlers (main tournament, admin panel, API routes)
- `src/app/(tournament)/` — Tournament-facing pages (scoring, standings, bracket view)
- `src/app/admin/` — Admin-only pages (bracket management, tournament controls)
- `src/app/api/` — API endpoints for scoring, registration, and bracket operations
- `src/components/` — Reusable React components
- `src/context/` — React Context providers for shared state
- `src/lib/` — Core business logic (ranking, bracket algorithms, constraint validation)
- `src/config/` — Configuration constants and settings
- `src/auth.ts` — NextAuth configuration and session handling
- `supabase/` — Database migrations and RLS policies
- `tests/` — Integration and E2E test suites
- `scripts/` — Database and CLI utilities

---

## Repository information

| Property | Value |
|----------|-------|
| Version | 0.1.0 |
| Repository | aura-volley-group-llc |
| Maintainer | Aura Volley Group |
| License | Proprietary |

---

## Engineering disclaimer

This tool is intended to assist qualified event organizers and administrators during tournament configuration and execution. Final tournament rules, brackets, and scoring must be reviewed and approved in accordance with applicable competitive standards and venue policies.
