# StudySync Database Design and Relational Specification

## 1. Relational Entities and Schema

The StudySync database schema is designed in Third Normal Form (3NF) with UUID primary keys, explicit foreign keys, composite uniqueness, and PostgreSQL constraints.

```
                              +-----------------------+
                              |       profiles        |
                              +-----------+-----------+
                                          | 1
                    +---------------------+---------------------+
                    | 1:1                 | 1:N                 | 1:N
                    v                     v                     v
          +-------------------+  +-----------------+   +------------------+
          | user_preferences  |  |   timer_modes   |   | session_categories
          +-------------------+  +--------+--------+   +--------+---------+
                                          | 1:N                 | 1:N
                                          |                     v
                                          |            +------------------+
                                          |            |  session_labels  |
                                          |            +--------+---------+
                                          v                     |
                                 +-----------------+            |
                                 | timer_sessions  |            |
                                 +--------+--------+            |
                                          | 1:N                 |
                                          v                     |
                                 +-----------------+            |
                                 | study_sessions  |<-----------+
                                 +----+-------+----+  (via join tables)
                                      |       |
            +-------------------------+       +------------------------+
            | 1:N                                                      | 1:N
            v                                                          v
+---------------------------+                              +------------------------+
| study_session_categories  |                              |  study_session_labels  |
+---------------------------+                              +------------------------+

                                 +-----------------+
                                 |      rooms      |
                                 +--------+--------+
                                          | 1
               +--------------------------+--------------------------+
               | 1:N                      | 1:N                      | 1:N
               v                          v                          v
     +-------------------+      +-------------------+      +-------------------+
     |   room_members    |      |   room_invites    |      |     messages      |
     +-------------------+      +-------------------+      +-------------------+
                                                                     |
                                                                     |
                                +-----------------------+            |
                                |  room_study_sessions  |            |
                                +-----------+-----------+            |
                                            | 1:N                    |
                                            v                        v
                            +--------------------------------+       |
                            | room_study_session_participants|       |
                            +---------------+----------------+       |
                                            | 1:1 (optional)         |
                                            v                        |
                                    study_sessions                   |
```

---

## 2. Entity Details

### 2.1 Identity and Personalization

#### `profiles`
- `id` (UUID, Primary Key) - Matches the Supabase Auth user ID (`sub`).
- `username` (VARCHAR(30), Unique, Case-insensitive).
- `display_name` (VARCHAR(100), Not Null).
- `avatar_url` (TEXT, Nullable).
- `bio` (VARCHAR(300), Nullable).
- `created_at` (TIMESTAMPTZ, Default `NOW()`).
- `updated_at` (TIMESTAMPTZ, Default `NOW()`).

#### `user_preferences`
- `id` (UUID, Primary Key).
- `user_id` (UUID, Unique, FK -> `profiles(id)` ON DELETE CASCADE).
- `theme` (VARCHAR(30), Default `'dark-glass'`).
- `timer_face` (VARCHAR(30), Default `'ring'`).
- `ambient_preset` (VARCHAR(50), Nullable, e.g., `'rain'`, `'lofi'`).
- `sound_volume` (REAL, Default 0.7, CHECK `sound_volume >= 0.0 AND sound_volume <= 1.0`).
- `sound_enabled` (BOOLEAN, Default `TRUE`).
- `auto_start_breaks` (BOOLEAN, Default `FALSE`).
- `auto_start_pomodoros` (BOOLEAN, Default `FALSE`).
- `default_timer_mode_id` (UUID, Nullable, FK -> `timer_modes(id)` ON DELETE SET NULL).
- `created_at` (TIMESTAMPTZ, Default `NOW()`).
- `updated_at` (TIMESTAMPTZ, Default `NOW()`).

---

### 2.2 Reusable Timer Modes & Active Executions

#### `timer_modes`
- `id` (UUID, Primary Key).
- `user_id` (UUID, Nullable, FK -> `profiles(id)` ON DELETE CASCADE). Null indicates a global system template.
- `name` (VARCHAR(60), Not Null).
- `description` (VARCHAR(255), Nullable).
- `focus_duration` (INTEGER, Not Null, CHECK `focus_duration > 0` - in seconds).
- `short_break_duration` (INTEGER, Not Null, CHECK `short_break_duration > 0` - in seconds).
- `long_break_duration` (INTEGER, Not Null, CHECK `long_break_duration > 0` - in seconds).
- `long_break_interval` (INTEGER, Default 4, CHECK `long_break_interval >= 1`).
- `is_archived` (BOOLEAN, Default `FALSE`).
- `created_at` (TIMESTAMPTZ, Default `NOW()`).
- `updated_at` (TIMESTAMPTZ, Default `NOW()`).

#### `timer_sessions`
Represents an active or paused timer execution.
- `id` (UUID, Primary Key).
- `user_id` (UUID, Not Null, FK -> `profiles(id)` ON DELETE CASCADE).
- `timer_mode_id` (UUID, Nullable, FK -> `timer_modes(id)` ON DELETE SET NULL).
- `phase` (ENUM `'FOCUS'`, `'SHORT_BREAK'`, `'LONG_BREAK'`).
- `status` (ENUM `'RUNNING'`, `'PAUSED'`, `'COMPLETED'`, `'CANCELLED'`).
- `target_duration` (INTEGER, Not Null, CHECK `target_duration > 0`).
- `remaining_seconds` (INTEGER, Not Null, CHECK `remaining_seconds >= 0`).
- `started_at` (TIMESTAMPTZ, Not Null).
- `expected_end_time` (TIMESTAMPTZ, Nullable). Non-null when `status = 'RUNNING'`.
- `paused_at` (TIMESTAMPTZ, Nullable). Non-null when `status = 'PAUSED'`.
- `cycle_count` (INTEGER, Default 0).
- `total_focus_seconds` (INTEGER, Default 0).
- `created_at` (TIMESTAMPTZ, Default `NOW()`).
- `updated_at` (TIMESTAMPTZ, Default `NOW()`).
- **Partial Unique Index**: Only one active session per user:
  `CREATE UNIQUE INDEX idx_timer_sessions_one_active ON timer_sessions (user_id) WHERE status IN ('RUNNING', 'PAUSED');`

---

### 2.3 Historical Study Records and Organization

#### `study_sessions`
Persistent, immutable-style record of accredited study time.
- `id` (UUID, Primary Key).
- `user_id` (UUID, Not Null, FK -> `profiles(id)` ON DELETE CASCADE).
- `timer_session_id` (UUID, Nullable, FK -> `timer_sessions(id)` ON DELETE SET NULL).
- `room_study_session_id` (UUID, Nullable, FK -> `room_study_sessions(id)` ON DELETE SET NULL).
- `title` (VARCHAR(120), Nullable).
- `phase` (ENUM `'FOCUS'`, `'SHORT_BREAK'`, `'LONG_BREAK'`).
- `status` (ENUM `'COMPLETED'`, `'INTERRUPTED'`, `'CANCELLED'`).
- `target_duration` (INTEGER, Not Null, CHECK `target_duration >= 0`).
- `actual_duration` (INTEGER, Not Null, CHECK `actual_duration >= 0`).
- `started_at` (TIMESTAMPTZ, Not Null).
- `ended_at` (TIMESTAMPTZ, Not Null, CHECK `ended_at >= started_at`).
- `notes` (TEXT, Nullable).
- `created_at` (TIMESTAMPTZ, Default `NOW()`).
- `updated_at` (TIMESTAMPTZ, Default `NOW()`).

#### `session_categories`
- `id` (UUID, Primary Key).
- `user_id` (UUID, Not Null, FK -> `profiles(id)` ON DELETE CASCADE).
- `name` (VARCHAR(50), Not Null).
- `color` (VARCHAR(20), Not Null, Default `'#6366F1'`).
- `icon` (VARCHAR(30), Nullable).
- `is_archived` (BOOLEAN, Default `FALSE`).
- `created_at` (TIMESTAMPTZ, Default `NOW()`).
- `updated_at` (TIMESTAMPTZ, Default `NOW()`).
- **Constraint**: `UNIQUE (user_id, name)`.

#### `session_labels`
- `id` (UUID, Primary Key).
- `user_id` (UUID, Not Null, FK -> `profiles(id)` ON DELETE CASCADE).
- `category_id` (UUID, Nullable, FK -> `session_categories(id)` ON DELETE SET NULL).
- `name` (VARCHAR(50), Not Null).
- `color` (VARCHAR(20), Nullable).
- `is_archived` (BOOLEAN, Default `FALSE`).
- `created_at` (TIMESTAMPTZ, Default `NOW()`).
- `updated_at` (TIMESTAMPTZ, Default `NOW()`).
- **Constraint**: `UNIQUE (user_id, name)`.

#### `study_session_categories`
- `study_session_id` (UUID, FK -> `study_sessions(id)` ON DELETE CASCADE).
- `category_id` (UUID, FK -> `session_categories(id)` ON DELETE CASCADE).
- **Primary Key**: `(study_session_id, category_id)`.

#### `study_session_labels`
- `study_session_id` (UUID, FK -> `study_sessions(id)` ON DELETE CASCADE).
- `label_id` (UUID, FK -> `session_labels(id)` ON DELETE CASCADE).
- **Primary Key**: `(study_session_id, label_id)`.

---

### 2.4 Collaborative Rooms, Invitations, and Chat

#### `rooms`
- `id` (UUID, Primary Key).
- `name` (VARCHAR(80), Not Null).
- `description` (VARCHAR(300), Nullable).
- `slug` (VARCHAR(90), Unique, Not Null).
- `is_private` (BOOLEAN, Default `FALSE`).
- `max_participants` (INTEGER, Default 25, CHECK `max_participants > 0`).
- `owner_id` (UUID, Not Null, FK -> `profiles(id)` ON DELETE RESTRICT).
- `created_at` (TIMESTAMPTZ, Default `NOW()`).
- `updated_at` (TIMESTAMPTZ, Default `NOW()`).

#### `room_members`
- `id` (UUID, Primary Key).
- `room_id` (UUID, Not Null, FK -> `rooms(id)` ON DELETE CASCADE).
- `user_id` (UUID, Not Null, FK -> `profiles(id)` ON DELETE CASCADE).
- `role` (ENUM `'OWNER'`, `'MODERATOR'`, `'MEMBER'`).
- `joined_at` (TIMESTAMPTZ, Default `NOW()`).
- **Constraint**: `UNIQUE (room_id, user_id)`.

#### `room_invites`
- `id` (UUID, Primary Key).
- `room_id` (UUID, Not Null, FK -> `rooms(id)` ON DELETE CASCADE).
- `inviter_id` (UUID, Not Null, FK -> `profiles(id)` ON DELETE CASCADE).
- `token_hash` (CHAR(64), Unique, Not Null). Stores SHA-256 hex digest of random 32-byte token.
- `max_uses` (INTEGER, Nullable, CHECK `max_uses IS NULL OR max_uses > 0`).
- `uses_count` (INTEGER, Default 0, CHECK `uses_count >= 0`).
- `expires_at` (TIMESTAMPTZ, Nullable).
- `is_revoked` (BOOLEAN, Default `FALSE`).
- `created_at` (TIMESTAMPTZ, Default `NOW()`).

#### `messages`
- `id` (UUID, Primary Key).
- `room_id` (UUID, Not Null, FK -> `rooms(id)` ON DELETE CASCADE).
- `sender_id` (UUID, Not Null, FK -> `profiles(id)` ON DELETE CASCADE).
- `content` (VARCHAR(2000), Not Null).
- `is_edited` (BOOLEAN, Default `FALSE`).
- `deleted_at` (TIMESTAMPTZ, Nullable). Soft deletion indicator.
- `created_at` (TIMESTAMPTZ, Default `NOW()`).
- `updated_at` (TIMESTAMPTZ, Default `NOW()`).

---

### 2.5 Collaborative Study Sessions and Participant Accounting

#### `room_study_sessions`
- `id` (UUID, Primary Key).
- `room_id` (UUID, Not Null, FK -> `rooms(id)` ON DELETE CASCADE).
- `timer_mode_id` (UUID, Nullable, FK -> `timer_modes(id)` ON DELETE SET NULL).
- `phase` (ENUM `'FOCUS'`, `'SHORT_BREAK'`, `'LONG_BREAK'`).
- `status` (ENUM `'RUNNING'`, `'PAUSED'`, `'COMPLETED'`, `'CANCELLED'`).
- `target_duration` (INTEGER, Not Null, CHECK `target_duration > 0`).
- `remaining_seconds` (INTEGER, Not Null, CHECK `remaining_seconds >= 0`).
- `started_at` (TIMESTAMPTZ, Not Null).
- `expected_end_time` (TIMESTAMPTZ, Nullable).
- `paused_at` (TIMESTAMPTZ, Nullable).
- `created_at` (TIMESTAMPTZ, Default `NOW()`).
- `updated_at` (TIMESTAMPTZ, Default `NOW()`).

#### `room_study_session_participants`
- `id` (UUID, Primary Key).
- `room_study_session_id` (UUID, Not Null, FK -> `room_study_sessions(id)` ON DELETE CASCADE).
- `user_id` (UUID, Not Null, FK -> `profiles(id)` ON DELETE CASCADE).
- `joined_at` (TIMESTAMPTZ, Not Null, Default `NOW()`).
- `left_at` (TIMESTAMPTZ, Nullable).
- `credited_seconds` (INTEGER, Default 0, CHECK `credited_seconds >= 0`).
- `personal_study_session_id` (UUID, Nullable, FK -> `study_sessions(id)` ON DELETE SET NULL).
- `created_at` (TIMESTAMPTZ, Default `NOW()`).
- `updated_at` (TIMESTAMPTZ, Default `NOW()`).
- **Constraint**: `UNIQUE (room_study_session_id, user_id)`.

---

## 3. Database Indexes

1. **Profiles**:
   - `CREATE UNIQUE INDEX idx_profiles_username_lower ON profiles (LOWER(username));`
2. **Study Sessions & Analytics**:
   - `CREATE INDEX idx_study_sessions_user_date ON study_sessions (user_id, started_at DESC);`
   - `CREATE INDEX idx_study_sessions_user_status ON study_sessions (user_id, status);`
3. **Chat & History**:
   - `CREATE INDEX idx_messages_room_created ON messages (room_id, created_at DESC) WHERE deleted_at IS NULL;`
4. **Room Memberships**:
   - `CREATE INDEX idx_room_members_user ON room_members (user_id);`
   - `CREATE INDEX idx_room_members_room ON room_members (room_id);`
5. **Room Invites**:
   - `CREATE INDEX idx_room_invites_lookup ON room_invites (token_hash) WHERE is_revoked = FALSE;`
6. **Active Room Sessions**:
   - `CREATE INDEX idx_room_study_sessions_active ON room_study_sessions (room_id) WHERE status IN ('RUNNING', 'PAUSED');`

---

## 4. Supabase Deployment & RLS Migration Strategy

### 4.1 Deployment Sequence
1. **Local Development (No Live Supabase Required)**:
   - Run Prisma migrations (`prisma migrate dev` or `prisma db push`) against local containerized PostgreSQL.
2. **Connecting to Supabase**:
   - Set `DATABASE_URL` in backend `.env` to the Supabase connection pooler (`postgres://...pooler.supabase.com:6543/postgres?pgbouncer=true`) or direct URL for migrations (`postgres://...supabase.com:5432/postgres`).
   - Run `prisma migrate deploy` to apply all versioned Git migrations.
3. **RLS Migration Ownership**:
   - Supabase RLS policies are versioned inside Prisma SQL migrations under `backend/prisma/migrations/`.
   - The NestJS backend uses a database user with appropriate privileges or runs with service role in backend-mediated queries, while Direct Client Supabase access is protected by RLS.
