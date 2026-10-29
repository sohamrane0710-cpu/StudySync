# StudySync Timer State Machine Specification

## 1. Personal Timer State Machine

The personal timer coordinates Pomodoro phases and deep work intervals with server-authoritative timestamps. Clients never submit client-side countdown values as proof of work.

```
       [ No Active Session ]
                 |
                 | POST /api/v1/timers/start
                 v
             +-------+
    +------->| RUNNING |<------+
    |        +-------+        |
    |            |            |
    | POST /pause|            | POST /resume
    |            v            |
    |        +-------+        |
    +--------| PAUSED |-------+
             +-------+
                 |
  +--------------+--------------+
  |                             |
  | POST /cancel                | POST /complete
  v                             v
+-----------+            +-------------+
| CANCELLED |            |  COMPLETED  |
+-----------+            +-------------+
                                |
                                v
                   [ Creates study_sessions row ]
                   [ Advances phase if auto-break ]
```

### 1.1 State Invariants and Calculations

1. **Phase Definitions**:
   - `FOCUS`: Productive work interval (e.g. 25 or 50 minutes). Credited to user study history.
   - `SHORT_BREAK`: Rest interval (e.g. 5 or 10 minutes).
   - `LONG_BREAK`: Extended rest interval (e.g. 15 or 30 minutes, after $N$ cycles).

2. **Transition: START**:
   - Input: `timerModeId` (optional), `phase` (default `FOCUS`), `targetDuration` (optional override in seconds).
   - Validation: User must have **no existing session** in `RUNNING` or `PAUSED` status.
   - Authoritative Assignment:
     $$\text{startedAt} = \text{now()}$$
     $$\text{remainingSeconds} = \text{targetDuration}$$
     $$\text{expectedEndTime} = \text{startedAt} + \text{targetDuration}$$
     $$\text{status} = \text{RUNNING}$$

3. **Transition: PAUSE**:
   - Precondition: `status == RUNNING`.
   - Authoritative Calculation:
     $$\Delta t = \text{max}(0, \text{expectedEndTime} - \text{now()})$$
     $$\text{remainingSeconds} = \Delta t$$
     $$\text{expectedEndTime} = \text{NULL}$$
     $$\text{pausedAt} = \text{now()}$$
     $$\text{status} = \text{PAUSED}$$

4. **Transition: RESUME**:
   - Precondition: `status == PAUSED`.
   - Authoritative Calculation:
     $$\text{startedAt} = \text{now()}$$
     $$\text{expectedEndTime} = \text{now()} + \text{remainingSeconds}$$
     $$\text{pausedAt} = \text{NULL}$$
     $$\text{status} = \text{RUNNING}$$

5. **Transition: COMPLETE**:
   - Precondition: `status \in \{ RUNNING, PAUSED \}`.
   - Authoritative Calculation:
     - If timer has naturally expired ($\text{now()} \ge \text{expectedEndTime}$), elapsed duration equals $\text{targetDuration}$.
     - If completed early by user action, elapsed duration equals:
       $$\text{actualDuration} = \text{targetDuration} - \text{remainingSeconds}$$
   - Database Actions (Atomic Transaction):
     1. Update `timer_sessions`: `status = COMPLETED`, `updatedAt = now()`.
     2. Insert `study_sessions`:
        - `userId = currentUserId`
        - `timerSessionId = timerSession.id`
        - `phase = timerSession.phase`
        - `status = COMPLETED`
        - `targetDuration = timerSession.targetDuration`
        - `actualDuration = calculatedActualDuration`
        - `startedAt = timerSession.startedAt`
        - `endedAt = now()`
     3. Link optional `categoryIds` and `labelIds`.
   - **Idempotency Guarantee**: If `/complete` is called multiple times concurrently or on retry, row-level locking (`SELECT ... FOR UPDATE`) checks if the session is already completed. If already completed, the existing study session is returned without duplicating database records or credited minutes.

6. **Transition: CANCEL**:
   - Precondition: `status \in \{ RUNNING, PAUSED \}`.
   - Calculates elapsed duration:
     $$\text{elapsed} = \text{targetDuration} - \text{remainingSeconds}$$
   - If $\text{elapsed} \ge 60$ seconds (configurable threshold), an `INTERRUPTED` study session is optionally recorded so partial work is preserved. Otherwise, no record is saved.

---

## 2. Collaborative Room Timer & Participant Tracking

In a shared room, the room timer coordinates all participants while tracking individual join/leave intervals independently.

```
+---------------------------------------------------------------------------------+
| Room Timer: Target 50m Focus                                                    |
|                                                                                 |
| 00:00                15:00                       40:00                    50:00 |
| [ Room Timer Started ]----------------------------------------[ Room Completed ]|
|                                                                                 |
| Alice: [ Joined 00:00 ]---------------------------------------[ Left 50:00 ]    |
|        Credit: 50 minutes                                                       |
|                                                                                 |
| Bob:                 [ Joined 15:00 ]------------[ Left 40:00 ]                 |
|                      Credit: 25 minutes (40 - 15)                               |
|                                                                                 |
| Charlie:                                         [ Joined 40:00 ]-[ Left 50:00 ]|
|                                                  Credit: 10 minutes (50 - 40)   |
+---------------------------------------------------------------------------------+
```

### 2.1 Participant Duration Tracking Algorithm

1. **Room Timer Starts**:
   - Moderator/Owner starts room timer (`POST /api/v1/rooms/:id/timer/start`).
   - A `room_study_sessions` row is created with authoritative `startedAt` and `expectedEndTime`.
   - The creator automatically becomes the first participant in `room_study_session_participants` with `joinedAt = now()`.

2. **Participant Joins**:
   - Any room member calls `POST /api/v1/rooms/:id/timer/join`.
   - Creates a row in `room_study_session_participants`:
     - `roomStudySessionId = activeRoomSession.id`
     - `userId = currentUserId`
     - `joinedAt = now()`
     - `leftAt = NULL`
     - `creditedSeconds = 0`

3. **Participant Leaves Early**:
   - Member calls `POST /api/v1/rooms/:id/timer/leave`.
   - System records `leftAt = now()`.
   - Calculates participant's active duration:
     $$\text{duration} = \text{min}(\text{roomElapsed}, \text{leftAt} - \text{joinedAt})$$
   - Generates personal `study_sessions` row linked via `roomStudySessionId` and `actualDuration = duration`.

4. **Room Timer Completes**:
   - Any participants whose `leftAt IS NULL` have their `leftAt` set to `now()`.
   - Individual credits are computed and written to each participant's personal `study_sessions` table in a single batch transaction.
   - Broadcasts `timer:completed` via WebSockets.
