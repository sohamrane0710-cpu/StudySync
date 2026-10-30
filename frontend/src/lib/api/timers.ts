import { apiClient } from './client';
import type {
  TimerSession,
  StartTimerPayload,
  CompleteTimerPayload,
  CompleteTimerResponse,
  SkipTimerPayload,
  SkipTimerResponse,
  FinishSequencePayload,
  FinishSequenceResponse,
  PauseTimerPayload,
  ResumeTimerPayload,
  CancelTimerPayload,
  CancelTimerResponse,
} from '@/types/timer';

export const timersApi = {
  getActiveTimer: () => apiClient.get<TimerSession | null>('/timers/active'),
  startTimer: (payload?: StartTimerPayload) =>
    apiClient.post<TimerSession>('/timers/start', payload || {}),
  pauseTimer: (payload?: PauseTimerPayload) =>
    apiClient.post<TimerSession>('/timers/pause', payload || {}),
  resumeTimer: (payload?: ResumeTimerPayload) =>
    apiClient.post<TimerSession>('/timers/resume', payload || {}),
  completeTimer: (payload: CompleteTimerPayload) =>
    apiClient.post<CompleteTimerResponse>('/timers/complete', payload),
  skipTimer: (payload: SkipTimerPayload) =>
    apiClient.post<SkipTimerResponse>('/timers/skip', payload),
  finishSequence: (payload?: FinishSequencePayload) =>
    apiClient.post<FinishSequenceResponse>('/timers/finish-sequence', payload || {}),
  cancelTimer: (payload?: CancelTimerPayload) =>
    apiClient.post<CancelTimerResponse>('/timers/cancel', payload || {}),
};
