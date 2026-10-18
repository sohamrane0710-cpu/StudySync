import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TimerEngine, cloneMode } from './timerEngine';
import { SimulatedClock } from './clock';
import type { ModeDefinition } from '../types/timer';
import type { SessionRecord } from '../types/session';

describe('TimerEngine Unit Tests', () => {
  let clock: SimulatedClock;
  let testMode: ModeDefinition;

  beforeEach(() => {
    clock = new SimulatedClock(1000000);
    testMode = {
      id: 'test_pomodoro',
      name: 'Test Pomodoro',
      description: 'Test mode with 2 focus intervals and 1 rest',
      loopCount: 1,
      isBuiltIn: true,
      steps: [
        { id: 'f1', type: 'focus', label: 'Focus 1', durationSeconds: 25 * 60 },
        { id: 'r1', type: 'rest', label: 'Short Rest', durationSeconds: 5 * 60 },
        { id: 'f2', type: 'focus', label: 'Focus 2', durationSeconds: 25 * 60 },
      ],
    };
  });

  it('initializes in idle state with correct initial step snapshot', () => {
    const engine = new TimerEngine(testMode, { clock });
    const snap = engine.getSnapshot();

    expect(snap.state).toBe('idle');
    expect(snap.currentStepIndex).toBe(0);
    expect(snap.remainingSeconds).toBe(25 * 60);
    expect(snap.progress).toBe(0);
    expect(snap.accumulatedFocusSeconds).toBe(0);
    expect(snap.completedIntervals).toBe(0);
    expect(snap.totalPlannedIntervals).toBe(2);
  });

  it('starts and calculates remaining time accurately against deadline', () => {
    const engine = new TimerEngine(testMode, { clock });
    engine.start();

    expect(engine.getState()).toBe('running');

    // Advance 60 seconds
    clock.advance(60 * 1000);
    engine.tick();

    const snap = engine.getSnapshot();
    expect(snap.remainingSeconds).toBe(24 * 60);
    expect(snap.elapsedStepSeconds).toBe(60);
    expect(snap.accumulatedFocusSeconds).toBe(60);
  });

  it('pauses, freezes remaining time, and does not credit focus while paused', () => {
    const engine = new TimerEngine(testMode, { clock });
    engine.start();

    // Run for 30 seconds
    clock.advance(30 * 1000);
    engine.tick();

    engine.pause();
    expect(engine.getState()).toBe('paused');
    expect(engine.getSnapshot().remainingSeconds).toBe(25 * 60 - 30);

    // Clock advances 500 seconds while paused!
    clock.advance(500 * 1000);
    engine.tick();

    // Remaining seconds must remain frozen!
    expect(engine.getSnapshot().remainingSeconds).toBe(25 * 60 - 30);
    // Paused duration earns NO focus credit!
    expect(engine.getSnapshot().accumulatedFocusSeconds).toBe(30);

    // Resume
    engine.resume();
    expect(engine.getState()).toBe('running');

    clock.advance(10 * 1000);
    engine.tick();
    expect(engine.getSnapshot().remainingSeconds).toBe(25 * 60 - 40);
    expect(engine.getSnapshot().accumulatedFocusSeconds).toBe(40);
  });

  it('transitions from focus to rest when step completes naturally', () => {
    const onFinalized = vi.fn();
    const engine = new TimerEngine(testMode, { clock, onSessionRecordFinalized: onFinalized });
    engine.start();

    // Advance to end of focus step 1 (25 minutes)
    clock.advance(25 * 60 * 1000);
    engine.tick();

    const snap = engine.getSnapshot();
    expect(snap.currentStepIndex).toBe(1);
    expect(snap.currentStep.type).toBe('rest');
    expect(snap.remainingSeconds).toBe(5 * 60);
    expect(snap.completedIntervals).toBe(1);
    expect(snap.accumulatedFocusSeconds).toBe(25 * 60);
    expect(onFinalized).not.toHaveBeenCalled();
  });

  it('catches up across background sleep / multi-step suspension', () => {
    const onFinalized = vi.fn();
    const engine = new TimerEngine(testMode, { clock, onSessionRecordFinalized: onFinalized });
    engine.start();

    // Simulate system sleep: 35 minutes pass in a single leap!
    // Step 1: 25m focus (completes)
    // Step 2: 5m rest (completes)
    // Step 3: 25m focus (5 minutes in)
    clock.advance(35 * 60 * 1000);
    engine.tick();

    const snap = engine.getSnapshot();
    expect(snap.currentStepIndex).toBe(2);
    expect(snap.currentStep.type).toBe('focus');
    expect(snap.remainingSeconds).toBe(20 * 60);
    expect(snap.completedIntervals).toBe(1);
    // Focus credit: 25m from step 1 + 5m from step 3 = 30m total (rest gave 0)
    expect(snap.accumulatedFocusSeconds).toBe(30 * 60);
  });

  it('skips a focus step, crediting only eligible elapsed focus seconds', () => {
    const engine = new TimerEngine(testMode, { clock });
    engine.start();

    // Work for 10 minutes then skip
    clock.advance(10 * 60 * 1000);
    engine.tick();
    engine.advanceStep();

    const snap = engine.getSnapshot();
    expect(snap.currentStepIndex).toBe(1); // Now on rest
    expect(snap.accumulatedFocusSeconds).toBe(10 * 60);
    expect(snap.completedIntervals).toBe(0); // Skipped does not count as completed full interval
  });

  it('resets current step without double-counting past time', () => {
    const engine = new TimerEngine(testMode, { clock });
    engine.start();

    clock.advance(10 * 60 * 1000);
    engine.tick();
    expect(engine.getSnapshot().remainingSeconds).toBe(15 * 60);

    // Reset current interval
    engine.resetCurrentStep();
    const snap = engine.getSnapshot();
    expect(snap.remainingSeconds).toBe(25 * 60);
    expect(snap.accumulatedFocusSeconds).toBe(0); // partial elapsed reset
  });

  it('restarts sequence cleanly from beginning', () => {
    const engine = new TimerEngine(testMode, { clock });
    engine.start();

    // Complete step 1
    clock.advance(25 * 60 * 1000);
    engine.tick();
    expect(engine.getSnapshot().currentStepIndex).toBe(1);

    // Restart sequence
    engine.restartSequence();
    const snap = engine.getSnapshot();
    expect(snap.currentStepIndex).toBe(0);
    expect(snap.remainingSeconds).toBe(25 * 60);
    expect(snap.accumulatedFocusSeconds).toBe(0);
    expect(snap.completedIntervals).toBe(0);
  });

  it('stops and saves active session preserving legitimate focus and finalizing once', () => {
    let finalizedRecord: SessionRecord | null = null;
    const engine = new TimerEngine(testMode, {
      clock,
      onSessionRecordFinalized: (rec) => {
        finalizedRecord = rec;
      },
    });

    engine.start(undefined, '#My_Project');
    clock.advance(15 * 60 * 1000);
    engine.tick();

    const record = engine.stopAndSave();
    expect(engine.getState()).toBe('stopped');
    expect(record).not.toBeNull();
    expect(record?.totalFocusSeconds).toBe(15 * 60);
    expect(record?.outcome).toBe('stopped');
    expect(record?.sessionLabel).toBe('#My_Project');
    expect(finalizedRecord).toBe(record);

    // Second stop does nothing and does not double-finalize
    const secondRecord = engine.stopAndSave();
    expect(secondRecord).toBeNull();
  });

  it('completes entire sequence and generates completed session record', () => {
    let finalizedRecord: SessionRecord | null = null;
    const engine = new TimerEngine(testMode, {
      clock,
      onSessionRecordFinalized: (rec) => {
        finalizedRecord = rec;
      },
    });

    engine.start();
    // Complete step 1 (25m), step 2 (5m), step 3 (25m) = 55m total
    clock.advance(55 * 60 * 1000);
    engine.tick();

    expect(engine.getState()).toBe('completed');
    expect(finalizedRecord).not.toBeNull();
    expect(finalizedRecord!.outcome).toBe('completed');
    expect(finalizedRecord!.totalFocusSeconds).toBe(50 * 60);
    expect(finalizedRecord!.totalRestSeconds).toBe(5 * 60);
    expect(finalizedRecord!.completedIntervals).toBe(2);
  });

  it('supports infinite looping when loopCount is 0', () => {
    const infiniteMode: ModeDefinition = {
      id: 'inf_mode',
      name: 'Infinite Mode',
      description: 'Loop indefinitely',
      loopCount: 0,
      isBuiltIn: false,
      steps: [
        { id: 's1', type: 'focus', label: 'Sprint', durationSeconds: 10 * 60 },
        { id: 's2', type: 'rest', label: 'Rest', durationSeconds: 2 * 60 },
      ],
    };

    const engine = new TimerEngine(infiniteMode, { clock });
    engine.start();

    // Run 5 full loops (5 * 12 minutes = 60 minutes)
    for (let i = 0; i < 5; i++) {
      clock.advance(12 * 60 * 1000);
      engine.tick();
    }

    const snap = engine.getSnapshot();
    expect(snap.state).toBe('running');
    expect(snap.currentLoop).toBe(6);
    expect(snap.completedIntervals).toBe(5);
    expect(snap.accumulatedFocusSeconds).toBe(50 * 60);
  });

  it('guarantees immutable mode snapshots during run', () => {
    const mutableMode = cloneMode(testMode);
    const engine = new TimerEngine(mutableMode, { clock });
    engine.start();

    // Mutate the original object externally
    mutableMode.steps[0].durationSeconds = 9999;
    mutableMode.steps[0].label = 'Mutated Externally';

    // Engine's snapshot must remain pristine and uncorrupted
    const snap = engine.getSnapshot();
    expect(snap.currentStep.durationSeconds).toBe(25 * 60);
    expect(snap.currentStep.label).toBe('Focus 1');
  });

  it('recovers accurately from paused and running states', () => {
    const engine = new TimerEngine(testMode, { clock });
    engine.start(undefined, '#RecoverTest');
    clock.advance(10 * 60 * 1000);
    engine.tick();
    engine.pause();

    const recoveryState = engine.getRecoveryState();
    expect(recoveryState).not.toBeNull();

    // Reconstruct on a new engine instance
    const recoveredEngine = new TimerEngine(testMode, { clock });
    const success = recoveredEngine.recover(recoveryState!);

    expect(success).toBe(true);
    expect(recoveredEngine.getState()).toBe('paused');
    expect(recoveredEngine.getSnapshot().remainingSeconds).toBe(15 * 60);
    expect(recoveredEngine.getSessionLabel()).toBe('#RecoverTest');
  });
});
