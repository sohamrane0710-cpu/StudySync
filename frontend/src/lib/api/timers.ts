import { apiClient } from './client';
import type {
  TimerSession,
  StartTimerPayload,
  CompleteTimerPayload,
  CompleteTimerResponse,
  CancelTimerPayload,
  CancelTimerResponse,
} from '@/types/timer';

export const timersApi = {
  getActiveTimer: () => apiClient.get<TimerSession | null>('/timers/active'),
  startTimer: (payload?: StartTimerPayload) =>
    apiClient.post<TimerSession>('/timers/start', payload || {}),
  pauseTimer: () => apiClient.post<TimerSession>('/timers/pause'),
  resumeTimer: () => apiClient.post<TimerSession>('/timers/resume'),
  completeTimer: (payload?: CompleteTimerPayload) =>
    apiClient.post<CompleteTimerResponse>('/timers/complete', payload || {}),
  cancelTimer: (payload?: CancelTimerPayload) =>
    apiClient.post<CancelTimerResponse>('/timers/cancel', payload || {}),
};
