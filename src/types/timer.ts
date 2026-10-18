export type TimerState = 'idle' | 'running' | 'paused' | 'completed' | 'stopped';

export type StepType = 'focus' | 'rest';

export interface StepDefinition {
  id: string;
  type: StepType;
  label: string;
  durationSeconds: number; // Duration in seconds
}

export interface ModeDefinition {
  id: string;
  name: string;
  description: string;
  steps: StepDefinition[];
  loopCount: number; // 1..N, or 0 for infinite looping
  isBuiltIn: boolean;
}

export interface TimerSnapshot {
  state: TimerState;
  mode: ModeDefinition;
  sessionLabel: string;
  currentStepIndex: number;
  currentStep: StepDefinition;
  currentLoop: number;
  totalLoops: number; // 0 represents infinite
  remainingSeconds: number;
  totalStepSeconds: number;
  elapsedStepSeconds: number;
  progress: number; // 0.0 to 1.0 (elapsed / total)
  accumulatedFocusSeconds: number;
  completedIntervals: number;
  totalPlannedIntervals: number; // 0 if infinite
}

export type TimerEventType =
  | 'tick'
  | 'step_change'
  | 'step_completed'
  | 'session_completed'
  | 'session_stopped';

export type TimerEvent =
  | { type: 'tick'; snapshot: TimerSnapshot }
  | {
    type: 'step_change';
    previousStep: StepDefinition;
    nextStep: StepDefinition;
    isLoopAdvance: boolean;
    snapshot: TimerSnapshot;
  }
  | {
    type: 'step_completed';
    step: StepDefinition;
    actualFocusEarned: number;
    snapshot: TimerSnapshot;
  }
  | {
    type: 'session_completed';
    totalFocusSeconds: number;
    completedIntervals: number;
    snapshot: TimerSnapshot;
  }
  | {
    type: 'session_stopped';
    totalFocusSeconds: number;
    completedIntervals: number;
    snapshot: TimerSnapshot;
  };

export type TimerListener = (event: TimerEvent) => void;
