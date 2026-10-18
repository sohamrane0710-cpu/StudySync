# Product Requirements Document (PRD) — StudySync

## 1. Vision & Overview
StudySync is a local-first study workspace engineered for distraction-free focus. It delivers a dark, glass-layered interface, an uncompromisingly accurate timer engine, customizable interval pipelines, ambient soundscapes, and local persistence.

## 2. Phase 1 Scope & Priorities

### 2.1 Included in Phase 1
- **Focus Dashboard**: Five-zone workspace (Utility bar, Context & sequence pipeline, Hero radial dial, Tactile control island, Floating bottom dock).
- **Accurate Timer Engine**: Deadline-based timing, clock abstraction, catch-up across sleep/throttling, exact focus accounting.
- **Radial SVG Dial**: Dual-ring SVG with background track, animated progress ring, subtle halo, tabular MM:SS countdown, phase indicators.
- **Sequence Modes**: 4 built-in presets (Classic Pomodoro, Deep Work, Ultradian, Quick Sprint) + custom sequence editor (create, edit, duplicate, delete, reorder, loop counts).
- **Duration Configuration**: Accessible rotary jog dial, keyboard arrow/PgUp/PgDn navigation, increment/decrement buttons, and numeric input.
- **Immutable Snapshots**: Active runs lock mode definitions at start.
- **Local Persistence & Recovery**: IndexedDB storage for sessions, preferences, and crash/reload recovery without duplicate records.
- **Session History & Analytics**: Today's total focus time, past session log with outcome filters, consecutive-day focus streak.
- **Audio Alerts & Soundscapes**: Synthesized Web Audio chimes (focus complete, rest complete, warning) + offline soundscapes (rain, white noise, drone) + local file selection.
- **Design System**: Graphite/glass aesthetic with L0-L3 elevation tiers, semantic colors, and reduced-motion support.

### 2.2 Out of Scope for Phase 1
- Remote accounts, authentication, cloud sync, or servers.
- Live multiplayer rooms or fake active presence counts.
- Audio file uploads to remote servers.
- Complex gamification or social feeds.

## 3. Five-Zone UI Specification
1. **Utility & Presence Bar**: 56px height, logo, "Solo workspace" badge, compact soundscape status, focus fade effect.
2. **Context & Sequence Pipeline**: Editable session label (`#Study_Session`), sequence breadcrumb nodes with status (completed, active, pending) and connecting track.
3. **Hero Radial Focus Dial**: 280–360px SVG, background track, progress stroke, subtle halo, fluid tabular monospace countdown.
4. **Tactile Control Island**: Elevated Play/Pause/Resume, Skip, Reset step, Restart sequence, Stop & Save. Monospace keyboard hints (`Space`, `N`, `R`).
5. **Floating Bottom Dock**: L2 pill containing Ambient audio module, Streak & metric module, and History drawer trigger.
