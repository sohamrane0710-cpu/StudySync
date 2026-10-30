# StudySync Frontend

> Production-grade, immersive study productivity and collaborative focus application. Built with React 19, TypeScript, Vite, Tailwind CSS, TanStack Query, and Socket.IO.

---

## 1. Overview & Visual Design System

StudySync is designed as a calm, optical-glass personal focus workspace that seamlessly transitions into real-time collaborative study rooms.

### Aesthetic Foundation
- **Base Background**: Deep near-black `#0B0D11`, secondary `#101319`, elevated surface `#12151A`.
- **Optical Glass Surface**: Translucent charcoal with subtle 1px border highlights (`border-white/10`) and backdrop blur (`backdrop-blur-xl`).
- **Dynamic Ambient Illumination**: Soft top glow that shifts between warm amber (`#F59E0B`) during focus sessions and cool teal (`#14B8A6`) during break phases.
- **Typography**: Clean, readable interface typography (Inter) paired with monospace tabular numerals (JetBrains Mono) for timer countdowns and statistics.

---

## 2. Technology Stack

- **Framework**: React 19 with TypeScript
- **Bundler & Tooling**: Vite with Vitest
- **Styling**: Tailwind CSS with custom optical-glass design tokens
- **Routing**: React Router DOM (`/login`, `/signup`, `/app/focus`, `/app/sessions`, `/app/analytics`, `/app/rooms`, `/app/rooms/:roomId`, `/app/settings`)
- **Server State & Caching**: TanStack React Query with automatic cache invalidation
- **Authentication**: Supabase Auth (`@supabase/supabase-js`) + Seamless Local Development Auth Token support
- **WebSockets / Collaboration**: Socket.IO Client connecting to the backend `/collaboration` gateway namespace
- **Visualizations**: Recharts (daily area trend gradients and category breakdown donut charts)
- **Audio Synthesizer**: Web Audio API oscillator synthesis for bell chimes and continuous ambient noise (rain, waves, cafe, white noise) without external asset dependencies
- **Icons**: Lucide React
- **Forms & Validation**: Controlled inputs with Zod validation rules

---

## 3. Directory Structure

```text
frontend/
├── public/                   # Static public assets
├── src/
│   ├── app/
│   │   ├── providers.tsx     # TanStack Query + AuthProvider wrapper
│   │   ├── query-client.ts   # Safe query retry and staleTime configuration
│   │   └── router.tsx        # Protected route definitions and layouts
│   ├── components/
│   │   ├── layout/           # AppLayout, Sidebar, MobileNav, UserMenu
│   │   ├── timer/            # RingFace, DigitalFace, MinimalFace, FlipFace,
│   │   │                     # TimerControls, PhaseSelector, ModeSelector, CompletionModal
│   │   └── ui/               # Button, Input, Badge, Modal, Skeleton
│   ├── features/
│   │   ├── analytics/        # AnalyticsPage with Recharts visualizations & streak calculation
│   │   ├── auth/             # LoginPage, SignUpPage, ProtectedRoute, AuthContext
│   │   ├── chat/             # RoomChatWidget (REST cursor-based pagination)
│   │   ├── focus/            # FocusPage (central authoritative workspace)
│   │   ├── rooms/            # RoomsDirectoryPage, RoomDetailPage, InviteModal
│   │   ├── sessions/         # SessionsPage (paginated history, edit/delete modals)
│   │   └── settings/         # SettingsPage (profile, preferences, modes, categories, labels)
│   ├── hooks/
│   │   ├── use-active-timer.ts  # Authoritative timer state machine & recovery
│   │   └── use-preferences.ts   # Server-synced user preferences
│   ├── lib/
│   │   ├── api/              # Typed API modules (users, timers, modes, sessions, rooms, chat, etc.)
│   │   ├── audio/            # Web Audio API chime and ambient noise synthesizer
│   │   ├── socket/           # Socket.IO client manager for /collaboration
│   │   ├── supabase/         # Supabase client initialization
│   │   └── utils/            # cn (Tailwind merge), formatters (timer, duration, dates, hex colors)
│   ├── tests/                # Vitest unit and component tests
│   ├── types/                # Strongly-typed DTOs and API response models
│   ├── App.tsx               # App entrypoint
│   ├── index.css             # Tailwind directives and optical glass utilities
│   └── main.tsx              # DOM root mount
├── .env.example              # Environment variables template
├── package.json
├── tsconfig.json
├── tsconfig.app.json
└── vite.config.ts            # Vite + Vitest config with path aliases and code splitting
```

---

## 4. Setup & Running Locally

### Prerequisites
- Node.js 18+ (Node 20+ recommended)
- StudySync NestJS Backend running at `http://localhost:3000` (port 3000, prefix `api/v1`)

### Environment Configuration

Create a `.env` file in `frontend/` (or copy from `.env.example`):

```dotenv
VITE_API_URL=http://localhost:3000/api/v1
VITE_WS_URL=http://localhost:3000
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

> **Note on Authentication**: If `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are not configured, the frontend automatically presents the "Quick Local Developer Sign-In" button, which logs in with a backend-verified dev JWT token. If Supabase keys are configured, standard email/password authentication is active.

### Commands

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Start Vite dev server on port 5173
npm run dev

# Run unit and component tests with Vitest
npm test

# Run TypeScript check and production build
npm run build

# Preview production build locally
npm run preview
```

---

## 5. Authoritative Timer & Page Recovery

The StudySync focus timer enforces an authoritative server-side state machine:

1. **Recovery on Page Reload**: Upon mount, `useActiveTimer` queries `GET /api/v1/timers/active`.
2. **Timestamp Interpolation**: The visual countdown is derived from the server timestamp:
   ```ts
   remainingSeconds = Math.max(0, Math.round((new Date(expectedEndTime).getTime() - Date.now()) / 1000));
   ```
3. **Paused State**: Preserves exact `remainingSeconds` captured by the server.
4. **Tab Suspension & Visibility**: Listens to `document.visibilityState === 'visible'` to immediately re-sync state after tab switches or wakeups.
5. **Phase Management**: Supports Focus, Short Break, and Long Break with server-calculated recommendations.
6. **Cancellation Partial Credit**: Cancelling a session with $\ge 60$ seconds elapsed automatically credits an `INTERRUPTED` study record in personal history.

---

## 6. Collaborative Rooms & WebSockets

- **Gateway Namespace**: `/collaboration`
- **Handshake Authentication**: `auth: { token: 'Bearer <token>' }`
- **Room Timer Sync**: Broadcast events `timer:started`, `timer:paused`, `timer:resumed`, `timer:completed`, `timer:cancelled` ensure all members see synchronized countdowns.
- **Presence**: Broadcast events `participant:joined` and `participant:left` update room attendee status in real time.
- **Independent Personal Crediting**: When a room participant leaves or the timer completes, study duration is individually credited to the user's history based on exact joined duration.
- **REST Chat**: Chat messages are persisted via REST endpoints (`GET /rooms/:id/messages?before=&limit=30`, `POST /rooms/:id/messages`) with pagination, editing, and deletion.

---

## 7. Testing Strategy

The test suite covers:
- **`src/tests/format.spec.ts`**: Validates timer digits formatting (00:00, MM:SS, HH:MM:SS), duration strings (25m, 1h 30m), and hex color validation.
- **`src/tests/api-client.spec.ts`**: Validates Authorization Bearer attachment, token retrieval, parameter serialization, and RFC 7807 error parsing.
- **`src/tests/timer-math.spec.ts`**: Verifies authoritative countdown derivation against target timestamps, paused time preservation, and clamping on expiration.
- **`src/tests/timer-faces.spec.tsx`**: Component tests verifying RingFace, DigitalFace, MinimalFace, FlipFace, and TimerControls.
