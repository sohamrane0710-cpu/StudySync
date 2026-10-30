export type TimerPhase = 'FOCUS' | 'SHORT_BREAK' | 'LONG_BREAK';
export type TimerStatus = 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
export type TimerDirection = 'COUNTDOWN' | 'COUNT_UP';
export type TimerStepType = 'FOCUS' | 'REST';

export interface TimerModeStep {
  id: string;
  timerModeId: string;
  name: string;
  type: TimerStepType;
  duration: number; // in seconds
  order: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface TimerMode {
  id: string;
  userId: string | null;
  name: string;
  description?: string | null;
  isLooping?: boolean;
  defaultDirection?: TimerDirection;
  focusDuration: number; // in seconds
  shortBreakDuration: number;
  longBreakDuration: number;
  longBreakInterval: number;
  steps?: TimerModeStep[];
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TimerStepInfo {
  stepIndex: number;
  stepName: string;
  stepType: TimerStepType;
  duration: number;
  totalSteps: number;
}

export interface TimerSession {
  id: string;
  userId: string;
  timerModeId?: string | null;
  stepId?: string | null;
  stepIndex?: number;
  stepName?: string | null;
  stepType?: TimerStepType | null;
  totalSteps?: number;
  direction?: TimerDirection;
  phase: TimerPhase;
  status: TimerStatus;
  targetDuration: number;
  remainingSeconds: number;
  elapsedSeconds?: number;
  startedAt: string;
  pausedAt?: string | null;
  resumedAt?: string | null;
  expectedEndTime?: string | null;
  totalFocusSeconds: number;
  cycleCount: number;
  authoritativeRemainingSeconds: number;
  authoritativeElapsedSeconds?: number;
  isExpired: boolean;
  isSequenceFinished?: boolean;
  currentStep?: TimerStepInfo;
  nextStepPreview?: TimerStepInfo | null;
  sequenceSnapshot?: any;
  timerMode?: TimerMode | null;
}

export interface StartTimerPayload {
  timerModeId?: string;
  stepIndex?: number;
  durationOverride?: number;
  directionOverride?: TimerDirection;
  phase?: TimerPhase;
}

export interface CompleteTimerPayload {
  timerSessionId: string;
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
    stepIndex?: number;
    stepName?: string | null;
    stepType?: TimerStepType | null;
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
    stepName?: string | null;
    stepIndex?: number | null;
  } | null;
  creditedDuration: number;
  nextPhase?: TimerPhase;
  isSequenceFinished?: boolean;
  nextStepPreview?: TimerStepInfo | null;
  nextTimerSession?: TimerSession | null;
  autoStarted?: boolean;
  idempotentReplay?: boolean;
}

export interface SkipTimerPayload {
  timerSessionId: string;
}

export interface SkipTimerResponse {
  timerSession: {
    id: string;
    status: TimerStatus;
  };
  studySession: null;
  isSequenceFinished: boolean;
  nextStepPreview?: TimerStepInfo | null;
  nextTimerSession?: TimerSession | null;
  autoStarted?: boolean;
}

export interface FinishSequencePayload {
  timerSessionId?: string;
}

export interface FinishSequenceResponse {
  finished: boolean;
  isSequenceFinished: boolean;
  nextTimerSession: null;
  nextStepPreview: null;
}

export interface PauseTimerPayload {
  timerSessionId?: string;
}

export interface ResumeTimerPayload {
  timerSessionId?: string;
}

export interface CancelTimerPayload {
  timerSessionId?: string;
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
