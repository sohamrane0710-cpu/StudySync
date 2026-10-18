import type { ModeDefinition, StepType } from './timer';

export type SessionOutcome = 'completed' | 'interrupted' | 'stopped';

export interface SessionSegment {
  stepId: string;
  type: StepType;
  label: string;
  plannedSeconds: number;
  actualSeconds: number;
  completed: boolean;
  startedAt: number; // Unix timestamp in ms
  endedAt: number;   // Unix timestamp in ms
}

export interface SessionRecord {
  id: string;
  sessionLabel: string;
  modeId: string;
  modeName: string;
  modeSnapshot: ModeDefinition;
  startedAt: number; // Unix timestamp in ms
  endedAt: number;   // Unix timestamp in ms
  totalFocusSeconds: number;
  totalRestSeconds: number;
  completedIntervals: number;
  totalPlannedIntervals: number;
  outcome: SessionOutcome;
  segments: SessionSegment[];
}

export interface ActiveRunRecovery {
  sessionId: string;
  sessionLabel: string;
  modeSnapshot: ModeDefinition;
  currentStepIndex: number;
  currentLoop: number;
  state: 'running' | 'paused';
  remainingSeconds: number;
  targetDeadline: number | null; // null if paused
  startedAt: number;
  lastTickTimestamp: number;
  accumulatedFocusSeconds: number;
  accumulatedRestSeconds: number;
  completedIntervals: number;
  segments: SessionSegment[];
  currentStepStartedAt: number;
}
