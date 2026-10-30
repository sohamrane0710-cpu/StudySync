import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { timersApi } from '@/lib/api/timers';
import { timerModesApi } from '@/lib/api/timer-modes';
import { soundEngine } from '@/lib/audio/sound';
import { usePreferences } from './use-preferences';
import { useAuth } from '@/features/auth/auth-context';
import type {
  TimerSession,
  TimerMode,
  TimerPhase,
  TimerDirection,
  TimerStepType,
  TimerStepInfo,
  StartTimerPayload,
  CompleteTimerPayload,
  CancelTimerPayload,
  SkipTimerPayload,
  CompleteTimerResponse,
  SkipTimerResponse,
  CancelTimerResponse,
} from '@/types/timer';

export const ACTIVE_TIMER_QUERY_KEY = ['timers', 'active'];
export const TIMER_MODES_QUERY_KEY = ['timer-modes'];

export function useActiveTimer() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { preferences } = usePreferences();

  // Synchronous mutation guard to prevent rapid concurrent clicks before re-render
  const isActionPendingRef = useRef(false);

  // Fetch active timer from backend
  const activeTimerQuery = useQuery({
    queryKey: ACTIVE_TIMER_QUERY_KEY,
    queryFn: timersApi.getActiveTimer,
    enabled: isAuthenticated,
    staleTime: 5000,
    refetchOnWindowFocus: true,
  });

  // Fetch timer modes
  const modesQuery = useQuery({
    queryKey: TIMER_MODES_QUERY_KEY,
    queryFn: timerModesApi.getTimerModes,
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 10,
  });

  const activeTimer = activeTimerQuery.data ?? null;
  const modes = modesQuery.data ?? [];

  // Local chosen mode and phase when idle
  const [selectedModeId, setSelectedModeId] = useState<string | null>(null);
  const [idlePhase, setIdlePhase] = useState<TimerPhase>('FOCUS');

  // Track next-step progression state when auto-start is disabled
  const [progressionPreview, setProgressionPreview] = useState<TimerStepInfo | null>(null);
  const [isSequenceFinishedState, setIsSequenceFinishedState] = useState<boolean>(false);

  // Sync progression preview if activeTimer has one
  useEffect(() => {
    if (activeTimer?.nextStepPreview) {
      setProgressionPreview(activeTimer.nextStepPreview);
    }
    if (activeTimer?.isSequenceFinished) {
      setIsSequenceFinishedState(true);
    }
  }, [activeTimer]);

  // Selected mode resolution
  const currentMode: TimerMode | null =
    (activeTimer?.timerMode as TimerMode | null) ||
    modes.find((m) => m.id === selectedModeId) ||
    (preferences?.defaultTimerModeId ? modes.find((m) => m.id === preferences.defaultTimerModeId) : null) ||
    modes[0] ||
    null;

  const timerDirection: TimerDirection =
    activeTimer?.direction || currentMode?.defaultDirection || 'COUNTDOWN';

  // Authoritative seconds calculation (handles both COUNTDOWN and COUNT_UP)
  const calculateDisplaySeconds = useCallback((session: TimerSession | null): number => {
    if (!session) {
      if (!currentMode) return 25 * 60;
      if (idlePhase === 'FOCUS') return currentMode.focusDuration;
      if (idlePhase === 'SHORT_BREAK') return currentMode.shortBreakDuration;
      return currentMode.longBreakDuration;
    }

    if (session.direction === 'COUNT_UP') {
      if (session.status === 'PAUSED') {
        return session.elapsedSeconds || 0;
      }
      if (session.status === 'RUNNING') {
        const anchor = session.resumedAt || session.startedAt;
        const addElapsed = anchor
          ? Math.max(0, Math.floor((Date.now() - new Date(anchor).getTime()) / 1000))
          : 0;
        return (session.elapsedSeconds || 0) + addElapsed;
      }
      return session.elapsedSeconds || 0;
    }

    // COUNTDOWN
    if (session.status === 'PAUSED') {
      return Math.max(0, session.remainingSeconds);
    }

    if (session.status === 'RUNNING' && session.expectedEndTime) {
      const targetTime = new Date(session.expectedEndTime).getTime();
      const now = Date.now();
      return Math.max(0, Math.round((targetTime - now) / 1000));
    }

    return Math.max(0, session.remainingSeconds);
  }, [currentMode, idlePhase]);

  // Visual display state
  const [displaySeconds, setDisplaySeconds] = useState<number>(() =>
    calculateDisplaySeconds(activeTimer)
  );

  // Sync display with activeTimer query updates
  useEffect(() => {
    setDisplaySeconds(calculateDisplaySeconds(activeTimer));
  }, [activeTimer, calculateDisplaySeconds]);

  // Audio completion trigger tracker
  const hasTriggeredAudioRef = useRef<boolean>(false);

  // Client-side visual tick interval anchored strictly to authoritative timestamps
  useEffect(() => {
    if (!activeTimer || activeTimer.status !== 'RUNNING') {
      return;
    }

    hasTriggeredAudioRef.current = false;

    const interval = setInterval(() => {
      const current = calculateDisplaySeconds(activeTimer);
      setDisplaySeconds(current);

      // Trigger completion sound only for countdown reaching 0
      if (
        activeTimer.direction !== 'COUNT_UP' &&
        current === 0 &&
        !hasTriggeredAudioRef.current
      ) {
        hasTriggeredAudioRef.current = true;
        soundEngine.playChime(preferences?.soundVolume ?? 0.7, preferences?.soundEnabled ?? true);
      }
    }, 250);

    return () => clearInterval(interval);
  }, [activeTimer, calculateDisplaySeconds, preferences]);

  // Visibility change re-sync
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isAuthenticated) {
        activeTimerQuery.refetch();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [activeTimerQuery, isAuthenticated]);

  // Mutations
  const startMutation = useMutation({
    mutationFn: (payload?: StartTimerPayload) => timersApi.startTimer(payload),
    onSuccess: (newSession) => {
      queryClient.setQueryData(ACTIVE_TIMER_QUERY_KEY, newSession);
      setProgressionPreview(null);
      setIsSequenceFinishedState(false);
      soundEngine.playTick(preferences?.soundVolume ?? 0.5, preferences?.soundEnabled ?? true);
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ACTIVE_TIMER_QUERY_KEY });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: (payload?: { timerSessionId?: string }) => timersApi.pauseTimer(payload),
    onSuccess: (pausedSession) => {
      queryClient.setQueryData(ACTIVE_TIMER_QUERY_KEY, pausedSession);
      soundEngine.playTick(preferences?.soundVolume ?? 0.5, preferences?.soundEnabled ?? true);
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ACTIVE_TIMER_QUERY_KEY });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: (payload?: { timerSessionId?: string }) => timersApi.resumeTimer(payload),
    onSuccess: (resumedSession) => {
      queryClient.setQueryData(ACTIVE_TIMER_QUERY_KEY, resumedSession);
      soundEngine.playTick(preferences?.soundVolume ?? 0.5, preferences?.soundEnabled ?? true);
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ACTIVE_TIMER_QUERY_KEY });
    },
  });

  const completeMutation = useMutation({
    mutationFn: (payload: CompleteTimerPayload) => timersApi.completeTimer(payload),
    onSuccess: (response: CompleteTimerResponse) => {
      if (response.nextTimerSession) {
        queryClient.setQueryData(ACTIVE_TIMER_QUERY_KEY, response.nextTimerSession);
        setProgressionPreview(null);
        setIsSequenceFinishedState(false);
      } else {
        queryClient.setQueryData(ACTIVE_TIMER_QUERY_KEY, null);
        if (response.nextStepPreview) {
          setProgressionPreview(response.nextStepPreview);
        }
        if (response.isSequenceFinished) {
          setIsSequenceFinishedState(true);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['study-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });

      if (response.nextPhase) {
        setIdlePhase(response.nextPhase);
      }
      soundEngine.playChime(preferences?.soundVolume ?? 0.7, preferences?.soundEnabled ?? true);
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ACTIVE_TIMER_QUERY_KEY });
    },
  });

  const skipMutation = useMutation({
    mutationFn: (payload: SkipTimerPayload) => timersApi.skipTimer(payload),
    onSuccess: (response: SkipTimerResponse) => {
      if (response.nextTimerSession) {
        queryClient.setQueryData(ACTIVE_TIMER_QUERY_KEY, response.nextTimerSession);
        setProgressionPreview(null);
        setIsSequenceFinishedState(false);
      } else {
        queryClient.setQueryData(ACTIVE_TIMER_QUERY_KEY, null);
        if (response.nextStepPreview) {
          setProgressionPreview(response.nextStepPreview);
        }
        if (response.isSequenceFinished) {
          setIsSequenceFinishedState(true);
        }
      }
      soundEngine.playTick(preferences?.soundVolume ?? 0.5, preferences?.soundEnabled ?? true);
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ACTIVE_TIMER_QUERY_KEY });
    },
  });

  const finishSequenceMutation = useMutation({
    mutationFn: (payload?: { timerSessionId?: string }) => timersApi.finishSequence(payload),
    onSuccess: () => {
      queryClient.setQueryData(ACTIVE_TIMER_QUERY_KEY, null);
      setProgressionPreview(null);
      setIsSequenceFinishedState(true);
      soundEngine.playTick(preferences?.soundVolume ?? 0.5, preferences?.soundEnabled ?? true);
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ACTIVE_TIMER_QUERY_KEY });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (payload?: CancelTimerPayload) => timersApi.cancelTimer(payload),
    onSuccess: (response: CancelTimerResponse) => {
      queryClient.setQueryData(ACTIVE_TIMER_QUERY_KEY, null);
      setProgressionPreview(null);
      setIsSequenceFinishedState(false);
      if (response.interruptedStudyRecord) {
        queryClient.invalidateQueries({ queryKey: ['study-sessions'] });
        queryClient.invalidateQueries({ queryKey: ['analytics'] });
      }
      soundEngine.playTick(preferences?.soundVolume ?? 0.5, preferences?.soundEnabled ?? true);
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ACTIVE_TIMER_QUERY_KEY });
    },
  });

  const isMutating =
    startMutation.isPending ||
    pauseMutation.isPending ||
    resumeMutation.isPending ||
    completeMutation.isPending ||
    skipMutation.isPending ||
    finishSequenceMutation.isPending ||
    cancelMutation.isPending;

  // Action handlers with synchronous mutation guards
  const handleStart = async (durationOverride?: number, directionOverride?: TimerDirection, stepIndex?: number) => {
    if (isActionPendingRef.current || isMutating) return;
    isActionPendingRef.current = true;
    try {
      const payload: StartTimerPayload = {
        timerModeId: currentMode?.id,
        durationOverride,
        directionOverride,
        stepIndex,
      };
      if (stepIndex === undefined) {
        payload.phase = idlePhase;
      }
      return await startMutation.mutateAsync(payload);
    } finally {
      isActionPendingRef.current = false;
    }
  };

  const handleStartNext = async (durationOverride?: number) => {
    if (progressionPreview) {
      return handleStart(durationOverride, undefined, progressionPreview.stepIndex);
    }
    return handleStart(durationOverride);
  };

  const handlePause = async () => {
    if (isActionPendingRef.current || isMutating) return;
    isActionPendingRef.current = true;
    try {
      return await pauseMutation.mutateAsync({
        timerSessionId: activeTimer?.id,
      });
    } finally {
      isActionPendingRef.current = false;
    }
  };

  const handleResume = async () => {
    if (isActionPendingRef.current || isMutating) return;
    isActionPendingRef.current = true;
    try {
      return await resumeMutation.mutateAsync({
        timerSessionId: activeTimer?.id,
      });
    } finally {
      isActionPendingRef.current = false;
    }
  };

  const handleComplete = async (payload?: Omit<CompleteTimerPayload, 'timerSessionId'>) => {
    if (isActionPendingRef.current || isMutating || !activeTimer) return;
    isActionPendingRef.current = true;
    try {
      return await completeMutation.mutateAsync({
        ...payload,
        timerSessionId: activeTimer.id,
      });
    } finally {
      isActionPendingRef.current = false;
    }
  };

  const handleSkip = async () => {
    if (isActionPendingRef.current || isMutating || !activeTimer) return;
    isActionPendingRef.current = true;
    try {
      return await skipMutation.mutateAsync({
        timerSessionId: activeTimer.id,
      });
    } finally {
      isActionPendingRef.current = false;
    }
  };

  const handleFinishSequence = async () => {
    if (isActionPendingRef.current || isMutating) return;
    isActionPendingRef.current = true;
    try {
      return await finishSequenceMutation.mutateAsync({
        timerSessionId: activeTimer?.id,
      });
    } finally {
      isActionPendingRef.current = false;
    }
  };

  const handleCancel = async (payload?: CancelTimerPayload) => {
    if (isActionPendingRef.current || isMutating) return;
    isActionPendingRef.current = true;
    try {
      return await cancelMutation.mutateAsync({
        ...payload,
        timerSessionId: activeTimer?.id,
      });
    } finally {
      isActionPendingRef.current = false;
    }
  };

  const handleReset = async () => {
    if (isActionPendingRef.current || isMutating) return;
    isActionPendingRef.current = true;
    try {
      if (activeTimer) {
        await cancelMutation.mutateAsync({
          savePartialRecord: false,
          reason: 'Reset by user',
          timerSessionId: activeTimer.id,
        });
      }
      setProgressionPreview(null);
      setIsSequenceFinishedState(false);
      const defaultDuration = currentMode
        ? idlePhase === 'FOCUS'
          ? currentMode.focusDuration
          : idlePhase === 'SHORT_BREAK'
          ? currentMode.shortBreakDuration
          : currentMode.longBreakDuration
        : 1500;
      setDisplaySeconds(defaultDuration);
    } finally {
      isActionPendingRef.current = false;
    }
  };

  // Target duration calculation
  const targetDuration = activeTimer
    ? activeTimer.targetDuration
    : currentMode
    ? idlePhase === 'FOCUS'
      ? currentMode.focusDuration
      : idlePhase === 'SHORT_BREAK'
      ? currentMode.shortBreakDuration
      : currentMode.longBreakDuration
    : 1500;

  const currentPhase: TimerPhase = activeTimer ? activeTimer.phase : idlePhase;
  const isRunning = activeTimer?.status === 'RUNNING';
  const isPaused = activeTimer?.status === 'PAUSED';
  const isIdle = !activeTimer || activeTimer.status === 'COMPLETED' || activeTimer.status === 'CANCELLED';
  const isExpired = activeTimer
    ? activeTimer.direction !== 'COUNT_UP' && (activeTimer.isExpired || displaySeconds <= 0)
    : false;

  const currentStepName: string =
    activeTimer?.stepName ||
    activeTimer?.currentStep?.stepName ||
    (currentPhase === 'FOCUS' ? 'Focus' : 'Break');

  const currentStepType: TimerStepType =
    activeTimer?.stepType ||
    activeTimer?.currentStep?.stepType ||
    (currentPhase === 'FOCUS' ? 'FOCUS' : 'REST');

  const mutationError =
    startMutation.error ||
    pauseMutation.error ||
    resumeMutation.error ||
    completeMutation.error ||
    skipMutation.error ||
    finishSequenceMutation.error ||
    cancelMutation.error;

  const errorMessage = mutationError
    ? (mutationError as any)?.response?.data?.message ||
      (mutationError as any)?.message ||
      'Timer action failed'
    : null;

  const handleClearError = () => {
    startMutation.reset();
    pauseMutation.reset();
    resumeMutation.reset();
    completeMutation.reset();
    skipMutation.reset();
    finishSequenceMutation.reset();
    cancelMutation.reset();
  };

  return {
    activeTimer,
    displaySeconds,
    targetDuration,
    currentPhase,
    currentMode,
    modes,
    direction: timerDirection,
    currentStepName,
    currentStepType,
    nextStepPreview: progressionPreview || activeTimer?.nextStepPreview || null,
    isSequenceFinished: isSequenceFinishedState || activeTimer?.isSequenceFinished || false,
    isRunning,
    isPaused,
    isIdle,
    isExpired,
    isMutating,
    isLoading: activeTimerQuery.isLoading,
    error: errorMessage,
    clearError: handleClearError,
    setSelectedModeId,
    setIdlePhase,
    start: handleStart,
    startNext: handleStartNext,
    pause: handlePause,
    resume: handleResume,
    complete: handleComplete,
    skip: handleSkip,
    finishSequence: handleFinishSequence,
    cancel: handleCancel,
    reset: handleReset,
    refetch: activeTimerQuery.refetch,
  };
}
