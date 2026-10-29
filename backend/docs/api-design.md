# StudySync REST API Specification

## 1. Overview and Standards

All REST endpoints are exposed under `/api/v1` and document their contracts via OpenAPI / Swagger available at `/api/docs`.

### Authentication
- Protected endpoints require an HTTP header:
  ```http
  Authorization: Bearer <supabase_access_token>
  ```
- Unauthenticated requests to protected endpoints return `401 Unauthorized`.
- Forbidden operations (e.g. attempting to modify another user's records or insufficient room permissions) return `403 Forbidden`.

### Standard Response Envelope
Successful operations return typed JSON payloads.

Error responses conform to RFC 7807 problem details:
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Focus duration must be greater than 0 seconds",
  "timestamp": "2026-10-29T12:00:00.000Z",
  "path": "/api/v1/timer-modes"
}
```

### Cursor-Based and Offset Pagination
- **Chat messages**: Cursor-based using `before` message ID or ISO timestamp with `limit` (max 50, default 20) to ensure high-performance real-time scrollback.
- **Study sessions / History**: Paginated using `page` and `limit`, with date range filters `startDate` and `endDate`, and optional `categoryId` and `labelId`.

---

## 2. API Endpoint Groups

### 2.1 System and Health
- `GET /api/v1/health`
  - Response: `{ "status": "ok", "uptime": 123.45, "timestamp": "..." }`

### 2.2 Users & Preferences
- `GET /api/v1/users/me` — Retrieve the authenticated user's profile.
- `PATCH /api/v1/users/me` — Update user profile (`displayName`, `avatarUrl`, `bio`).
- `GET /api/v1/preferences` — Retrieve the user's UI/timer/audio preferences.
- `PATCH /api/v1/preferences` — Update user preferences (`theme`, `timerFace`, `ambientPreset`, `soundVolume`, `soundEnabled`, `autoStartBreaks`, `autoStartPomodoros`, `defaultTimerModeId`).

### 2.3 Timer Modes (Reusable Templates)
- `POST /api/v1/timer-modes` — Create a new custom timer mode.
- `GET /api/v1/timer-modes` — List all accessible timer modes (system presets + user custom).
- `GET /api/v1/timer-modes/:id` — Retrieve a specific timer mode.
- `PATCH /api/v1/timer-modes/:id` — Update a user-owned timer mode.
- `DELETE /api/v1/timer-modes/:id` — Archive/delete a user-owned timer mode.
- `POST /api/v1/timer-modes/:id/duplicate` — Duplicate an existing mode into a new custom mode.

### 2.4 Personal Timers (Active State Machine)
- `GET /api/v1/timers/active` — Retrieve current active personal timer state (for reconnection/refresh recovery).
- `POST /api/v1/timers/start` — Start a new personal timer session (`timerModeId`, `phase`, custom duration override).
- `POST /api/v1/timers/pause` — Pause the active timer. Computes and freezes remaining seconds.
- `POST /api/v1/timers/resume` — Resume a paused timer with a recalculated server expected end time.
- `POST /api/v1/timers/complete` — Authoritatively complete the active timer phase. Idempotent: creates a study record and advances phase.
- `POST /api/v1/timers/cancel` — Cancel the active timer.

### 2.5 Study Sessions (Historical Records) & Organization
- `GET /api/v1/study-sessions` — Query paginated study history with filters (`startDate`, `endDate`, `status`, `categoryId`, `labelId`).
- `GET /api/v1/study-sessions/:id` — Retrieve details of a specific historical study session.
- `POST /api/v1/study-sessions` — Manually log a completed study session.
- `PATCH /api/v1/study-sessions/:id` — Update session metadata (`title`, `notes`, linked categories and labels).
- `DELETE /api/v1/study-sessions/:id` — Delete a study session.

#### Categories & Labels
- `GET /api/v1/categories` — List the user's categories.
- `POST /api/v1/categories` — Create a new category (`name`, `color`, `icon`).
- `PATCH /api/v1/categories/:id` — Update a category.
- `DELETE /api/v1/categories/:id` — Archive a category.
- `GET /api/v1/labels` — List the user's labels (optionally filter by `categoryId`).
- `POST /api/v1/labels` — Create a label (`name`, `color`, optional `categoryId`).
- `PATCH /api/v1/labels/:id` — Update a label.
- `DELETE /api/v1/labels/:id` — Archive a label.

### 2.6 Analytics
- `GET /api/v1/analytics/summary` — Daily and weekly statistics: total focus time, sessions completed, interrupted count, average session duration.
- `GET /api/v1/analytics/categories` — Breakdown of study duration by category.
- `GET /api/v1/analytics/labels` — Breakdown of study duration by label.

### 2.7 Collaborative Rooms & Membership
- `POST /api/v1/rooms` — Create a study room (`name`, `description`, `isPrivate`, `maxParticipants`). Creator becomes `OWNER`.
- `GET /api/v1/rooms` — List public rooms and rooms where the user is an active member.
- `GET /api/v1/rooms/:id` — Get room details and member list.
- `PATCH /api/v1/rooms/:id` — Update room settings (requires `OWNER` or `MODERATOR`).
- `DELETE /api/v1/rooms/:id` — Delete a room (requires `OWNER`).
- `POST /api/v1/rooms/:id/join` — Join a public room (enforces room capacity).
- `POST /api/v1/rooms/:id/leave` — Leave a room.

#### Room Invitations
- `POST /api/v1/rooms/:id/invites` — Generate an invitation token (requires `OWNER` or `MODERATOR`). Supports `maxUses` and `expiresInHours`. Returns raw token once.
- `GET /api/v1/rooms/:id/invites` — List active invitations for a room.
- `DELETE /api/v1/rooms/:id/invites/:inviteId` — Revoke an invitation.
- `POST /api/v1/invites/accept` — Accept an invitation token (`{ "token": "..." }`) and join private room.

### 2.8 Room Chat
- `GET /api/v1/rooms/:id/messages` — Cursor-paginated message history (`before`, `limit`).
- `POST /api/v1/rooms/:id/messages` — Send a message (`content`).
- `PATCH /api/v1/rooms/:id/messages/:messageId` — Edit a message (author only).
- `DELETE /api/v1/rooms/:id/messages/:messageId` — Soft-delete a message (author or moderator/owner).

### 2.9 Room Collaborative Timers & Tracking
- `GET /api/v1/rooms/:id/timer` — Get active room timer and active participant list.
- `POST /api/v1/rooms/:id/timer/start` — Start a room timer (requires `OWNER` or `MODERATOR`).
- `POST /api/v1/rooms/:id/timer/pause` — Pause room timer.
- `POST /api/v1/rooms/:id/timer/resume` — Resume room timer.
- `POST /api/v1/rooms/:id/timer/complete` — Complete room timer and commit participant credits.
- `POST /api/v1/rooms/:id/timer/cancel` — Cancel room timer.
- `POST /api/v1/rooms/:id/timer/join` — Join room timer as active participant.
- `POST /api/v1/rooms/:id/timer/leave` — Leave room timer, calculating individual elapsed participation credit.
