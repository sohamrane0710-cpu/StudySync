# Durable Agent Instructions (`AGENTS.md`)

This document defines mandatory, binding guidelines for all AI coding agents working on the StudySync codebase.

## 1. Absolute Operating Rules

1. **Do Not Run Git Commands**: Never run `git` commands (`commit`, `push`, `reset`, `clean`, `checkout`, `branch`, etc.). The user manages Git separately.
2. **Timer Engine Correctness**: Never tie timer timing or countdown truth to React re-renders, `requestAnimationFrame`, or CSS transitions. All elapsed time and state transitions are governed by deadline arithmetic and the injected `IClock`.
3. **No Unapproved Dependencies**: Avoid installing dependencies without clear justification. Rely on browser standard APIs (Web Audio, IndexedDB, HTML5 audio, SVG) and existing installed packages (`react`, `vitest`, `fake-indexeddb`).
4. **Vanilla CSS Design System**: Style components using standard CSS and semantic CSS variables. Follow the elevation tokens (L0, L1, L2, L3) and semantic state colors (focus, rest, alert, neutral).
5. **No Hallucinated Data**: Never display fake active users, multiplayer rooms, or arbitrary streaks. If data is empty or zero, display a clean, genuine zero state.
6. **Immutable Snapshots**: Active timer runs must snapshot their mode configuration upon start. Subsequent edits to mode definitions must not affect running sessions.

## 2. Architecture & Layering

- `src/types/`: Domain contracts, session records, modes, steps, storage interfaces.
- `src/engine/`: Pure domain logic for clock and deadline state machine. Zero React imports.
- `src/services/`: Mode presets and validation, synthesized Web Audio chime and soundscape services.
- `src/storage/`: IndexedDB persistence adapter, migration logic, and crash recovery.
- `src/utils/`: Time formatting, streak calculations, math utilities.
- `src/context/`: React context connecting headless engine to UI.
- `src/components/`: Modular five-zone layout components and accessible dialogs.
- `src/index.css`: Design tokens, elevation surfaces, typography, transitions.

## 3. Focus Accounting Invariants

- Paused duration earns no focus credit.
- Rest intervals earn no focus credit.
- Skipping a focus step credits only the elapsed active focus seconds prior to skip.
- Resetting an interval resets the current step duration without double-counting past time.
- A run is finalized at most once. No duplicate session records can be written.
