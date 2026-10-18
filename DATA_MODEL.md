# Data Model Specification (`DATA_MODEL.md`) — StudySync

## 1. Domain Entities & Interfaces

### 1.1 Step & Mode
```typescript
export type StepType = 'focus' | 'rest';

export interface StepDefinition {
  id: string;
  type: StepType;
  label: string;
  durationSeconds: number; // >= 5 seconds
}

export interface ModeDefinition {
  id: string;
  name: string;
  description: string;
  steps: StepDefinition[];
  loopCount: number; // 1..N, or 0 for infinite
  isBuiltIn: boolean;
}
```

### 1.2 Session & Segment
```typescript
export type SessionOutcome = 'completed' | 'interrupted' | 'stopped';

export interface SessionSegment {
  stepId: string;
  type: StepType;
  label: string;
  plannedSeconds: number;
  actualSeconds: number;
  completed: boolean;
  startedAt: number; // Unix timestamp ms
  endedAt: number;   // Unix timestamp ms
}

export interface SessionRecord {
  id: string;
  sessionLabel: string;
  modeId: string;
  modeName: string;
  modeSnapshot: ModeDefinition;
  startedAt: number;
  endedAt: number;
  totalFocusSeconds: number;
  totalRestSeconds: number;
  completedIntervals: number;
  totalPlannedIntervals: number;
  outcome: SessionOutcome;
  segments: SessionSegment[];
}
```

### 1.3 Recovery Token
```typescript
export interface ActiveRunRecovery {
  sessionId: string;
  sessionLabel: string;
  modeSnapshot: ModeDefinition;
  currentStepIndex: number;
  currentLoop: number;
  state: 'running' | 'paused';
  remainingSeconds: number;
  targetDeadline: number | null;
  startedAt: number;
  lastTickTimestamp: number;
  accumulatedFocusSeconds: number;
  completedIntervals: number;
  segments: SessionSegment[];
  currentStepStartedAt: number;
}
```

### 1.4 User Preferences
```typescript
export interface UserPreferences {
  sessionLabel: string;
  activeModeId: string;
  chimeVolume: number; // 0..1
  chimesEnabled: boolean;
  ambientSound: 'none' | 'rain' | 'whitenoise' | 'drone' | 'custom';
  ambientVolume: number; // 0..1
  ambientEnabled: boolean;
  customAudioName?: string;
  reducedMotion: boolean;
}
```
