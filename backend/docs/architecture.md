# StudySync Backend Architecture

## 1. System Overview

StudySync is a collaborative study productivity platform combining personal Pomodoro and deep work time tracking with real-time collaborative study rooms.

The backend is built as a **modular monolith** using **NestJS** and **TypeScript** (strict mode), backed by **PostgreSQL** (hosted via Supabase in production or containerized PostgreSQL locally) and accessed via **Prisma ORM**.

```
                           +--------------------------------------+
                           |           Client / Browser           |
                           +------------------+-------------------+
                                              |
                          HTTP REST (v1)      |     WebSockets (WSS)
                          Authorization:      |     Handshake JWT
                          Bearer <JWT>        |
                                              v
+-----------------------------------------------------------------------------------+
| NestJS Application Backend (Port 3000 /api/v1)                                   |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  | Global Middleware, Interceptors & Filters                                   |  |
|  | - Sensitive Data Redacting Logger                                           |  |
|  | - ValidationPipe (whitelist, forbidNonWhitelisted, transform)               |  |
|  | - HttpExceptionFilter (RFC 7807 compatible error envelope)                  |  |
|  +-----------------------------------------------------------------------------+  |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  | Core & Infrastructure Modules                                               |  |
|  | - ConfigModule (Joi/class-validator environment validation)                 |  |
|  | - PrismaModule (PrismaClient lifecycle & connection management)             |  |
|  | - AuthModule (Supabase JWT verification, dev token support, CurrentUser)    |  |
|  +-----------------------------------------------------------------------------+  |
|                                                                                   |
|  +-----------------------------------+   +------------------------------------+   |
|  | Personal Study Domain             |   | Collaborative Domain               |   |
|  | - Users & Preferences Module      |   | - Rooms & Membership Module        |   |
|  | - Timer Modes Module              |   | - Invitations Module (crypto-hash) |   |
|  | - Personal Timers Module (state)  |   | - Chat Module (cursor pagination)  |   |
|  | - Study Sessions Module (history) |   | - Room Study Sessions Module       |   |
|  | - Categories & Labels Module      |   | - Realtime Gateway (Socket.IO/ws)  |   |
|  | - Analytics Module                |   +------------------------------------+   |
|  +-----------------------------------+                                            |
+-----------------------------------------------------------------------------------+
                                              |
                                              v
+-----------------------------------------------------------------------------------+
| PostgreSQL Database (Local Docker / Supabase PostgreSQL)                          |
| - Profiles & Preferences                                                          |
| - Timer Modes, Active Sessions, History Records                                   |
| - Categories & Labels (Composite FK & User Ownership)                             |
| - Rooms, Memberships, Invite Hashes, Messages                                     |
| - Room Study Sessions & Participant Credit Tracking                               |
+-----------------------------------------------------------------------------------+
```

---

## 2. Module Boundaries and Dependencies

The application strictly enforces clear separation between transport (controllers), business rules (services), and data persistence (Prisma service / repositories).

### Dependency Graph

```
AppModule
 ├── ConfigModule (global)
 ├── PrismaModule (global)
 ├── AuthModule (global / guards & decorators)
 ├── HealthModule
 ├── UsersModule
 ├── PreferencesModule
 ├── TimerModesModule
 ├── CategoriesModule
 ├── LabelsModule
 ├── TimersModule (Personal Timers -> StudySessionsModule)
 ├── StudySessionsModule (Personal Study History)
 ├── RoomsModule (Room management & membership)
 ├── InvitationsModule (Room token invites -> RoomsModule)
 ├── ChatModule (Persistent messaging -> RoomsModule)
 ├── CollaborationModule (Room timers & participant tracking -> RoomsModule, StudySessionsModule)
 └── AnalyticsModule (Aggregates historical study records)
```

### Module Responsibilities

1. **`AuthModule`**:
   - Validates incoming Supabase Bearer JWT tokens.
   - Derives authenticated identity (`userId`, `email`).
   - Supports symmetric dev tokens for local testing without requiring external cloud access.
   - Automatically synchronizes authenticated identities with the internal `profiles` table.

2. **`UsersModule` & `PreferencesModule`**:
   - Manages user profiles (username, displayName, avatarUrl, bio).
   - Manages user interface preferences (theme, timer face, sound volume, auto-start options, ambient presets).

3. **`TimerModesModule`**:
   - Manages reusable Pomodoro / Deep Work timer configurations (focus duration, short break duration, long break duration, interval).
   - Enforces user ownership or exposes global system defaults.

4. **`CategoriesModule` & `LabelsModule`**:
   - Manages organizational taxonomy for study sessions.
   - Enforces cross-user isolation: users cannot attach categories or labels owned by other users.
   - Enforces parent-child hierarchy: labels belonging to a category must share the same `userId`.

5. **`TimersModule`**:
   - Manages active personal timer executions (`timer_sessions`).
   - Server-authoritative state transitions (`START`, `PAUSE`, `RESUME`, `CANCEL`, `COMPLETE`).
   - Generates historical records upon completion/interruption via `StudySessionsService`.

6. **`StudySessionsModule`**:
   - Stores historical, immutable-style completed and interrupted study records (`study_sessions`).
   - Manages M:N relationships with categories and labels.
   - Provides filtering by date range, category, label, and completion status.

7. **`RoomsModule`**:
   - Manages study rooms (public/private, capacity, owner/moderator/member roles).
   - Enforces role-based permissions (`RoomRoleGuard`).

8. **`InvitationsModule`**:
   - Generates cryptographically secure random invitation tokens (`crypto.randomBytes(32)`).
   - Stores SHA-256 hashes of tokens in the database (raw token returned only once at creation).
   - Transactionally accepts invitations, verifies expiration and max uses, and adds members.

9. **`ChatModule`**:
   - Manages room-scoped persistent chat messages with cursor-based pagination.
   - Restricts message editing and soft-deletion to authorized authors and moderators.

10. **`CollaborationModule`**:
    - Manages room-level synchronized study timers (`room_study_sessions`).
    - Authoritative participant tracking (`room_study_session_participants`): tracks exact join and leave timestamps per participant so late-joiners receive accurate credit.
    - Bridges room timer events to WebSockets and commits individual study records to `study_sessions`.

11. **`AnalyticsModule`**:
    - Derives daily and weekly summaries, total duration, session counts, and category/label breakdowns from historical `study_sessions`.

---

## 3. Real-Time Collaboration Strategy

### Chosen Approach: Server-Authoritative NestJS WebSocket Gateway (Socket.IO)

We adopt a **server-authoritative WebSocket architecture** using `@nestjs/websockets` and `@nestjs/platform-socket.io`:

1. **Why Server-Authoritative WebSockets over direct client Supabase Realtime?**
   - **Authoritative Timer Invariants**: Shared timers cannot rely on client clocks. Room timers are stepped, paused, and completed on the server; the server calculates remaining duration and elapsed participant intervals.
   - **Transaction-Guarded Persistence**: Chat messages, join/leave events, and participant duration commits require server-side database transactions, permission checks, and business rules before broadcast.
   - **Decoupling from Supabase vendor lock-in**: The backend runs identically in local development, standard Docker deployments, and cloud environments without mandatory dependency on Supabase Realtime servers.

2. **Supabase Realtime Complementarity**:
   - In production, Supabase Realtime can optionally be enabled for direct read-only change data capture (CDC) on tables like `messages` if desired.
   - However, all collaborative mutations (starting room timers, recording participant leaves, posting messages) flow through the NestJS backend to preserve consistency and auditability.

3. **WebSocket Security**:
   - Handshake authentication requires an `Authorization: Bearer <jwt>` query parameter or auth header.
   - The connection handler extracts and verifies the Supabase JWT. Unauthenticated socket connections are immediately disconnected (`client.disconnect(true)`).
   - Room-scoped events (`join_room`, `leave_room`, `send_message`, `timer_action`) verify room membership before emitting or joining socket rooms.

---

## 4. Request Flow Architecture

```
[ Client Request ]
       |
       v
[ Express Engine ]
       |
       v
[ Logging Interceptor ]  --> Logs request method, URL, redacts headers & sensitive body fields
       |
       v
[ Global ValidationPipe ] --> Sanitizes input DTOs, rejects extra properties
       |
       v
[ SupabaseAuthGuard ]    --> Verifies Bearer JWT, populates req.user
       |
       v
[ RoomRoleGuard / Checks]--> Validates resource ownership or room role (OWNER/MODERATOR/MEMBER)
       |
       v
[ Controller ]           --> Maps HTTP parameters to typed DTOs
       |
       v
[ Service Layer ]        --> Executes business logic, state machines, and calculations
       |
       v
[ Prisma Client ]        --> Interacts with PostgreSQL using parameterized queries & transactions
       |
       v
[ Response Envelope / ExceptionFilter ] --> Returns normalized response or sanitized error
```
