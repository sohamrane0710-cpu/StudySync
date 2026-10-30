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
  StartTimerPayload,
  CompleteTimerPayload,
  CancelTimerPayload,
  CompleteTimerResponse,
  CancelTimerResponse,
} from '@/types/timer';

export const ACTIVE_TIMER_QUERY_KEY = ['timers', 'active'];
export const TIMER_MODES_QUERY_KEY = ['timer-modes'];

export function useActiveTimer() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { preferences } = usePreferences();

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

  // Local chosen mode and phase when idle (no active server timer)
  const [selectedModeId, setSelectedModeId] = useState<string | null>(null);
  const [idlePhase, setIdlePhase] = useState<TimerPhase>('FOCUS');

  // Selected mode resolution
  const currentMode: TimerMode | null =
    (activeTimer?.timerMode as TimerMode | null) ||
    modes.find((m) => m.id === selectedModeId) ||
    (preferences?.defaultTimerModeId ? modes.find((m) => m.id === preferences.defaultTimerModeId) : null) ||
    modes[0] ||
    null;

  // Authoritative remaining seconds calculation
  const calculateRemainingSeconds = useCallback((session: TimerSession | null): number => {
    if (!session) {
      if (!currentMode) return 25 * 60;
      if (idlePhase === 'FOCUS') return currentMode.focusDuration;
      if (idlePhase === 'SHORT_BREAK') return currentMode.shortBreakDuration;
      return currentMode.longBreakDuration;
    }

    if (session.status === 'PAUSED') {
      return Math.max(0, session.remainingSeconds);
    }

    if (session.status === 'RUNNING' && session.expectedEndTime) {
      const targetTime = new Date(session.expectedEndTime).getTime();
      const now = Date.now();
      const diffSeconds = Math.max(0, Math.round((targetTime - now) / 1000));
      return diffSeconds;
    }

    return Math.max(0, session.remainingSeconds);
  }, [currentMode, idlePhase]);

  // Visual countdown display state
  const [displaySeconds, setDisplaySeconds] = useState<number>(() =>
    calculateRemainingSeconds(activeTimer)
  );

  // Sync display with activeTimer query updates
  useEffect(() => {
    setDisplaySeconds(calculateRemainingSeconds(activeTimer));
  }, [activeTimer, calculateRemainingSeconds]);

  // Audio completion trigger tracker to prevent multiple plays
  const hasTriggeredAudioRef = useRef<boolean>(false);

  // Client-side visual tick interval (anchored strictly to authoritative timestamps)
  useEffect(() => {
    if (!activeTimer || activeTimer.status !== 'RUNNING' || !activeTimer.expectedEndTime) {
      return;
    }

    hasTriggeredAudioRef.current = false;

    const interval = setInterval(() => {
      const remaining = calculateRemainingSeconds(activeTimer);
      setDisplaySeconds(remaining);

      // Trigger completion sound when reaching 0
      if (remaining === 0 && !hasTriggeredAudioRef.current) {
        hasTriggeredAudioRef.current = true;
        soundEngine.playChime(preferences?.soundVolume ?? 0.7, preferences?.soundEnabled ?? true);
      }
    }, 250);

    return () => clearInterval(interval);
  }, [activeTimer, calculateRemainingSeconds, preferences]);

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
      soundEngine.playTick(preferences?.soundVolume ?? 0.5, preferences?.soundEnabled ?? true);
    },
  });

  const pauseMutation = useMutation({
    mutationFn: timersApi.pauseTimer,
    onSuccess: (pausedSession) => {
      queryClient.setQueryData(ACTIVE_TIMER_QUERY_KEY, pausedSession);
      soundEngine.playTick(preferences?.soundVolume ?? 0.5, preferences?.soundEnabled ?? true);
    },
  });

  const resumeMutation = useMutation({
    mutationFn: timersApi.resumeTimer,
    onSuccess: (resumedSession) => {
      queryClient.setQueryData(ACTIVE_TIMER_QUERY_KEY, resumedSession);
      soundEngine.playTick(preferences?.soundVolume ?? 0.5, preferences?.soundEnabled ?? true);
    },
  });

  const completeMutation = useMutation({
    mutationFn: (payload?: CompleteTimerPayload) => timersApi.completeTimer(payload),
    onSuccess: (response: CompleteTimerResponse) => {
      queryClient.setQueryData(ACTIVE_TIMER_QUERY_KEY, null);
      queryClient.invalidateQueries({ queryKey: ['study-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      if (response.nextPhase) {
        setIdlePhase(response.nextPhase);
      }
      soundEngine.playChime(preferences?.soundVolume ?? 0.7, preferences?.soundEnabled ?? true);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (payload?: CancelTimerPayload) => timersApi.cancelTimer(payload),
    onSuccess: (response: CancelTimerResponse) => {
      queryClient.setQueryData(ACTIVE_TIMER_QUERY_KEY, null);
      if (response.interruptedStudyRecord) {
        queryClient.invalidateQueries({ queryKey: ['study-sessions'] });
        queryClient.invalidateQueries({ queryKey: ['analytics'] });
      }
      soundEngine.playTick(preferences?.soundVolume ?? 0.5, preferences?.soundEnabled ?? true);
    },
  });

  // Action handlers
  const handleStart = async (durationOverride?: number) => {
    const payload: StartTimerPayload = {
      timerModeId: currentMode?.id,
      phase: idlePhase,
      durationOverride,
    };
    return startMutation.mutateAsync(payload);
  };

  const handlePause = async () => {
    return pauseMutation.mutateAsync();
  };

  const handleResume = async () => {
    return resumeMutation.mutateAsync();
  };

  const handleComplete = async (payload?: CompleteTimerPayload) => {
    return completeMutation.mutateAsync(payload);
  };

  const handleCancel = async (payload?: CancelTimerPayload) => {
    return cancelMutation.mutateAsync(payload);
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
  const isExpired = activeTimer ? (activeTimer.isExpired || displaySeconds <= 0) : false;

  const isMutating =
    startMutation.isPending ||
    pauseMutation.isPending ||
    resumeMutation.isPending ||
    completeMutation.isPending ||
    cancelMutation.isPending;

  return {
    activeTimer,
    displaySeconds,
    targetDuration,
    currentPhase,
    currentMode,
    modes,
    isRunning,
    isPaused,
    isIdle,
    isExpired,
    isMutating,
    isLoading: activeTimerQuery.isLoading,
    setSelectedModeId,
    setIdlePhase,
    start: handleStart,
    pause: handlePause,
    resume: handleResume,
    complete: handleComplete,
    cancel: handleCancel,
    refetch: activeTimerQuery.refetch,
  };
}
