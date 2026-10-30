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

---

## 2. Local Development Authentication & API Testing

Protected endpoints (e.g. `/api/v1/timer-modes`, `/api/v1/users/me`, `/api/v1/rooms`) require an HTTP `Authorization: Bearer <token>` header.

### 2.1 Generating a Development Token
To test endpoints locally in development mode (`AUTH_MODE=dev`), generate a valid test JWT using the local CLI helper:
```bash
npm run dev:token
```
You can optionally pass custom user details:
```bash
npm run dev:token -- "<uuid>" "user@example.com" "custom_username"
```
The helper outputs the token without exposing the private signing secret.

### 2.2 Using Development Tokens in Swagger UI
1. Start the backend: `npm run start:dev`.
2. Open Swagger UI in your browser: [http://localhost:3000/api/docs](http://localhost:3000/api/docs).
3. Click the green **Authorize** button at the top right of the page.
4. Paste the generated token into the `Value` field (without the `Bearer ` prefix) and click **Authorize**.
5. All protected endpoints (including `GET /api/v1/timer-modes`) can now be executed directly from Swagger.

### 2.3 Using Development Tokens with curl / HTTP Clients
```bash
TOKEN=$(npm run --silent dev:token | sed -n '/^eyJ/p')
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/timer-modes
```

---

## 3. Environment Variables Reference

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

## 4. Database Migrations Workflow

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

## 5. Connecting to Supabase in Production

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

## 6. Automated Testing & Database Safety

The test suite strictly separates safe, offline unit tests from isolated database integration tests:

### 6.1 Unit Tests (Safe Anywhere, Zero Database Connections)
```bash
# Run unit tests: auth guards, token validation, and safety isolation guards
npm test
# or
npm run test:unit
```
These tests mock database dependencies and run completely in-memory without accessing, connecting to, or modifying any PostgreSQL database. They include 36 automated unit and adversarial tests covering:
- Authentication guard and token validation.
- Rejection of remote Supabase and cloud URLs.
- Rejection of spoofed hostnames containing `localhost` or `127.0.0.1` as substrings.
- Rejection of development and production databases lacking the `_test` suffix.
- Verification that pre-connection safety guards abort before any Prisma connection is made.

### 6.2 Integration Tests (Requires Isolated Local Test Database)
Integration tests require a dedicated, isolated test database whose name **strictly ends with `_test`** on an approved local host.

1. **Create the dedicated test database** (once):
   ```bash
   # Via local Docker container
   docker exec studysync-postgres psql -U postgres -c 'CREATE DATABASE studysync_test;'
   # Or via local psql
   createdb studysync_test
   ```

2. **Deploy schema migrations to the test database**:
   ```bash
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/studysync_test?schema=public" npx prisma migrate deploy
   ```

3. **Run integration tests**:
   ```bash
   TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/studysync_test?schema=public" npm run test:integration
   ```

> [!CAUTION]
> **Database Safety Invariants**:
> 1. **Explicit Opt-In Required**: `TEST_DATABASE_URL` is mandatory. The test harness **never** falls back to `DATABASE_URL`. If `TEST_DATABASE_URL` is missing, integration tests fail closed immediately.
> 2. **Strict Host Parsing**: Hostnames are parsed using WHATWG `URL` and validated against exact approved local hosts (`localhost`, `127.0.0.1`, `[::1]`). Substring checks are forbidden. Docker hostname `postgres` is only permitted when `TEST_ALLOW_DOCKER_HOST=true` is explicitly set.
> 3. **Database Name Policy**: The database name in `TEST_DATABASE_URL` must end in `_test`. Ordinary development databases (e.g. `studysync`, `postgres`) are rejected, even on localhost.
> 4. **Pre-Connection & Runtime Verification**: `createTestApp()` validates the URL before initializing the Nest application or Prisma client. `cleanDatabase()` performs an active `SELECT current_database()` query to ensure the connected database name ends with `_test` before executing any table deletes.
> 5. **Credential Protection**: Connection passwords and raw database URLs are never printed in test output, error messages, or logs.

---

## 6. Architecture & Documentation

For in-depth architectural specifications, see the `docs/` folder:
- [architecture.md](docs/architecture.md) — System architecture, module boundaries, WebSocket strategy.
- [database-design.md](docs/database-design.md) — ER diagrams, schema definitions, constraints, indexes.
- [api-design.md](docs/api-design.md) — REST endpoint specifications, request/response formats.
- [security.md](docs/security.md) — Threat model, cryptographic invites, authorization, RLS policies.
- [timer-state-machine.md](docs/timer-state-machine.md) — Mathematical formulas for authoritative time tracking.
- [implementation-status.md](docs/implementation-status.md) — Feature status and test matrix.
