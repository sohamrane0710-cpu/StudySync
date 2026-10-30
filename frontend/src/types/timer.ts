export type TimerPhase = 'FOCUS' | 'SHORT_BREAK' | 'LONG_BREAK';
export type TimerStatus = 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

export interface TimerMode {
  id: string;
  userId: string | null;
  name: string;
  description?: string | null;
  focusDuration: number; // in seconds
  shortBreakDuration: number;
  longBreakDuration: number;
  longBreakInterval: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TimerSession {
  id: string;
  userId: string;
  timerModeId?: string | null;
  phase: TimerPhase;
  status: TimerStatus;
  targetDuration: number;
  remainingSeconds: number;
  startedAt: string;
  pausedAt?: string | null;
  expectedEndTime?: string | null;
  totalFocusSeconds: number;
  cycleCount: number;
  authoritativeRemainingSeconds: number;
  isExpired: boolean;
  timerMode?: TimerMode | null;
}

export interface StartTimerPayload {
  timerModeId?: string;
  phase?: TimerPhase;
  durationOverride?: number;
}

export interface CompleteTimerPayload {
  title?: string;
  notes?: string;
  categoryIds?: string[];
  labelIds?: string[];
  advanceToNextPhase?: boolean;
}

export interface CompleteTimerResponse {
  timerSession: {
    id: string;
    status: TimerStatus;
    remainingSeconds: number;
    totalFocusSeconds: number;
    cycleCount: number;
  };
  studySession?: {
    id: string;
    title: string | null;
    phase: TimerPhase;
    status: string;
    targetDuration: number;
    actualDuration: number;
    startedAt: string;
    endedAt: string;
  };
  creditedDuration: number;
  nextPhase?: TimerPhase;
  idempotentReplay?: boolean;
}

export interface CancelTimerPayload {
  reason?: string;
  savePartialRecord?: boolean;
}

export interface CancelTimerResponse {
  timerSession: {
    id: string;
    status: TimerStatus;
  };
  interruptedStudyRecord?: {
    id: string;
    status: string;
    actualDuration: number;
  } | null;
  elapsedSeconds: number;
}
