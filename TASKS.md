# Task Tracking (`TASKS.md`) — StudySync

## Milestone A: Foundation & Architecture
- [x] Configure TypeScript, Vite, Vitest, index.html, package.json
- [x] Establish architecture documentation (README, AGENTS, PRD, ARCHITECTURE, ROADMAP, DATA_MODEL, DECISIONS, TASKS)
- [x] Create design token variables and elevation tiers in `src/index.css`

## Milestone B: Headless Timer Engine
- [x] Implement clock interface (`IClock`, `SystemClock`, `SimulatedClock`)
- [x] Define domain contracts (`timer.ts`, `session.ts`)
- [x] Implement deadline-based state machine (`timerEngine.ts`) with sleep catch-up and strict accounting
- [x] Comprehensive unit tests for timer engine (`timerEngine.test.ts`)

## Milestone C: Modes, Storage & Streak
- [x] Implement built-in presets (Pomodoro, Deep Work, Ultradian, Sprint) and mode validation (`modeService.ts`)
- [x] Implement IndexedDB storage adapter (`indexedDBStorage.ts`) with recovery schema
- [x] Implement streak calculation with timezone awareness and qualifying threshold (`streak.ts`)
- [x] Unit tests for mode service, storage, and streak calculation

## Milestone D: Five-Zone Workspace & Hero Dial
- [x] Zone 1: Top utility bar with logo, presence badge ("Solo workspace"), and audio quick-toggle
- [x] Zone 2: Context pill with editable `#Study_Session` label and sequence breadcrumb pipeline
- [x] Zone 3: Hero radial dial with SVG background, progress stroke, subtle halo, fluid tabular MM:SS countdown
- [x] Zone 4: Tactile control island with elevated Play/Pause/Resume, Skip, Reset, Restart, Stop-and-Save, and keyboard shortcuts (`Space`, `N`, `R`)
- [x] Accessible rotary JogDial component with mouse/touch drag, keyboard arrows, and numeric input

## Milestone E: History Drawer, Summary & Audio
- [x] Zone 5: Floating bottom dock with ambient audio module, streak counter, and drawer trigger
- [x] Session history drawer with today's focus time, past session log, outcome filters, clear history
- [x] Session summary modal on completion or stop-and-save
- [x] Web Audio API chimes (focus, rest, warning) and synthesized soundscapes (Rain, White Noise, Drone) + local file playback

## Milestone F: Polish, Accessibility & Verification
- [x] Responsive layout and prefers-reduced-motion styling
- [x] Vitest test suite execution
- [x] TypeScript type checking (`tsc --noEmit`)
- [x] Production build validation (`vite build`)
- [x] Browser-level verification
