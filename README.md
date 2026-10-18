# StudySync — Local-First Focus Workspace

StudySync is a polished, local-first study timer and focus workspace built with a dark graphite/glass aesthetic, a deadline-accurate timer engine, customizable study sequences, offline persistence via IndexedDB, session history, and ambient audio soundscapes.

## Core Features (Phase 1)

- **Accurate Headless Timer Engine**: Built on a deadline-based state machine with an injectable monotonic clock abstraction, resilient to background browser tab throttling and system sleep.
- **Five-Zone Workspace**:
  - **Zone 1: Utility and Presence Bar**: Logo, "Solo workspace" presence pill, and compact audio control. Fades gracefully during deep focus.
  - **Zone 2: Context & Sequence Pipeline**: Editable session label (`#Study_Session`), sequence breadcrumbs with step indicators (completed, active, pending).
  - **Zone 3: Hero Radial Focus Dial**: Centered SVG dial with background track, progress ring, subtle ambient halo, fluid tabular monospace countdown (`MM:SS`), and phase/interval status.
  - **Zone 4: Tactile Control Island**: Elevated play/pause/resume button, skip, reset interval, restart sequence, and stop-and-save. Keyboard shortcuts (`Space`, `N`, `R`).
  - **Zone 5: Floating Bottom Dock**: Ambient soundscape generator, consecutive-day focus streak counter, and history drawer trigger.
- **Customizable Modes & Sequences**:
  - Built-in presets: Classic Pomodoro (25/5 x 4), Deep Work (50/10 x 2), Ultradian Rhythm (90/20 x 1), Quick Sprint (15/3 x 3).
  - Mode Editor: Create, edit, duplicate, delete, and reorder steps. Supports finite and infinite loop counts.
  - Accessible circular Jog Dial with mouse/touch rotation, keyboard arrows/PgUp/PgDn, increment/decrement buttons, and numeric input.
  - Immutable historical snapshots: Active runs lock their mode configuration snapshot so edits don't mutate in-progress runs.
- **Local-First Persistence**: IndexedDB storage adapter (`IStudySyncStorage`) persisting preferences, mode snapshots, session records, and active run recovery tokens.
- **Streak & Analytics**: Consecutive-day focus streak calculated from qualifying completed focus time, local timezone aware with genuine zero state.
- **Synthesized Audio**: Web Audio API soundscapes (Rain, White Noise, Deep Drone) and gentle audio alert chimes without external network calls, plus local audio file support.

## Getting Started

### Prerequisites

- Node.js (>= 18)
- npm or pnpm

### Development

```bash
npm run dev
```

### Run Tests

```bash
npm test
```

### Type Check & Build

```bash
npm run typecheck
npm run build
```

## Architecture

StudySync strictly enforces separation between:
1. **Domain Engine**: Pure deadline-based state machine with clock abstraction (`src/engine/`).
2. **Mode & Sequence Service**: Presets, step validation, snapshot cloning (`src/services/modeService.ts`).
3. **Storage Layer**: IndexedDB adapter with versioned schemas and recovery management (`src/storage/`).
4. **Audio Engine**: Web Audio API synthesized chimes and soundscapes (`src/services/audioService.ts`).
5. **Presentation Layer**: React components styled with design tokens in Vanilla CSS (`src/components/`, `src/index.css`).
