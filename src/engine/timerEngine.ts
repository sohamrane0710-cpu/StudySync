import type {
  ModeDefinition,
  StepDefinition,
  TimerEvent,
  TimerListener,
  TimerSnapshot,
  TimerState,
} from '../types/timer';
import type {
  ActiveRunRecovery,
  SessionOutcome,
  SessionRecord,
  SessionSegment,
} from '../types/session';
import { type IClock, SystemClock } from './clock';

export interface TimerEngineOptions {
  clock?: IClock;
  onSessionRecordFinalized?: (record: SessionRecord) => void;
  onRecoveryStateChanged?: (recovery: ActiveRunRecovery | null) => void;
}

/**
 * Deep clone utility to guarantee immutable snapshots of ModeDefinition
 */
export function cloneMode(mode: ModeDefinition): ModeDefinition {
  return {
    id: mode.id,
    name: mode.name,
    description: mode.description,
    loopCount: mode.loopCount,
    isBuiltIn: mode.isBuiltIn,
    steps: mode.steps.map((step) => ({
      id: step.id,
      type: step.type,
      label: step.label,
      durationSeconds: step.durationSeconds,
    })),
  };
}

export class TimerEngine {
  private clock: IClock;
  private state: TimerState = 'idle';
  private mode: ModeDefinition;
  private sessionLabel: string = '#Study_Session';

  private currentStepIndex: number = 0;
  private currentLoop: number = 1;
  private remainingSeconds: number = 0;
  private targetDeadline: number | null = null; // Milliseconds timestamp

  // Accounting fields
  private sessionId: string = '';
  private sessionStartedAt: number = 0;
  private sessionEndedAt: number = 0;
  private currentStepStartedAt: number = 0;
  private stepElapsedSeconds: number = 0; // Accumulated active seconds in current step before pause
  private lastStepSegmentStartTime: number = 0; // When current segment chunk resumed

  private accumulatedFocusSeconds: number = 0;
  private accumulatedRestSeconds: number = 0;
  private completedIntervals: number = 0;
  private segments: SessionSegment[] = [];
  private isFinalized: boolean = false;

  private listeners: Set<TimerListener> = new Set();
  private onSessionRecordFinalized?: (record: SessionRecord) => void;
  private onRecoveryStateChanged?: (recovery: ActiveRunRecovery | null) => void;

  constructor(initialMode: ModeDefinition, options?: TimerEngineOptions) {
    this.clock = options?.clock ?? new SystemClock();
    this.onSessionRecordFinalized = options?.onSessionRecordFinalized;
    this.onRecoveryStateChanged = options?.onRecoveryStateChanged;

    this.mode = cloneMode(initialMode);
    this.initStep(0);
  }

  public subscribe(listener: TimerListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(event: TimerEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in timer listener:', err);
      }
    }
  }

  public getState(): TimerState {
    return this.state;
  }

  public getSessionLabel(): string {
    return this.sessionLabel;
  }

  public setSessionLabel(label: string): void {
    const sanitized = label.trim().slice(0, 50) || '#Study_Session';
    this.sessionLabel = sanitized;
    this.emitRecovery();
  }

  public getMode(): ModeDefinition {
    return cloneMode(this.mode);
  }

  public getCurrentStep(): StepDefinition {
    return this.mode.steps[this.currentStepIndex];
  }

  public getSnapshot(): TimerSnapshot {
    const currentStep = this.getCurrentStep();
    const totalStepSecs = currentStep.durationSeconds;
    const elapsedStepSecs = Math.max(0, totalStepSecs - this.remainingSeconds);
    const progress = totalStepSecs > 0 ? Math.min(1, elapsedStepSecs / totalStepSecs) : 0;

    const totalPlannedIntervals =
      this.mode.loopCount === 0
        ? 0
        : this.mode.loopCount * this.mode.steps.filter((s) => s.type === 'focus').length;

    const currentStepActiveFocus =
      currentStep.type === 'focus'
        ? this.stepElapsedSeconds + this.calculateActiveSegmentElapsed()
        : 0;

    return {
      state: this.state,
      mode: cloneMode(this.mode),
      sessionLabel: this.sessionLabel,
      currentStepIndex: this.currentStepIndex,
      currentStep: { ...currentStep },
      currentLoop: this.currentLoop,
      totalLoops: this.mode.loopCount,
      remainingSeconds: this.remainingSeconds,
      totalStepSeconds: totalStepSecs,
      elapsedStepSeconds: elapsedStepSecs,
      progress,
      accumulatedFocusSeconds: this.accumulatedFocusSeconds + currentStepActiveFocus,
      completedIntervals: this.completedIntervals,
      totalPlannedIntervals,
    };
  }

  /**
   * Loads a new mode definition. Can only be done when idle or after run completion.
   */
  public loadMode(newMode: ModeDefinition): void {
    if (this.state === 'running' || this.state === 'paused') {
      throw new Error('Cannot change mode while a session is active. Stop or reset first.');
    }
    this.mode = cloneMode(newMode);
    this.currentStepIndex = 0;
    this.currentLoop = 1;
    this.state = 'idle';
    this.initStep(0);
  }

  private initStep(index: number): void {
    this.currentStepIndex = index;
    const step = this.mode.steps[index];
    this.remainingSeconds = step.durationSeconds;
    this.stepElapsedSeconds = 0;
    this.lastStepSegmentStartTime = 0;
    this.targetDeadline = null;
  }

  /**
   * Starts a new session or starts from idle.
   */
  public start(modeOverride?: ModeDefinition, sessionLabel?: string): void {
    if (this.state === 'running') {
      return;
    }

    if (modeOverride) {
      this.mode = cloneMode(modeOverride);
    }
    if (sessionLabel) {
      this.sessionLabel = sessionLabel.trim().slice(0, 50) || '#Study_Session';
    }

    const now = this.clock.now();
    const wallNow = this.clock.wallTime();

    this.sessionId = `session_${wallNow}_${Math.random().toString(36).slice(2, 8)}`;
    this.sessionStartedAt = wallNow;
    this.sessionEndedAt = 0;
    this.isFinalized = false;
    this.accumulatedFocusSeconds = 0;
    this.accumulatedRestSeconds = 0;
    this.completedIntervals = 0;
    this.segments = [];

    this.currentStepIndex = 0;
    this.currentLoop = 1;
    const step = this.mode.steps[0];
    this.remainingSeconds = step.durationSeconds;
    this.stepElapsedSeconds = 0;
    this.currentStepStartedAt = wallNow;
    this.lastStepSegmentStartTime = now;
    this.targetDeadline = now + this.remainingSeconds * 1000;
    this.state = 'running';

    this.emitRecovery();
    this.emit({ type: 'tick', snapshot: this.getSnapshot() });
  }

  /**
   * Pauses an active run.
   */
  public pause(): void {
    if (this.state !== 'running') {
      return;
    }

    const now = this.clock.now();
    if (this.targetDeadline !== null) {
      // Calculate exact remaining seconds from deadline
      this.remainingSeconds = Math.max(0, Math.ceil((this.targetDeadline - now) / 1000));
    }

    // Accumulate elapsed time up to pause
    const chunkElapsed = Math.max(0, Math.floor((now - this.lastStepSegmentStartTime) / 1000));
    this.stepElapsedSeconds += chunkElapsed;
    this.lastStepSegmentStartTime = 0;
    this.targetDeadline = null;
    this.state = 'paused';

    this.emitRecovery();
    this.emit({ type: 'tick', snapshot: this.getSnapshot() });
  }

  /**
   * Resumes a paused run.
   */
  public resume(): void {
    if (this.state !== 'paused') {
      return;
    }

    const now = this.clock.now();
    this.lastStepSegmentStartTime = now;
    this.targetDeadline = now + this.remainingSeconds * 1000;
    this.state = 'running';

    this.emitRecovery();
    this.emit({ type: 'tick', snapshot: this.getSnapshot() });
  }

  /**
   * Calculates the seconds elapsed in the current step segment since last resume.
   */
  private calculateActiveSegmentElapsed(): number {
    if (this.state !== 'running' || this.lastStepSegmentStartTime === 0) {
      return 0;
    }
    const now = this.clock.now();
    return Math.max(0, Math.floor((now - this.lastStepSegmentStartTime) / 1000));
  }

  /**
   * Resets the current interval back to its initial full duration.
   * Does NOT double-count previously credited time or change completed intervals.
   */
  public resetCurrentStep(): void {
    if (this.state === 'idle' || this.state === 'completed' || this.state === 'stopped') {
      return;
    }

    const step = this.getCurrentStep();
    this.remainingSeconds = step.durationSeconds;
    this.stepElapsedSeconds = 0;

    const now = this.clock.now();
    const wallNow = this.clock.wallTime();
    this.currentStepStartedAt = wallNow;

    if (this.state === 'running') {
      this.lastStepSegmentStartTime = now;
      this.targetDeadline = now + step.durationSeconds * 1000;
    } else {
      this.lastStepSegmentStartTime = 0;
      this.targetDeadline = null;
    }

    this.emitRecovery();
    this.emit({ type: 'tick', snapshot: this.getSnapshot() });
  }

  /**
   * Restarts the entire sequence from step 1, loop 1.
   */
  public restartSequence(): void {
    if (this.state === 'idle') {
      return;
    }

    const now = this.clock.now();
    const wallNow = this.clock.wallTime();

    // Reset accounting for this session
    this.accumulatedFocusSeconds = 0;
    this.accumulatedRestSeconds = 0;
    this.completedIntervals = 0;
    this.segments = [];
    this.sessionStartedAt = wallNow;

    this.currentStepIndex = 0;
    this.currentLoop = 1;
    const step = this.mode.steps[0];
    this.remainingSeconds = step.durationSeconds;
    this.stepElapsedSeconds = 0;
    this.currentStepStartedAt = wallNow;

    if (this.state === 'running') {
      this.lastStepSegmentStartTime = now;
      this.targetDeadline = now + step.durationSeconds * 1000;
    } else {
      this.lastStepSegmentStartTime = 0;
      this.targetDeadline = null;
      this.state = 'idle';
    }

    this.emitRecovery();
    this.emit({ type: 'tick', snapshot: this.getSnapshot() });
  }

  /**
   * Skips / advances to the next step immediately.
   * Credits only the actual elapsed focus time in the skipped step.
   */
  public advanceStep(): void {
    if (this.state !== 'running' && this.state !== 'paused') {
      return;
    }

    const currentStep = this.getCurrentStep();
    const wallNow = this.clock.wallTime();
    const activeSecs = this.stepElapsedSeconds + this.calculateActiveSegmentElapsed();
    const actualSecs = Math.min(currentStep.durationSeconds, Math.max(0, activeSecs));

    // Record segment as skipped (completed: false)
    this.recordSegment(currentStep, actualSecs, false, this.currentStepStartedAt, wallNow);

    if (currentStep.type === 'focus') {
      this.accumulatedFocusSeconds += actualSecs;
    } else {
      this.accumulatedRestSeconds += actualSecs;
    }

    this.transitionToNextStep();
  }

  /**
   * Stops the active session, preserves legitimate focus earned so far,
   * finalizes the session record with outcome 'stopped', and returns to stopped/idle.
   */
  public stopAndSave(): SessionRecord | null {
    if (this.state === 'idle') {
      return null;
    }

    if (this.state === 'completed' || this.state === 'stopped') {
      return null;
    }

    const currentStep = this.getCurrentStep();
    const wallNow = this.clock.wallTime();
    const activeSecs = this.stepElapsedSeconds + this.calculateActiveSegmentElapsed();
    const actualSecs = Math.min(currentStep.durationSeconds, Math.max(0, activeSecs));

    if (actualSecs > 0) {
      this.recordSegment(currentStep, actualSecs, false, this.currentStepStartedAt, wallNow);
      if (currentStep.type === 'focus') {
        this.accumulatedFocusSeconds += actualSecs;
      } else {
        this.accumulatedRestSeconds += actualSecs;
      }
    }

    this.state = 'stopped';
    this.targetDeadline = null;
    this.lastStepSegmentStartTime = 0;
    this.sessionEndedAt = wallNow;

    const record = this.finalizeRecord('stopped');
    this.clearRecovery();

    this.emit({
      type: 'session_stopped',
      totalFocusSeconds: this.accumulatedFocusSeconds,
      completedIntervals: this.completedIntervals,
      snapshot: this.getSnapshot(),
    });

    return record;
  }

  /**
   * Processes elapsed deadlines. This is the heart of the deadline engine.
   * Handles catching up across background sleep/tab throttling.
   */
  public tick(): void {
    if (this.state !== 'running' || this.targetDeadline === null) {
      return;
    }

    const now = this.clock.now();

    // Check if target deadline is reached or passed
    while (this.targetDeadline !== null && now >= this.targetDeadline && this.state === 'running') {
      // Step completed naturally!
      const completedStep = this.getCurrentStep();
      const wallNow = this.clock.wallTime();
      const fullDuration = completedStep.durationSeconds;

      this.recordSegment(completedStep, fullDuration, true, this.currentStepStartedAt, wallNow);

      if (completedStep.type === 'focus') {
        this.accumulatedFocusSeconds += fullDuration;
        this.completedIntervals++;
      } else {
        this.accumulatedRestSeconds += fullDuration;
      }

      this.emit({
        type: 'step_completed',
        step: completedStep,
        actualFocusEarned: completedStep.type === 'focus' ? fullDuration : 0,
        snapshot: this.getSnapshot(),
      });

      // Advance step deadline chronologically to support catch-up across sleep
      const prevDeadline = this.targetDeadline;
      this.transitionToNextStep(prevDeadline);
    }

    if (this.state === 'running' && this.targetDeadline !== null) {
      this.remainingSeconds = Math.max(0, Math.ceil((this.targetDeadline - now) / 1000));
      this.emitRecovery();
      this.emit({ type: 'tick', snapshot: this.getSnapshot() });
    }
  }

  private transitionToNextStep(fromDeadline?: number): void {
    const prevStep = this.getCurrentStep();
    const nextStepIndex = this.currentStepIndex + 1;
    let isLoopAdvance = false;

    if (nextStepIndex < this.mode.steps.length) {
      this.currentStepIndex = nextStepIndex;
    } else {
      // Reached end of sequence
      if (this.mode.loopCount > 0 && this.currentLoop >= this.mode.loopCount) {
        // Sequence fully completed!
        this.state = 'completed';
        this.targetDeadline = null;
        this.remainingSeconds = 0;
        this.sessionEndedAt = this.clock.wallTime();

        this.finalizeRecord('completed');
        this.clearRecovery();

        this.emit({
          type: 'session_completed',
          totalFocusSeconds: this.accumulatedFocusSeconds,
          completedIntervals: this.completedIntervals,
          snapshot: this.getSnapshot(),
        });
        return;
      }

      // Loop continues
      this.currentStepIndex = 0;
      this.currentLoop++;
      isLoopAdvance = true;
    }

    const nextStep = this.getCurrentStep();
    const now = this.clock.now();
    const wallNow = this.clock.wallTime();
    const baseTime = fromDeadline !== undefined ? fromDeadline : now;

    this.remainingSeconds = nextStep.durationSeconds;
    this.stepElapsedSeconds = 0;
    this.currentStepStartedAt = wallNow - (now - baseTime);

    if (this.state === 'running') {
      this.targetDeadline = baseTime + nextStep.durationSeconds * 1000;
      this.lastStepSegmentStartTime = baseTime;
    } else {
      this.targetDeadline = null;
      this.lastStepSegmentStartTime = 0;
    }

    this.emitRecovery();
    this.emit({
      type: 'step_change',
      previousStep: prevStep,
      nextStep,
      isLoopAdvance,
      snapshot: this.getSnapshot(),
    });
  }

  private recordSegment(
    step: StepDefinition,
    actualSeconds: number,
    completed: boolean,
    startedAt: number,
    endedAt: number,
  ): void {
    this.segments.push({
      stepId: step.id,
      type: step.type,
      label: step.label,
      plannedSeconds: step.durationSeconds,
      actualSeconds,
      completed,
      startedAt,
      endedAt,
    });
  }

  private finalizeRecord(outcome: SessionOutcome): SessionRecord {
    if (this.isFinalized) {
      throw new Error('Session is already finalized.');
    }
    this.isFinalized = true;

    const totalPlannedIntervals =
      this.mode.loopCount === 0
        ? 0
        : this.mode.loopCount * this.mode.steps.filter((s) => s.type === 'focus').length;

    const record: SessionRecord = {
      id: this.sessionId,
      sessionLabel: this.sessionLabel,
      modeId: this.mode.id,
      modeName: this.mode.name,
      modeSnapshot: cloneMode(this.mode),
      startedAt: this.sessionStartedAt,
      endedAt: this.sessionEndedAt || this.clock.wallTime(),
      totalFocusSeconds: this.accumulatedFocusSeconds,
      totalRestSeconds: this.accumulatedRestSeconds,
      completedIntervals: this.completedIntervals,
      totalPlannedIntervals,
      outcome,
      segments: [...this.segments],
    };

    if (this.onSessionRecordFinalized) {
      try {
        this.onSessionRecordFinalized(record);
      } catch (err) {
        console.error('Error notifying finalized session record:', err);
      }
    }

    return record;
  }

  private emitRecovery(): void {
    if (this.state !== 'running' && this.state !== 'paused') {
      return;
    }
    const recovery: ActiveRunRecovery = {
      sessionId: this.sessionId,
      sessionLabel: this.sessionLabel,
      modeSnapshot: cloneMode(this.mode),
      currentStepIndex: this.currentStepIndex,
      currentLoop: this.currentLoop,
      state: this.state,
      remainingSeconds: this.remainingSeconds,
      targetDeadline: this.targetDeadline,
      startedAt: this.sessionStartedAt,
      lastTickTimestamp: this.clock.wallTime(),
      accumulatedFocusSeconds: this.accumulatedFocusSeconds,
      accumulatedRestSeconds: this.accumulatedRestSeconds,
      completedIntervals: this.completedIntervals,
      segments: [...this.segments],
      currentStepStartedAt: this.currentStepStartedAt,
    };
    if (this.onRecoveryStateChanged) {
      this.onRecoveryStateChanged(recovery);
    }
  }

  private clearRecovery(): void {
    if (this.onRecoveryStateChanged) {
      this.onRecoveryStateChanged(null);
    }
  }

  public getRecoveryState(): ActiveRunRecovery | null {
    if (this.state !== 'running' && this.state !== 'paused') {
      return null;
    }
    return {
      sessionId: this.sessionId,
      sessionLabel: this.sessionLabel,
      modeSnapshot: cloneMode(this.mode),
      currentStepIndex: this.currentStepIndex,
      currentLoop: this.currentLoop,
      state: this.state,
      remainingSeconds: this.remainingSeconds,
      targetDeadline: this.targetDeadline,
      startedAt: this.sessionStartedAt,
      lastTickTimestamp: this.clock.wallTime(),
      accumulatedFocusSeconds: this.accumulatedFocusSeconds,
      accumulatedRestSeconds: this.accumulatedRestSeconds,
      completedIntervals: this.completedIntervals,
      segments: [...this.segments],
      currentStepStartedAt: this.currentStepStartedAt,
    };
  }

  /**
   * Recovers an in-progress or paused session from persisted state.
   */
  public recover(recovery: ActiveRunRecovery): boolean {
    if (!recovery || !recovery.modeSnapshot || !recovery.sessionId) {
      return false;
    }

    this.sessionId = recovery.sessionId;
    this.sessionLabel = recovery.sessionLabel || '#Study_Session';
    this.mode = cloneMode(recovery.modeSnapshot);
    this.currentStepIndex = recovery.currentStepIndex;
    this.currentLoop = recovery.currentLoop;
    this.sessionStartedAt = recovery.startedAt;
    this.accumulatedFocusSeconds = recovery.accumulatedFocusSeconds;
    this.accumulatedRestSeconds = recovery.accumulatedRestSeconds;
    this.completedIntervals = recovery.completedIntervals;
    this.segments = [...recovery.segments];
    this.currentStepStartedAt = recovery.currentStepStartedAt;
    this.isFinalized = false;

    if (recovery.state === 'paused') {
      this.state = 'paused';
      this.remainingSeconds = recovery.remainingSeconds;
      this.stepElapsedSeconds = Math.max(
        0,
        this.getCurrentStep().durationSeconds - recovery.remainingSeconds,
      );
      this.lastStepSegmentStartTime = 0;
      this.targetDeadline = null;
    } else {
      // Recovering a running session
      this.state = 'running';
      const now = this.clock.now();

      if (recovery.targetDeadline !== null && now < recovery.targetDeadline) {
        // Still within current step's target deadline
        this.targetDeadline = recovery.targetDeadline;
        this.remainingSeconds = Math.max(0, Math.ceil((recovery.targetDeadline - now) / 1000));
        this.lastStepSegmentStartTime = now;
      } else {
        // Step deadline expired while away, let tick catch up!
        this.targetDeadline = recovery.targetDeadline ?? now;
        this.lastStepSegmentStartTime = now;
        this.tick();
      }
    }

    this.emit({ type: 'tick', snapshot: this.getSnapshot() });
    return true;
  }
}
