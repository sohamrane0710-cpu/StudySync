# StudySync Analytics and Labels Architecture

This document describes the design for tags/labels and analytics distribution within StudySync (Phase 3B.0).

## Double-Counting Prevention
The most critical rule of the StudySync analytics engine is that **total focus time is never multiplied by labels**. 
If a user studies for 60 minutes with 3 labels (`DSA`, `LeetCode`, `WebDev`), their personal total focus time remains **60 minutes**. 

When this is distributed to groups, a single group only ever receives the true actual duration once per session.

## Label Architecture

1. **Label (Personal Label)**
   - Owned by `User`.
   - Reusable across multiple `StudySession`s.
   - Represents a user's personal taxonomy (e.g., `DSA`, `LeetCode`).

2. **GroupLabel**
   - Owned by `Group`.
   - Represents a group's specific taxonomy (e.g., `Data Structures`, `Algorithms`).
   - Different groups do NOT need identical label names.

3. **LabelAssociation**
   - A many-to-many relationship mapping a personal `Label` to a `GroupLabel`.
   - E.g., User's `DSA` maps to Group A's `Data Structures` and Group B's `Problem Solving`.

## Session Associations
A single `StudySession` can contain multiple personal `Label`s via an implicit many-to-many relationship.

## Analytics Distribution

By default, when a user completes a `StudySession`:
1. The session duration contributes to the user's personal analytics total.
2. The session automatically fans out to all groups mapped through `LabelAssociation`s based on the personal labels applied.

### Overrides and Snapshotting

To support historical consistency and session-level overrides, group contributions are explicitly snapshotted:

- **StudySessionGroupContribution**: Records the raw `durationSeconds` to the `groupId`. This is constrained to be unique per `(studySessionId, groupId)`. This guarantees that even if 5 labels map to the same group, the group only receives the 60 minutes ONCE. 
- **ContributionDimension**: Stores immutable historical snapshots of the group labels (`groupLabelNameSnapshot`) that were triggered for that contribution. This prevents historical data from corrupting if the `GroupLabel` is renamed or deleted.
- **StudySessionLabelGroupSelection**: Explicitly persists a user's decision to include (`isIncluded: true`) or exclude (`isIncluded: false`) a specific `Label` -> `GroupLabel` mapping for a particular `StudySession`.

A user can override analytics distribution for a specific session by creating a `StudySessionLabelGroupSelection` record. The backend uses this explicitly persisted intention to determine whether to include the mapping when generating the contribution records and dimensions. This granular override applies only to the individual session, leaving the permanent `LabelAssociation` untouched.

## Privacy
Personal analytics do NOT automatically become visible to groups. Only the activity explicitly mapped via `LabelAssociation` (and not overridden) is fanned out and recorded in `StudySessionGroupContribution`.
