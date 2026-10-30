# StudySync — Authoritative Frontend API Reference

> **Audience**: Frontend Engineers, API Integrators  
> **Status**: Verified Against Implementation (`backend/src/`)  
> **Base Path**: `/api/v1`  
> **OpenAPI Schema**: `http://localhost:3000/api/docs-json`  
> **Interactive Swagger UI**: `http://localhost:3000/api/docs`

---

## Global Standards

### Base URL & Headers
- **Local API Base**: `http://localhost:3000/api/v1`
- **Content-Type**: `application/json` (for all requests with a body)
- **Authorization**: `Authorization: Bearer <token>`
  - Accepts Supabase JWT access token (`AUTH_MODE=supabase` or `dev`) or local development token (`AUTH_MODE=dev`).
  - Whitespace-normalized; malformed headers return `401 Unauthorized`.

### Standard RFC 7807 Error Structure
All HTTP errors returned by the backend pass through `HttpExceptionFilter` and conform to RFC 7807:
```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Missing Authorization header",
  "timestamp": "2026-10-29T16:49:29.337Z",
  "path": "/api/v1/timer-modes"
}
```
Validation errors (`400 Bad Request`) format `message` as an array of constraint failure strings:
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": [
    "name should not be empty",
    "focusDuration must not be less than 60"
  ],
  "timestamp": "2026-10-29T17:00:00.000Z",
  "path": "/api/v1/timer-modes"
}
```

---

## Table of Contents
1. [Health](#1-health)
2. [Users & Profile](#2-users--profile)
3. [User Preferences](#3-user-preferences)
4. [Timer Modes](#4-timer-modes)
5. [Personal Timers (Authoritative State Machine)](#5-personal-timers)
6. [Study Sessions (Credited Records)](#6-study-sessions)
7. [Categories (Taxonomy)](#7-categories)
8. [Labels (Sub-Taxonomy)](#8-labels)
9. [Analytics & Insights](#9-analytics--insights)
10. [Study Rooms](#10-study-rooms)
11. [Room Invitations (Cryptographic Tokens)](#11-room-invitations)
12. [Collaboration & Room Timers](#12-collaboration--room-timers)
13. [Room Chat (Persistent Messaging)](#13-room-chat)

---

## 1. Health

### `GET /api/v1/health`
- **Handler**: `HealthController.check` ([`backend/src/health/health.controller.ts`](file:///home/asta/Projects/studysync/backend/src/health/health.controller.ts))
- **Auth Required**: No (Public)
- **Status**: 100% Fully Implemented
- **Description**: Returns backend uptime, service health status, and server timestamp.
- **Request Parameters / Body**: None
- **Response 200 OK**:
  ```json
  {
    "status": "ok",
    "uptime": 234.56,
    "timestamp": "2026-10-29T17:15:00.000Z",
    "service": "studysync-backend"
  }
  ```

---

## 2. Users & Profile

### `GET /api/v1/users/me`
- **Handler**: `UsersController.getMe` ([`backend/src/users/users.controller.ts`](file:///home/asta/Projects/studysync/backend/src/users/users.controller.ts))
- **Auth Required**: Yes (`Bearer <token>`)
- **Status**: 100% Fully Implemented
- **Description**: Retrieves the profile and attached preferences for the current authenticated user. If first login, the user profile and default preferences are automatically provisioned.
- **Response 200 OK**:
  ```json
  {
    "id": "11111111-1111-4111-8111-111111111111",
    "username": "soham_dev",
    "displayName": "Soham Rane",
    "avatarUrl": "https://example.com/avatar.png",
    "bio": "Deep work master",
    "createdAt": "2026-10-29T10:00:00.000Z",
    "updatedAt": "2026-10-29T10:00:00.000Z",
    "preferences": {
      "id": "22222222-2222-4222-8222-222222222222",
      "userId": "11111111-1111-4111-8111-111111111111",
      "theme": "dark-glass",
      "timerFace": "ring",
      "soundVolume": 0.7,
      "soundEnabled": true,
      "autoStartBreaks": false,
      "autoStartPomodoros": false
    }
  }
  ```
- **Error Responses**:
  - `401 Unauthorized`: Token missing or expired.
  - `404 Not Found`: Profile does not exist (unexpected due to auto-provisioning).

---

### `PATCH /api/v1/users/me`
- **Handler**: `UsersController.updateMe`
- **Auth Required**: Yes (`Bearer <token>`)
- **Status**: 100% Fully Implemented
- **Request Body** (`UpdateProfileDto`):
  | Field | Type | Optional | Validation | Description |
  |---|---|---|---|---|
  | `displayName` | `string` | Yes | Max 100 chars | Public display name |
  | `avatarUrl` | `string` | Yes | Valid string | Avatar image URL |
  | `bio` | `string` | Yes | Max 300 chars | User biography |
- **Example Request Body**:
  ```json
  {
    "displayName": "Soham Rane",
    "avatarUrl": "https://images.example.com/avatar.png",
    "bio": "Building StudySync and mastering deep work."
  }
  ```
- **Response 200 OK**: Updated `Profile` record.

---

## 3. User Preferences

### `GET /api/v1/preferences`
- **Handler**: `PreferencesController.getPreferences` ([`backend/src/preferences/preferences.controller.ts`](file:///home/asta/Projects/studysync/backend/src/preferences/preferences.controller.ts))
- **Auth Required**: Yes (`Bearer <token>`)
- **Status**: 100% Fully Implemented
- **Description**: Returns user preferences, including the full `defaultTimerMode` relation if one is selected.
- **Response 200 OK**:
  ```json
  {
    "id": "pref-uuid",
    "userId": "user-uuid",
    "theme": "dark-glass",
    "timerFace": "ring",
    "ambientPreset": "rain",
    "soundVolume": 0.8,
    "soundEnabled": true,
    "autoStartBreaks": false,
    "autoStartPomodoros": false,
    "defaultTimerModeId": "mode-uuid",
    "createdAt": "2026-10-29T10:00:00.000Z",
    "updatedAt": "2026-10-29T10:00:00.000Z",
    "defaultTimerMode": {
      "id": "mode-uuid",
      "name": "Standard Pomodoro",
      "focusDuration": 1500,
      "shortBreakDuration": 300,
      "longBreakDuration": 900,
      "longBreakInterval": 4
    }
  }
  ```

---

### `PATCH /api/v1/preferences`
- **Handler**: `PreferencesController.updatePreferences`
- **Auth Required**: Yes (`Bearer <token>`)
- **Status**: 100% Fully Implemented
- **Request Body** (`UpdatePreferencesDto`):
  | Field | Type | Optional | Validation | Description |
  |---|---|---|---|---|
  | `theme` | `string` | Yes | String | e.g. `'dark-glass'`, `'light-minimal'`, `'nord'` |
  | `timerFace` | `string` | Yes | String | e.g. `'ring'`, `'digital'`, `'minimal'`, `'flip'` |
  | `ambientPreset` | `string` | Yes | String | Ambient sound identifier (e.g. `'rain'`, `'waves'`) |
  | `soundVolume` | `number` | Yes | Float `0` to `1.0` | Audio volume |
  | `soundEnabled` | `boolean` | Yes | Boolean | Whether sound alerts play |
  | `autoStartBreaks` | `boolean` | Yes | Boolean | Automatically start break timers |
  | `autoStartPomodoros` | `boolean` | Yes | Boolean | Automatically start focus timers |
  | `defaultTimerModeId` | `string` | Yes | UUIDv4 | Must exist and be accessible to user |
- **Response 200 OK**: Updated `UserPreference` object.
- **Error Responses**:
  - `400 Bad Request`: `defaultTimerModeId` belongs to another user's private mode.
  - `404 Not Found`: `defaultTimerModeId` does not exist.

---

## 4. Timer Modes

### `GET /api/v1/timer-modes`
- **Handler**: `TimerModesController.findAll` ([`backend/src/timer-modes/timer-modes.controller.ts`](file:///home/asta/Projects/studysync/backend/src/timer-modes/timer-modes.controller.ts))
- **Auth Required**: Yes (`Bearer <token>`)
- **Status**: 100% Fully Implemented
- **Description**: Returns all accessible timer modes (global system templates where `userId: null`, plus custom modes owned by the authenticated user). Archived modes are excluded.
- **Sorting**: System templates first (`userId: null`), then user-created modes ordered by `createdAt: desc`.
- **Response 200 OK**:
  ```json
  [
    {
      "id": "e67e68a4-4744-4a82-a4a1-ab098049d984",
      "userId": null,
      "name": "Standard Pomodoro",
      "description": "Classic 25m focus with 5m short break and 15m long break",
      "focusDuration": 1500,
      "shortBreakDuration": 300,
      "longBreakDuration": 900,
      "longBreakInterval": 4,
      "isArchived": false,
      "createdAt": "2026-10-29T13:01:53.919Z",
      "updatedAt": "2026-10-29T13:01:53.919Z"
    },
    {
      "id": "08039b53-c262-43fb-989f-d951850aab2c",
      "userId": null,
      "name": "Deep Work 50/10",
      "description": "Intense 50m focus with 10m short break and 30m long break",
      "focusDuration": 3000,
      "shortBreakDuration": 600,
      "longBreakDuration": 1800,
      "longBreakInterval": 3,
      "isArchived": false,
      "createdAt": "2026-10-29T13:01:53.919Z",
      "updatedAt": "2026-10-29T13:01:53.919Z"
    },
    {
      "id": "92d21d28-095b-4f67-8261-e921a31fc19b",
      "userId": null,
      "name": "Quick Sprint 15/3",
      "description": "High-energy 15m sprint with 3m short break",
      "focusDuration": 900,
      "shortBreakDuration": 180,
      "longBreakDuration": 600,
      "longBreakInterval": 4,
      "isArchived": false,
      "createdAt": "2026-10-29T13:01:53.919Z",
      "updatedAt": "2026-10-29T13:01:53.919Z"
    }
  ]
  ```

---

### `POST /api/v1/timer-modes`
- **Handler**: `TimerModesController.create`
- **Auth Required**: Yes (`Bearer <token>`)
- **Status**: 100% Fully Implemented
- **Request Body** (`CreateTimerModeDto`):
  | Field | Type | Required | Validation | Description |
  |---|---|---|---|---|
  | `name` | `string` | **Yes** | Max 60 chars | Mode title |
  | `description` | `string` | No | Max 255 chars | Description |
  | `focusDuration` | `number` | **Yes** | Int, min 60 | Focus duration in seconds |
  | `shortBreakDuration` | `number` | **Yes** | Int, min 60 | Short break in seconds |
  | `longBreakDuration` | `number` | **Yes** | Int, min 60 | Long break in seconds |
  | `longBreakInterval` | `number` | No | Int, min 1, default 4 | Cycles before long break |
- **Response 201 Created**: Newly created `TimerMode` with `userId` bound to caller.

---

### `GET /api/v1/timer-modes/:id`
- **Handler**: `TimerModesController.findOne`
- **Path Params**: `id` (UUIDv4)
- **Auth Required**: Yes (`Bearer <token>`)
- **Status**: 100% Fully Implemented
- **Response 200 OK**: Specific `TimerMode` object.
- **Error Responses**:
  - `403 Forbidden`: Attempting to access another user's custom mode.
  - `404 Not Found`: Mode does not exist or is archived.

---

### `PATCH /api/v1/timer-modes/:id`
- **Handler**: `TimerModesController.update`
- **Path Params**: `id` (UUIDv4)
- **Auth Required**: Yes (`Bearer <token>`)
- **Status**: 100% Fully Implemented
- **Request Body** (`UpdateTimerModeDto`): Any field from `CreateTimerModeDto`.
- **Response 200 OK**: Updated `TimerMode`.
- **Error Responses**:
  - `403 Forbidden`: Attempting to modify a system template (`userId: null`) or another user's mode.
  - `404 Not Found`: Mode does not exist.

---

### `DELETE /api/v1/timer-modes/:id`
- **Handler**: `TimerModesController.remove`
- **Path Params**: `id` (UUIDv4)
- **Auth Required**: Yes (`Bearer <token>`)
- **Status**: 100% Fully Implemented
- **Description**: Soft-deletes the mode (`isArchived: true`) so historical session records remain linked.
- **Response 200 OK**: Updated mode with `isArchived: true`.
- **Error Responses**:
  - `403 Forbidden`: System templates (`userId: null`) cannot be archived.

---

### `POST /api/v1/timer-modes/:id/duplicate`
- **Handler**: `TimerModesController.duplicate`
- **Path Params**: `id` (UUIDv4)
- **Auth Required**: Yes (`Bearer <token>`)
- **Status**: 100% Fully Implemented
- **Description**: Copies an existing mode (system template or own mode) into a new custom mode named `"<name> (Copy)"` owned by caller.
- **Response 201 Created**: Cloned `TimerMode` record.

---

## 5. Personal Timers

StudySync enforces an **authoritative server-side state machine**. Browser countdowns are UI displays; the backend database is the single source of truth for duration and completion.

### `GET /api/v1/timers/active`
- **Handler**: `TimersController.getActive` ([`backend/src/timers/timers.controller.ts`](file:///home/asta/Projects/studysync/backend/src/timers/timers.controller.ts))
- **Auth Required**: Yes (`Bearer <token>`)
- **Status**: 100% Fully Implemented
- **Description**: **Crucial for page reload recovery**. Returns the currently running or paused timer, including the dynamically computed `authoritativeRemainingSeconds` and `isExpired`.
- **Response 200 OK (Active Session)**:
  ```json
  {
    "id": "timer-session-uuid",
    "userId": "user-uuid",
    "timerModeId": "mode-uuid",
    "phase": "FOCUS",
    "status": "RUNNING",
    "targetDuration": 1500,
    "remainingSeconds": 1500,
    "startedAt": "2026-10-29T17:00:00.000Z",
    "pausedAt": null,
    "expectedEndTime": "2026-10-29T17:25:00.000Z",
    "totalFocusSeconds": 0,
    "cycleCount": 0,
    "authoritativeRemainingSeconds": 1284,
    "isExpired": false,
    "timerMode": { ... }
  }
  ```
- **Response 200 OK (No Active Session)**: `null`

---

### `POST /api/v1/timers/start`
- **Handler**: `TimersController.start`
- **Auth Required**: Yes (`Bearer <token>`)
- **Status**: 100% Fully Implemented
- **Request Body** (`StartTimerDto`):
  | Field | Type | Optional | Validation | Description |
  |---|---|---|---|---|
  | `timerModeId` | `string` | Yes | UUIDv4 | Mode to initialize durations from |
  | `phase` | `string` | Yes | Enum: `'FOCUS'`, `'SHORT_BREAK'`, `'LONG_BREAK'` | Default `'FOCUS'` |
  | `durationOverride` | `number` | Yes | Int, min 60 | Custom duration in seconds |
- **Response 201 Created**: Running `TimerSession` object.
- **Error Responses**:
  - `409 Conflict`: User already has an active `RUNNING` or `PAUSED` timer. (Enforced at application layer and by partial unique index `idx_timer_sessions_one_active`).

---

### `POST /api/v1/timers/pause`
- **Handler**: `TimersController.pause`
- **Auth Required**: Yes (`Bearer <token>`)
- **Status**: 100% Fully Implemented
- **Description**: Captures exact remaining seconds based on `expectedEndTime - now`, sets `status: PAUSED`, and clears `expectedEndTime`.
- **Response 200 OK**:
  ```json
  {
    "id": "timer-session-uuid",
    "status": "PAUSED",
    "remainingSeconds": 945,
    "pausedAt": "2026-10-29T17:09:15.000Z",
    "expectedEndTime": null,
    "authoritativeRemainingSeconds": 945,
    "isExpired": false
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Timer is not in `RUNNING` state.
  - `404 Not Found`: No active timer found.

---

### `POST /api/v1/timers/resume`
- **Handler**: `TimersController.resume`
- **Auth Required**: Yes (`Bearer <token>`)
- **Status**: 100% Fully Implemented
- **Description**: Calculates a new `expectedEndTime = now + remainingSeconds`, clears `pausedAt`, and returns `status: RUNNING`.
- **Response 200 OK**: Resumed `TimerSession` with newly calculated `expectedEndTime`.
- **Error Responses**:
  - `400 Bad Request`: Timer is not in `PAUSED` state.
  - `404 Not Found`: No active timer found.

---

### `POST /api/v1/timers/complete`
- **Handler**: `TimersController.complete`
- **Auth Required**: Yes (`Bearer <token>`)
- **Status**: 100% Fully Implemented
- **Description**: Authoritatively completes the active timer, computes credited focus time, creates a permanent `StudySession` record, and returns the recommended `nextPhase`.
- **Idempotency**: If called multiple times (e.g. rapid button clicks), returns `{ idempotentReplay: true }` with the already committed study record rather than throwing or double-counting.
- **Request Body** (`CompleteTimerDto`):
  | Field | Type | Optional | Validation | Description |
  |---|---|---|---|---|
  | `title` | `string` | Yes | Max 120 chars | Title for study session record |
  | `notes` | `string` | Yes | String | Reflection or study notes |
  | `categoryIds` | `string[]` | Yes | Array of UUIDv4 | Categories to attach |
  | `labelIds` | `string[]` | Yes | Array of UUIDv4 | Labels to attach |
  | `advanceToNextPhase` | `boolean` | Yes | Boolean | Whether to suggest next phase |
- **Response 200 OK**:
  ```json
  {
    "timerSession": {
      "id": "timer-session-uuid",
      "status": "COMPLETED",
      "remainingSeconds": 0,
      "totalFocusSeconds": 1500,
      "cycleCount": 1
    },
    "studySession": {
      "id": "study-session-uuid",
      "title": "Algorithms Practice",
      "phase": "FOCUS",
      "status": "COMPLETED",
      "targetDuration": 1500,
      "actualDuration": 1500,
      "startedAt": "2026-10-29T17:00:00.000Z",
      "endedAt": "2026-10-29T17:25:00.000Z"
    },
    "creditedDuration": 1500,
    "nextPhase": "SHORT_BREAK",
    "idempotentReplay": false
  }
  ```

---

### `POST /api/v1/timers/cancel`
- **Handler**: `TimersController.cancel`
- **Auth Required**: Yes (`Bearer <token>`)
- **Status**: 100% Fully Implemented
- **Description**: Cancels the active timer. If the session was in `FOCUS` phase and elapsed time was **>= 60 seconds**, it automatically records an `INTERRUPTED` study session with partial focus credit.
- **Request Body** (`CancelTimerDto`):
  | Field | Type | Optional | Default | Description |
  |---|---|---|---|---|
  | `reason` | `string` | Yes | `null` | Reason for cancellation |
  | `savePartialRecord` | `boolean` | Yes | `true` | Set `false` to discard without saving partial record |
- **Response 200 OK**:
  ```json
  {
    "timerSession": { "id": "uuid", "status": "CANCELLED" },
    "interruptedStudyRecord": {
      "id": "study-uuid",
      "status": "INTERRUPTED",
      "actualDuration": 480
    },
    "elapsedSeconds": 480
  }
  ```

---

## 6. Study Sessions

### `POST /api/v1/study-sessions`
- **Handler**: `StudySessionsController.create` ([`backend/src/study-sessions/study-sessions.controller.ts`](file:///home/asta/Projects/studysync/backend/src/study-sessions/study-sessions.controller.ts))
- **Auth Required**: Yes (`Bearer <token>`)
- **Status**: 100% Fully Implemented
- **Description**: Manually logs a study session (e.g. offline studying).
- **Request Body** (`CreateStudySessionDto`):
  | Field | Type | Required | Description |
  |---|---|---|---|
  | `title` | `string` | No | Title of session |
  | `phase` | `string` | No | `'FOCUS'` (default), `'SHORT_BREAK'`, `'LONG_BREAK'` |
  | `status` | `string` | No | `'COMPLETED'` (default), `'INTERRUPTED'`, `'ABANDONED'` |
  | `targetDuration` | `number` | **Yes** | Planned duration in seconds |
  | `actualDuration` | `number` | **Yes** | Credited duration in seconds |
  | `startedAt` | `string` | **Yes** | ISO 8601 date string |
  | `endedAt` | `string` | **Yes** | ISO 8601 date string |
  | `notes` | `string` | No | Session notes |
  | `categoryIds` | `string[]` | No | Array of user-owned category UUIDs |
  | `labelIds` | `string[]` | No | Array of user-owned label UUIDs |
- **Response 201 Created**: Created `StudySession` with attached categories and labels.
- **Error Responses**:
  - `403 Forbidden`: If any `categoryIds` or `labelIds` belong to another user.

---

### `GET /api/v1/study-sessions`
- **Handler**: `StudySessionsController.findAll`
- **Auth Required**: Yes (`Bearer <token>`)
- **Status**: 100% Fully Implemented
- **Query Parameters** (`QueryStudySessionsDto`):
  | Param | Type | Optional | Description |
  |---|---|---|---|
  | `startDate` | `string` | Yes | Filter sessions starting on or after this ISO date |
  | `endDate` | `string` | Yes | Filter sessions ending on or before this ISO date |
  | `status` | `string` | Yes | Enum: `'COMPLETED'`, `'INTERRUPTED'`, `'ABANDONED'` |
  | `categoryId`| `string` | Yes | Filter sessions tagged with this category UUID |
  | `labelId` | `string` | Yes | Filter sessions tagged with this label UUID |
  | `page` | `number` | Yes | Default: `1`, Min: `1` |
  | `limit` | `number` | Yes | Default: `20`, Max: `100` |
- **Response 200 OK**:
  ```json
  {
    "data": [
      {
        "id": "session-uuid",
        "userId": "user-uuid",
        "title": "Calculus Problem Set",
        "phase": "FOCUS",
        "status": "COMPLETED",
        "targetDuration": 1500,
        "actualDuration": 1500,
        "startedAt": "2026-10-29T10:00:00.000Z",
        "endedAt": "2026-10-29T10:25:00.000Z",
        "notes": "Problems 1-8 completed",
        "categories": [{ "category": { "id": "cat-uuid", "name": "Mathematics", "color": "#6366F1" } }],
        "labels": [{ "label": { "id": "lbl-uuid", "name": "Calculus", "color": "#10B981" } }]
      }
    ],
    "meta": {
      "total": 42,
      "page": 1,
      "limit": 20,
      "totalPages": 3
    }
  }
  ```

---

### `GET /api/v1/study-sessions/:id`
- **Handler**: `StudySessionsController.findOne`
- **Auth Required**: Yes (`Bearer <token>`)
- **Response 200 OK**: `StudySession` with categories and labels.
- **Error Responses**:
  - `403 Forbidden`: Session belongs to another user.
  - `404 Not Found`: Session does not exist.

---

### `PATCH /api/v1/study-sessions/:id`
- **Handler**: `StudySessionsController.update`
- **Auth Required**: Yes (`Bearer <token>`)
- **Request Body** (`UpdateStudySessionDto`):
  | Field | Type | Optional | Description |
  |---|---|---|---|
  | `title` | `string` | Yes | Updated title |
  | `notes` | `string` | Yes | Updated notes |
  | `categoryIds` | `string[]` | Yes | Overwrites linked categories |
  | `labelIds` | `string[]` | Yes | Overwrites linked labels |
- **Response 200 OK**: Updated `StudySession`.

---

### `DELETE /api/v1/study-sessions/:id`
- **Handler**: `StudySessionsController.remove`
- **Auth Required**: Yes (`Bearer <token>`)
- **Response 200 OK**: Deleted record.

---

## 7. Categories

Categories group study sessions (e.g., "Computer Science", "Languages").

| Method | Path | Handler | Auth | Description |
|---|---|---|---|---|
| `POST` | `/api/v1/categories` | `create` | Bearer | Create category (`name`, `color` hex regex, `icon`) |
| `GET` | `/api/v1/categories` | `findAll` | Bearer | List active categories with child labels |
| `GET` | `/api/v1/categories/:id` | `findOne` | Bearer | Get category by UUID |
| `PATCH` | `/api/v1/categories/:id` | `update` | Bearer | Update category name, color, icon |
| `DELETE` | `/api/v1/categories/:id`| `remove` | Bearer | Soft delete (`isArchived: true`) |

- **Hex Color Validation**: `color` must match `^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$` (e.g. `#6366F1`). Default: `#6366F1`.
- **Name Uniqueness**: Case-insensitive unique check per user. Returns `409 Conflict` on duplicate names.

---

## 8. Labels

Labels provide fine-grained tags and can optionally link to a parent category.

| Method | Path | Handler | Auth | Description |
|---|---|---|---|---|
| `POST` | `/api/v1/labels` | `create` | Bearer | Create label (`name`, `color`, optional `categoryId`) |
| `GET` | `/api/v1/labels` | `findAll` | Bearer | List labels (supports optional `?categoryId=` query) |
| `GET` | `/api/v1/labels/:id` | `findOne` | Bearer | Get label by UUID |
| `PATCH` | `/api/v1/labels/:id` | `update` | Bearer | Update label name, color, categoryId |
| `DELETE` | `/api/v1/labels/:id` | `remove` | Bearer | Soft delete (`isArchived: true`) |

- **Cross-User Protection**: Passing a `categoryId` owned by another user returns `403 Forbidden`.

---

## 9. Analytics & Insights

All analytics endpoints filter strictly by `phase: 'FOCUS'`.

### `GET /api/v1/analytics/summary`
- **Query Params**: `startDate` (ISO string, optional), `endDate` (ISO string, optional)
- **Response 200 OK**:
  ```json
  {
    "totalFocusSeconds": 7200,
    "completedSessionsCount": 3,
    "interruptedSessionsCount": 1,
    "totalSessionsCount": 4,
    "averageSessionSeconds": 1800,
    "dailyBreakdown": [
      { "date": "2026-10-28", "focusSeconds": 3600, "sessionsCount": 2 },
      { "date": "2026-10-29", "focusSeconds": 3600, "sessionsCount": 2 }
    ]
  }
  ```

### `GET /api/v1/analytics/categories`
- **Query Params**: `startDate`, `endDate`
- **Response 200 OK**:
  ```json
  [
    {
      "categoryId": "cat-uuid",
      "categoryName": "Computer Science",
      "color": "#3B82F6",
      "totalSeconds": 5400,
      "sessionCount": 3
    },
    {
      "categoryId": "uncategorized",
      "categoryName": "Uncategorized",
      "color": "#9CA3AF",
      "totalSeconds": 1800,
      "sessionCount": 1
    }
  ]
  ```

### `GET /api/v1/analytics/labels`
- **Query Params**: `startDate`, `endDate`
- **Response 200 OK**: Array of `{ labelId, labelName, color, totalSeconds, sessionCount }`.

---

## 10. Study Rooms

### `POST /api/v1/rooms`
- **Handler**: `RoomsController.create`
- **Request Body** (`CreateRoomDto`):
  | Field | Type | Required | Description |
  |---|---|---|---|
  | `name` | `string` | **Yes** | Max 80 chars |
  | `description` | `string` | No | Max 300 chars |
  | `slug` | `string` | No | Lowercase alphanumeric + hyphens (`/^[a-z0-9-]+$/`) |
  | `isPrivate` | `boolean`| No | Default `false` |
  | `maxParticipants`| `number` | No | Min 2, default `25` |
- **Behavior**: Auto-generates unique slug if omitted (`<name-slug>-<random4>`). Creator is automatically added as `OWNER`.
- **Response 201 Created**: Created `Room` record.

### `GET /api/v1/rooms`
- **Description**: Returns all public rooms (`isPrivate: false`) plus private rooms where the authenticated user is a member.
- **Response 200 OK**: Array of room objects including `_count.members` and user's membership role.

### `GET /api/v1/rooms/:id`
- **Description**: Detailed room info, including members list and current active room timer sessions with unleft participants.
- **Error Responses**: `403 Forbidden` if private room and user is not a member.

### `POST /api/v1/rooms/:id/join`
- **Description**: Joins a public room.
- **Error Responses**:
  - `403 Forbidden`: Cannot join private room without invite.
  - `409 Conflict`: Room has reached `maxParticipants`.

### `POST /api/v1/rooms/:id/leave`
- **Description**: Leaves the room. If sole `OWNER` leaves, ownership auto-transfers to senior moderator/member; if no other members remain, room is deleted.

### `PATCH /api/v1/rooms/:id`
- **Authorization**: Requires `OWNER` or `MODERATOR` role.
- **Request Body** (`UpdateRoomDto`): `name`, `description`, `isPrivate`, `maxParticipants`.

### `DELETE /api/v1/rooms/:id`
- **Authorization**: Requires `OWNER` role. Deletes room and cascades members/invites.

---

## 11. Room Invitations

Used to join private rooms. Tokens are 64-character hexadecimal strings generated with 256 bits of CSPRNG.

### `POST /api/v1/rooms/:roomId/invites`
- **Authorization**: Requires `OWNER` or `MODERATOR`.
- **Request Body** (`CreateInviteDto`):
  | Field | Type | Optional | Validation |
  |---|---|---|---|
  | `expiresInHours` | `number` | Yes | Min 1, Max 720 (30 days). `null` = never |
  | `maxUses` | `number` | Yes | Min 1, Max 1000. `null` = unlimited |
- **Response 201 Created**:
  ```json
  {
    "id": "invite-uuid",
    "roomId": "room-uuid",
    "token": "d5f19062e7a17cf1557088b64e030018f4a30e84b162629e8db801faeb2c5a08",
    "maxUses": 10,
    "expiresAt": "2026-10-31T17:00:00.000Z",
    "createdAt": "2026-10-29T17:00:00.000Z"
  }
  ```
  *(The raw `token` is returned **only once** upon creation. Only the SHA-256 hash is stored).*

### `POST /api/v1/invites/accept`
- **Handler**: `InvitationsController.acceptInvite`
- **Request Body** (`AcceptInviteDto`):
  ```json
  { "token": "d5f19062e7a17cf1557088b64e030018f4a30e84b162629e8db801faeb2c5a08" }
  ```
- **Response 200 OK**: `{ "room": { ... }, "alreadyMember": false, "role": "MEMBER" }`
- **Error Responses**:
  - `400 Bad Request`: Token revoked, expired, or maximum redemptions reached.
  - `404 Not Found`: Invalid invitation token.
  - `409 Conflict`: Room capacity full.

### `GET /api/v1/rooms/:roomId/invites`
- **Authorization**: Requires `OWNER` or `MODERATOR`. Returns active invites without exposing hashes.

### `DELETE /api/v1/rooms/:roomId/invites/:inviteId`
- **Authorization**: Requires `OWNER` or `MODERATOR`. Revokes the invitation.

---

## 12. Collaboration & Room Timers

Room timers allow synchronized focus sessions across room members.

| Method | Path | Handler | Min Role | Description |
|---|---|---|---|---|
| `GET` | `/api/v1/rooms/:roomId/timer` | `getRoomTimer` | `MEMBER` | Get active room timer & participants |
| `POST` | `/api/v1/rooms/:roomId/timer/start` | `startRoomTimer` | `MODERATOR` | Start room timer (`StartRoomTimerDto`) |
| `POST` | `/api/v1/rooms/:roomId/timer/pause` | `pauseRoomTimer` | `MODERATOR` | Pause room timer |
| `POST` | `/api/v1/rooms/:roomId/timer/resume` | `resumeRoomTimer` | `MODERATOR` | Resume room timer |
| `POST` | `/api/v1/rooms/:roomId/timer/complete` | `completeRoomTimer`| `MODERATOR` | Complete timer & credit participants |
| `POST` | `/api/v1/rooms/:roomId/timer/cancel` | `cancelRoomTimer` | `MODERATOR` | Cancel room timer |
| `POST` | `/api/v1/rooms/:roomId/timer/join` | `joinRoomTimer` | `MEMBER` | Join as active participant |
| `POST` | `/api/v1/rooms/:roomId/timer/leave` | `leaveRoomTimer` | `MEMBER` | Leave timer; credits personal duration |

- **Independent Participant Crediting**: When a user leaves or the room timer completes, individual study sessions are created based on exact joined time: `Math.min(targetDuration, (now - joinedAt))`. If participation is >= 60 seconds in `FOCUS` phase, focus credit is committed to their personal study history.

---

## 13. Room Chat

Persistent room messaging with cursor-based pagination.

### `GET /api/v1/rooms/:roomId/messages`
- **Handler**: `ChatController.getMessages` ([`backend/src/chat/chat.controller.ts`](file:///home/asta/Projects/studysync/backend/src/chat/chat.controller.ts))
- **Auth Required**: Yes (Must be room member)
- **Query Params** (`QueryMessagesDto`):
  | Param | Type | Optional | Description |
  |---|---|---|---|
  | `before` | `string` | Yes | ISO timestamp cursor (fetches messages created before this time) |
  | `limit` | `number` | Yes | Default: 30, Max: 100 |
- **Response 200 OK**:
  ```json
  {
    "messages": [
      {
        "id": "msg-uuid-1",
        "roomId": "room-uuid",
        "senderId": "user-uuid",
        "content": "Starting focus block now",
        "isEdited": false,
        "createdAt": "2026-10-29T10:00:00.000Z",
        "updatedAt": "2026-10-29T10:00:00.000Z",
        "sender": {
          "id": "user-uuid",
          "username": "soham_dev",
          "displayName": "Soham Rane",
          "avatarUrl": null
        }
      }
    ],
    "nextCursor": "2026-10-29T09:45:00.000Z"
  }
  ```
  *(Returned messages are chronologically ordered: oldest to newest).*

### `POST /api/v1/rooms/:roomId/messages`
- **Request Body** (`SendMessageDto`): `{ "content": "Hello team!" }` (Max 2000 chars)
- **Response 201 Created**: Created message with attached sender object.

### `PATCH /api/v1/rooms/:roomId/messages/:messageId`
- **Authorization**: Author only.
- **Request Body** (`EditMessageDto`): `{ "content": "Updated content" }`
- **Response 200 OK**: Updated message with `isEdited: true`.

### `DELETE /api/v1/rooms/:roomId/messages/:messageId`
- **Authorization**: Author OR room `OWNER`/`MODERATOR`. Soft-deletes (`deletedAt = now()`).
- **Response 200 OK**: Deleted message record.
