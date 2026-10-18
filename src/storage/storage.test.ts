import { describe, it, expect, beforeEach } from 'vitest';
import { IndexedDBStorage } from './indexedDBStorage';
import type { SessionRecord, ActiveRunRecovery } from '../types/session';
import type { ModeDefinition } from '../types/timer';

describe('IndexedDBStorage Unit Tests', () => {
  let storage: IndexedDBStorage;

  const mockSession: SessionRecord = {
    id: 's_test_1',
    sessionLabel: '#Test_Storage',
    modeId: 'classic_pomodoro',
    modeName: 'Classic Pomodoro',
    modeSnapshot: {
      id: 'classic_pomodoro',
      name: 'Classic Pomodoro',
      description: 'Pomodoro',
      loopCount: 4,
      isBuiltIn: true,
      steps: [
        { id: '1', type: 'focus', label: 'Focus', durationSeconds: 1500 },
        { id: '2', type: 'rest', label: 'Rest', durationSeconds: 300 },
      ],
    },
    startedAt: 1700000000000,
    endedAt: 1700001500000,
    totalFocusSeconds: 1500,
    totalRestSeconds: 0,
    completedIntervals: 1,
    totalPlannedIntervals: 4,
    outcome: 'completed',
    segments: [],
  };

  beforeEach(async () => {
    storage = new IndexedDBStorage();
    await storage.clearSessions();
  });

  it('saves and retrieves sessions with filtering', async () => {
    await storage.saveSession(mockSession);

    const interruptedSession: SessionRecord = {
      ...mockSession,
      id: 's_test_2',
      outcome: 'stopped',
      startedAt: 1700002000000,
    };
    await storage.saveSession(interruptedSession);

    const allSessions = await storage.getSessions('all');
    expect(allSessions).toHaveLength(2);
    // Should be sorted descending by startedAt
    expect(allSessions[0].id).toBe('s_test_2');

    const completed = await storage.getSessions('completed');
    expect(completed).toHaveLength(1);
    expect(completed[0].id).toBe('s_test_1');

    const interrupted = await storage.getSessions('interrupted');
    expect(interrupted).toHaveLength(1);
    expect(interrupted[0].id).toBe('s_test_2');
  });

  it('clears sessions and recovery states cleanly', async () => {
    await storage.saveSession(mockSession);
    const initial = await storage.getSessions();
    expect(initial).toHaveLength(1);

    await storage.clearSessions();
    const afterClear = await storage.getSessions();
    expect(afterClear).toHaveLength(0);
  });

  it('persists and manages custom modes', async () => {
    const customMode: ModeDefinition = {
      id: 'custom_test_1',
      name: 'My Custom Mode',
      description: 'Custom',
      loopCount: 2,
      isBuiltIn: false,
      steps: [{ id: 'c1', type: 'focus', label: 'Focus', durationSeconds: 1200 }],
    };

    await storage.saveCustomMode(customMode);
    const modes = await storage.getCustomModes();
    expect(modes.some((m) => m.id === 'custom_test_1')).toBe(true);

    await storage.deleteCustomMode('custom_test_1');
    const afterDelete = await storage.getCustomModes();
    expect(afterDelete.some((m) => m.id === 'custom_test_1')).toBe(false);
  });

  it('persists preferences and recovery tokens', async () => {
    await storage.savePreferences({ chimesEnabled: false, chimeVolume: 0.3 });
    const prefs = await storage.getPreferences();
    expect(prefs.chimesEnabled).toBe(false);
    expect(prefs.chimeVolume).toBe(0.3);

    const recoveryToken: ActiveRunRecovery = {
      sessionId: 's_recover_1',
      sessionLabel: '#Recovery',
      modeSnapshot: mockSession.modeSnapshot,
      currentStepIndex: 0,
      currentLoop: 1,
      state: 'running',
      remainingSeconds: 500,
      targetDeadline: 1700003000000,
      startedAt: 1700002500000,
      lastTickTimestamp: 1700002600000,
      accumulatedFocusSeconds: 1000,
      accumulatedRestSeconds: 0,
      completedIntervals: 0,
      segments: [],
      currentStepStartedAt: 1700002500000,
    };

    await storage.saveRecoveryState(recoveryToken);
    const retrievedRecovery = await storage.getRecoveryState();
    expect(retrievedRecovery?.sessionId).toBe('s_recover_1');

    await storage.saveRecoveryState(null);
    const clearedRecovery = await storage.getRecoveryState();
    expect(clearedRecovery).toBeNull();
  });
});
