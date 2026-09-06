# StudySync Product Specification

StudySync is a comprehensive study management and analytics platform enabling both personal focused studying and shared community study rooms.

## Core Pillars

1. **Authentication & Identity**
   - Traditional session-cookie-based auth.
   - User profiles and customizable avatars.

2. **Personal Timers & Analytics**
   - Users can define custom timer modes (e.g. 50/10 Pomodoro).
   - Users can study personally and log multiple labels for a session.
   - Granular personal analytics without any group requirement.

3. **Study Rooms (Real-time Shared Timers)**
   - Public and private study rooms.
   - Rooms have a single authoritative timer, synced globally across all members.
   - Users can drop in and drop out, capturing specific `RoomParticipation` intervals.

4. **Community & Group Labels**
   - Users can form groups and define group-level subjects (`GroupLabel`).
   - Users map their personal labels to group labels (`LabelAssociation`).
   - Studying automatically fan-outs analytics to groups accurately, with built-in guarantees against double-counting and full session-override support.
   - Historical analytics are immutable.
