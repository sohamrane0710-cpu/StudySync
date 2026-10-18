# Architecture Specification (`ARCHITECTURE.md`) — StudySync

## 1. System Architecture & Module Boundaries

StudySync is organized into strictly isolated domain, service, storage, and presentation layers:

```
src/
├── types/                 # Shared domain types, contracts & schemas
│   ├── timer.ts           # Timer states, steps, events, commands
│   ├── session.ts         # Session history records, segments, statistics
│   └── storage.ts         # Storage interface contracts & schemas
├── engine/                # Pure domain timer engine
│   ├── clock.ts           # Clock interface (SystemClock, SimulatedClock)
│   ├── timerEngine.ts     # Deadline-based state machine & focus accounting
│   └── timerEngine.test.ts
├── services/              # Domain services
│   ├── modeService.ts     # Presets, mode validation, step sequences, snapshots
│   ├── audioService.ts    # Web Audio chimes & ambient soundscapes
│   └── modeService.test.ts
├── storage/               # Local-first persistence
│   ├── indexedDBStorage.ts# IndexedDB adapter, schema versioning, recovery
│   └── storage.test.ts
├── utils/                 # Pure helper functions
│   ├── timeFormat.ts      # MM:SS, duration, date formatting
│   ├── streak.ts          # Consecutive-day focus streak calculator
│   └── streak.test.ts
├── context/               # React Context bridge
│   ├── TimerContext.tsx   # Wires headless engine & storage to React tree
│   └── useTimer.ts        # Custom hook for UI components
├── components/            # UI Components
│   ├── workspace/         # Five-zone workspace, top bar, sequence pipeline, dock
│   ├── timer/             # Hero radial dial, tactile control island
│   ├── controls/          # Accessible rotary JogDial component
│   ├── modes/             # Mode selector & custom sequence editor modals
│   ├── history/           # History drawer & session summary modal
│   └── audio/             # Audio settings modal
└── index.css              # Design tokens, elevation tiers (L0-L3), animations
```

## 2. Timer Engine State Machine & Invariants

### 2.1 State Model
- `idle`: Mode is loaded, waiting to start.
- `running`: Ticking towards step target deadline.
- `paused`: Active countdown frozen at paused remaining seconds.
- `completed`: All steps/loops in sequence finished naturally.
- `stopped`: Session stopped manually by user and saved.

### 2.2 Invariants
1. **Deadline Calculation**: `targetDeadline = now() + remainingSeconds * 1000`. Remaining time is computed on each tick: `Math.max(0, Math.ceil((targetDeadline - now()) / 1000))`.
2. **Background Throttling Resiliency**: If a browser sleep or background throttling occurs, multiple steps that elapsed while throttled are processed sequentially in chronological order, crediting eligible focus time.
3. **Zero Fake Credit**: Paused time and rest steps yield 0 focus seconds.
4. **Immutable Snapshots**: Active run copies `ModeDefinition` into `activeModeSnapshot`.

## 3. Storage & Recovery Strategy
- IndexedDB database `studysync_db` (Version 1).
- Object stores:
  - `sessions`: Past session records with timestamps, segments, duration, and status.
  - `custom_modes`: User-created and customized mode definitions.
  - `preferences`: User settings, audio preferences, volume, context label.
  - `recovery`: Active run recovery token and snapshot to resume runs after page refresh.
