# StudySync Timer Engine Architecture

This document describes the design and rules for StudySync's timer system (Phase 3B.0).

## Core Concepts

1. **TimerMode**: A reusable configuration.
   - Defines standard formats like "Classic 45/15" or custom pomodoro setups.
   - Defines loop parameters, stages (Focus, Short Break, Long Break), and durations.
   - **Always owned by a User**. For personal timers, it uses the user's selected mode. For shared room timers, it uses the mode selected by the user who starts the timer, but the resulting `TimerSession` is shared and room-owned.

2. **TimerSession**: A live instance of a timer currently running or paused.
   - Belongs to EITHER a User (personal timer) OR a StudyRoom (shared group timer).
   - `userId` is set for personal timers; `roomId` is set for room timers. Both cannot be set simultaneously.
   - Only backend timestamps are authoritative.

3. **StudySession**: A historical record of study activity.
   - ALWAYS belongs to a User.
   - Defines the actual time focused and triggers analytics calculations.
   - Contains a relationship to `TimerSession` strictly for historical tracking.

## Personal Timers

A personal timer is created by a user and isolated to their sessions.
Path: `User -> TimerSession -> StudySession`

The user enters a timer, studies, and records an activity. They are not required to be part of any Study Room or group.

## Shared Room Timers

Study Rooms contain one shared, authoritative timer state.
Path: `StudyRoom -> TimerSession -> RoomParticipation -> StudySession`

- The shared timer runs independently of who is inside the room. For example, if a room's timer runs from 08:00 to 09:00, joining at 08:30 will display 08:30 for the new user, not 08:00.
- **RoomParticipation**: Users join and leave rooms. We record multiple `RoomParticipation` intervals containing `startedAt` and `endedAt`.
- Room participation does NOT immediately mean active studying. Users explicitly convert their participation time into a `StudySession` or have it processed separately.
- A user can be part of a group but study independently. The timer provides a shared rhythm but individual study activity (analytics) remains purely personal until distributed to groups via labels.
