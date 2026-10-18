import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import type { ModeDefinition, TimerSnapshot, TimerEvent } from '../types/timer';
import type { SessionRecord } from '../types/session';
import type { UserPreferences, IStudySyncStorage } from '../types/storage';
import { DEFAULT_PREFERENCES } from '../types/storage';
import { TimerEngine } from '../engine/timerEngine';
import { BUILT_IN_MODES } from '../services/modeService';
import { IndexedDBStorage } from '../storage/indexedDBStorage';
import { AudioService } from '../services/audioService';
import { calculateFocusStreak, type StreakResult } from '../utils/streak';

export interface TimerContextValue {
  snapshot: TimerSnapshot;
  allModes: ModeDefinition[];
  activeMode: ModeDefinition;
  sessions: SessionRecord[];
  streak: StreakResult;
  preferences: UserPreferences;
  summarySession: SessionRecord | null;

  start: () => void;
  pause: () => void;
  resume: () => void;
  skipStep: () => void;
  resetInterval: () => void;
  restartSequence: () => void;
  stopAndSave: () => void;
  setSessionLabel: (label: string) => void;
  selectMode: (modeId: string) => void;
  saveCustomMode: (mode: ModeDefinition) => Promise<void>;
  deleteCustomMode: (modeId: string) => Promise<void>;
  updatePreferences: (prefs: Partial<UserPreferences>) => Promise<void>;
  clearAllSessions: () => Promise<void>;
  closeSummaryModal: () => void;
}

const TimerContext = createContext<TimerContextValue | null>(null);

export interface TimerProviderProps {
  children: React.ReactNode;
  storage?: IStudySyncStorage;
  initialMode?: ModeDefinition;
}

export const TimerProvider: React.FC<TimerProviderProps> = ({
  children,
  storage: storageProp,
  initialMode,
}) => {
  const storageRef = useRef<IStudySyncStorage>(storageProp || new IndexedDBStorage());
  const storage = storageRef.current;

  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [customModes, setCustomModes] = useState<ModeDefinition[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [summarySession, setSummarySession] = useState<SessionRecord | null>(null);

  const defaultMode = initialMode || BUILT_IN_MODES[0];
  const engineRef = useRef<TimerEngine | null>(null);

  if (!engineRef.current) {
    engineRef.current = new TimerEngine(defaultMode, {
      onRecoveryStateChanged: (rec) => {
        storage.saveRecoveryState(rec).catch(() => { });
      },
      onSessionRecordFinalized: (record) => {
        setSummarySession(record);
        storage.saveSession(record).then(async () => {
          const updatedSessions = await storage.getSessions();
          setSessions(updatedSessions);
        }).catch(() => { });
      },
    });
  }
  const engine = engineRef.current;

  const [snapshot, setSnapshot] = useState<TimerSnapshot>(() => engine.getSnapshot());

  const allModes = [...BUILT_IN_MODES, ...customModes];
  const activeMode = engine.getMode();

  // Load preferences, custom modes, session records, and check for crash/reload recovery
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const [savedPrefs, savedModes, savedSessions, recovery] = await Promise.all([
          storage.getPreferences(),
          storage.getCustomModes(),
          storage.getSessions(),
          storage.getRecoveryState(),
        ]);

        if (!mounted) return;

        setPreferences(savedPrefs);
        setCustomModes(savedModes);
        setSessions(savedSessions);

        if (savedPrefs.sessionLabel) {
          engine.setSessionLabel(savedPrefs.sessionLabel);
        }

        // Apply mode from preferences if not recovering active run
        if (!recovery && savedPrefs.activeModeId) {
          const match = [...BUILT_IN_MODES, ...savedModes].find((m) => m.id === savedPrefs.activeModeId);
          if (match && engine.getState() === 'idle') {
            engine.loadMode(match);
          }
        }

        // Check if there is an active run recovery token
        if (recovery) {
          engine.recover(recovery);
        }

        setSnapshot(engine.getSnapshot());
      } catch (err) {
        console.warn('Error initializing StudySync storage state:', err);
      }
    }

    init();
    return () => {
      mounted = false;
    };
  }, [storage, engine]);

  // Subscribe to engine state changes and audio alerts
  useEffect(() => {
    const unsubscribe = engine.subscribe((event: TimerEvent) => {
      setSnapshot(event.snapshot);

      if (event.type === 'step_completed') {
        if (preferences.chimesEnabled) {
          if (event.step.type === 'focus') {
            AudioService.playFocusCompleteChime(preferences.chimeVolume);
          } else {
            AudioService.playRestCompleteChime(preferences.chimeVolume);
          }
        }
      } else if (event.type === 'session_completed') {
        if (preferences.chimesEnabled) {
          AudioService.playFocusCompleteChime(preferences.chimeVolume);
        }
      }
    });

    return () => unsubscribe();
  }, [engine, preferences.chimesEnabled, preferences.chimeVolume]);

  // Ticker: regular tick interval to calculate remaining time from deadline
  useEffect(() => {
    const timer = setInterval(() => {
      if (engine.getState() === 'running') {
        engine.tick();
      }
    }, 200);

    return () => clearInterval(timer);
  }, [engine]);

  // Ambient sound state sync
  useEffect(() => {
    if (preferences.ambientEnabled && preferences.ambientSound !== 'none') {
      if (
        preferences.ambientSound === 'rain' ||
        preferences.ambientSound === 'whitenoise' ||
        preferences.ambientSound === 'drone'
      ) {
        AudioService.startAmbient(preferences.ambientSound, preferences.ambientVolume);
      }
    } else {
      AudioService.stopAmbient();
    }
  }, [preferences.ambientEnabled, preferences.ambientSound, preferences.ambientVolume]);

  const streak = calculateFocusStreak(sessions);

  // Actions
  const start = useCallback(() => {
    engine.start();
    setSnapshot(engine.getSnapshot());
  }, [engine]);

  const pause = useCallback(() => {
    engine.pause();
    setSnapshot(engine.getSnapshot());
  }, [engine]);

  const resume = useCallback(() => {
    engine.resume();
    setSnapshot(engine.getSnapshot());
  }, [engine]);

  const skipStep = useCallback(() => {
    engine.advanceStep();
    setSnapshot(engine.getSnapshot());
  }, [engine]);

  const resetInterval = useCallback(() => {
    engine.resetCurrentStep();
    setSnapshot(engine.getSnapshot());
  }, [engine]);

  const restartSequence = useCallback(() => {
    engine.restartSequence();
    setSnapshot(engine.getSnapshot());
  }, [engine]);

  const stopAndSave = useCallback(() => {
    engine.stopAndSave();
    setSnapshot(engine.getSnapshot());
  }, [engine]);

  const setSessionLabel = useCallback(
    (label: string) => {
      engine.setSessionLabel(label);
      setSnapshot(engine.getSnapshot());
      storage.savePreferences({ sessionLabel: label }).catch(() => { });
    },
    [engine, storage],
  );

  const selectMode = useCallback(
    (modeId: string) => {
      if (engine.getState() === 'running' || engine.getState() === 'paused') {
        return;
      }
      const match = allModes.find((m) => m.id === modeId);
      if (match) {
        engine.loadMode(match);
        setSnapshot(engine.getSnapshot());
        storage.savePreferences({ activeModeId: modeId }).catch(() => { });
      }
    },
    [allModes, engine, storage],
  );

  const saveCustomMode = useCallback(
    async (mode: ModeDefinition) => {
      await storage.saveCustomMode(mode);
      const updated = await storage.getCustomModes();
      setCustomModes(updated);
      if (engine.getMode().id === mode.id && engine.getState() === 'idle') {
        engine.loadMode(mode);
        setSnapshot(engine.getSnapshot());
      }
    },
    [storage, engine],
  );

  const deleteCustomMode = useCallback(
    async (modeId: string) => {
      await storage.deleteCustomMode(modeId);
      const updated = await storage.getCustomModes();
      setCustomModes(updated);
      if (engine.getMode().id === modeId) {
        engine.loadMode(BUILT_IN_MODES[0]);
        setSnapshot(engine.getSnapshot());
      }
    },
    [storage, engine],
  );

  const updatePreferences = useCallback(
    async (prefs: Partial<UserPreferences>) => {
      await storage.savePreferences(prefs);
      const updated = await storage.getPreferences();
      setPreferences(updated);
    },
    [storage],
  );

  const clearAllSessions = useCallback(async () => {
    await storage.clearSessions();
    setSessions([]);
  }, [storage]);

  const closeSummaryModal = useCallback(() => {
    setSummarySession(null);
  }, []);

  const value: TimerContextValue = {
    snapshot,
    allModes,
    activeMode,
    sessions,
    streak,
    preferences,
    summarySession,
    start,
    pause,
    resume,
    skipStep,
    resetInterval,
    restartSequence,
    stopAndSave,
    setSessionLabel,
    selectMode,
    saveCustomMode,
    deleteCustomMode,
    updatePreferences,
    clearAllSessions,
    closeSummaryModal,
  };

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
};

export const useTimer = (): TimerContextValue => {
  const ctx = useContext(TimerContext);
  if (!ctx) {
    throw new Error('useTimer must be used within a TimerProvider');
  }
  return ctx;
};
