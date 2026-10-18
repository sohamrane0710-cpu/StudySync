# Architectural Decision Records (`DECISIONS.md`) — StudySync

## ADR-001: Headless Deadline-Based Timer Engine
- **Status**: Accepted
- **Context**: Relying on periodic `setInterval(1000)` drifts and freezes when browser tabs are throttled or during system sleep.
- **Decision**: Remaining time is calculated dynamically against an absolute target timestamp (`deadline = now() + remainingSeconds * 1000`). Clock operations use an `IClock` abstraction (`SystemClock` using `performance.now()` / `Date.now()`, and `SimulatedClock` for deterministic tests).
- **Consequences**: Flawless catch-up on sleep recovery, immune to React rendering cadence.

## ADR-002: IndexedDB for Local-First Persistence with Graceful Fallback
- **Status**: Accepted
- **Context**: Structured session history, mode definitions, and recovery state require durable offline persistence.
- **Decision**: Use IndexedDB as primary store with an in-memory/localStorage fallback for private browsing or restricted environments.
- **Consequences**: High storage capacity, async operations, zero external database dependencies.

## ADR-003: Pure Web Audio API for Chimes and Soundscapes
- **Status**: Accepted
- **Context**: External audio assets risk 404s, CORS issues, or requiring network access, violating local-first autonomy.
- **Decision**: Synthesize soothing alert chimes (focus, rest, warning) and generative ambient soundscapes (Pink/Brown noise rain, white noise, warm drone) directly using oscillators, white noise buffers, and biquad filters via the Web Audio API. Also provide standard HTML5 file upload input for playing local audio files.
- **Consequences**: Zero network requests, 100% offline, zero audio asset bundle bloat.

## ADR-004: Vanilla CSS with Semantic Tokens and Elevation Tiers
- **Status**: Accepted
- **Context**: The design system requires strict adherence to Circadian Neutrality (#0B0D11), Functional Luminescence (Focus/Rest/Alert), and Optical Layering (L0-L3).
- **Decision**: Implement all styling through clean CSS custom properties and utility classes in `src/index.css` without heavy utility frameworks.
- **Consequences**: Exact visual fidelity, zero CSS build pipeline overhead, full control over transitions and glassmorphism.
