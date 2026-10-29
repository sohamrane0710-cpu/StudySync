# StudySync Backend

The backend engine for **StudySync**, a collaborative study productivity platform providing authoritative Pomodoro/deep-work timers, personal study analytics, and real-time collaborative rooms.

Built as a modular monolith using **NestJS**, **TypeScript (strict)**, **Prisma ORM**, and **PostgreSQL** with a clean integration boundary for **Supabase Auth**.

---

## 1. Quick Start (Local Development)

### Prerequisites
- Node.js LTS (v20+ / v22+ / v26)
- Docker & Docker Compose (or a local PostgreSQL 15+ instance)
- npm (v10+)

### 1.1 Clone & Install
```bash
cd backend
npm install
```

### 1.2 Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Default local settings in `.env`:
```env
PORT=3000
NODE_ENV=development
API_PREFIX=api/v1
CORS_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/studysync?schema=public
AUTH_MODE=dev
DEV_AUTH_SECRET=local-studysync-dev-jwt-secret-do-not-use-in-prod-32c
```

### 1.3 Start Local PostgreSQL
Using the included `docker-compose.yml`:
```bash
docker compose up -d
```
This runs PostgreSQL 16 on port 5432 with persistent storage and health checks.

### 1.4 Apply Prisma Database Migrations
```bash
npx prisma migrate dev
```
This applies all versioned migrations (including custom PostgreSQL check constraints, partial unique indexes, and RLS policies).

### 1.5 Start the Development Server
```bash
npm run start:dev
```
- API Base URL: `http://localhost:3000/api/v1`
- Health Endpoint: `http://localhost:3000/api/v1/health`
- Swagger OpenAPI Docs: `http://localhost:3000/api/docs`

---

## 2. Environment Variables Reference

| Variable | Description | Default / Example |
|---|---|---|
| `PORT` | HTTP port on which NestJS listens | `3000` |
| `NODE_ENV` | Environment mode (`development`, `test`, `production`) | `development` |
| `API_PREFIX` | Global URI prefix for REST routes | `api/v1` |
| `CORS_ORIGIN` | Allowed CORS origins (comma-separated if multiple) | `http://localhost:5173` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://...` |
| `AUTH_MODE` | Auth verification mode: `supabase` or `dev` | `dev` |
| `DEV_AUTH_SECRET` | Symmetric secret for local dev JWT verification (rejected in production) | `local-studysync-dev-...` |
| `SUPABASE_URL` | Supabase project URL (used for JWKS verification) | `https://your-project.supabase.co` |
| `SUPABASE_JWT_SECRET` | Supabase JWT secret (for HS256 tokens) | Placeholder in `.env.example` |

> [!CAUTION]
> **Production Guardrail**: If `NODE_ENV=production`, `AUTH_MODE=dev` is strictly rejected at application startup by `backend/src/config/env.validation.ts` to ensure fail-closed security.

---

## 3. Database Migrations Workflow

Prisma migrations serve as the single source of truth for the database schema:

```bash
# Generate Prisma Client after schema changes
npm run prisma:generate

# Create and apply new migrations in development
npm run prisma:migrate

# Apply committed migrations in production or CI
npm run prisma:deploy

# Inspect database visually with Prisma Studio
npm run prisma:studio
```

### Migration History
1. `20261029124338_init`: Creates initial 3NF relational schema (profiles, preferences, timer modes, timer sessions, study sessions, categories, labels, rooms, members, invites, messages, room study sessions, participants).
2. `20261029124347_constraints_and_rls`:
   - Adds partial unique index `idx_timer_sessions_one_active` (one active timer per user).
   - Adds partial unique index `idx_room_study_sessions_one_active` (one active room timer).
   - Adds case-insensitive unique index `idx_profiles_username_lower`.
   - Adds check constraints for durations, volumes, and participant counts.
   - Enables Row Level Security (RLS) on all tables and creates Supabase RLS policies.

---

## 4. Connecting to Supabase in Production

When ready to connect to a live Supabase project:

1. Obtain your Supabase PostgreSQL connection string from the Supabase Dashboard:
   - For migrations: Direct connection `postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres`
   - For runtime: Transaction pooler `postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true`
2. Update `.env`:
   ```env
   NODE_ENV=production
   AUTH_MODE=supabase
   SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co
   SUPABASE_JWT_SECRET=[YOUR-PROJECT-JWT-SECRET]
   DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres
   ```
3. Deploy migrations:
   ```bash
   npm run prisma:deploy
   ```
4. Build and start:
   ```bash
   npm run build
   npm run start:prod
   ```

---

## 5. Automated Testing

All tests run against the local test database without requiring a live Supabase connection:

```bash
# Run all unit and integration test suites sequentially
npm test

# Run tests with coverage report
npm run test:cov

# Run specific test file
npx jest --runInBand test/timer-state-machine.spec.ts
```

### Test Coverage Highlights
- `test/auth.spec.ts`: Rejection of unauthenticated/tampered requests, identity derivation from JWT `sub`.
- `test/timer-state-machine.spec.ts`: START, PAUSE, RESUME, COMPLETE, authoritative calculations, and idempotent completion without duplicate credits.
- `test/organization.spec.ts`: Cross-user category and label isolation, parent category verification.
- `test/rooms-and-invitations.spec.ts`: Public room capacity, private room access denial, cryptographic token generation (SHA-256 hash storage), usage limits, and revocation.
- `test/chat.spec.ts`: Membership verification, author-only edits, soft deletion.
- `test/collaboration-and-participants.spec.ts`: Shared timer lifecycle, independent participant join/leave calculations, partial credit for late joiners.
- `test/analytics.spec.ts`: Daily/weekly summaries, category and label breakdowns without double-counting.

---

## 6. Architecture & Documentation

For in-depth architectural specifications, see the `docs/` folder:
- [architecture.md](docs/architecture.md) — System architecture, module boundaries, WebSocket strategy.
- [database-design.md](docs/database-design.md) — ER diagrams, schema definitions, constraints, indexes.
- [api-design.md](docs/api-design.md) — REST endpoint specifications, request/response formats.
- [security.md](docs/security.md) — Threat model, cryptographic invites, authorization, RLS policies.
- [timer-state-machine.md](docs/timer-state-machine.md) — Mathematical formulas for authoritative time tracking.
- [implementation-status.md](docs/implementation-status.md) — Feature status and test matrix.
