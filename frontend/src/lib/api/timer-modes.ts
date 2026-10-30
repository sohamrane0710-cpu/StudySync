import { apiClient } from './client';
import type { TimerMode } from '@/types/timer';

export interface CreateTimerModePayload {
  name: string;
  description?: string;
  focusDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  longBreakInterval?: number;
}

export type UpdateTimerModePayload = Partial<CreateTimerModePayload>;

export const timerModesApi = {
  getTimerModes: () => apiClient.get<TimerMode[]>('/timer-modes'),
  getTimerMode: (id: string) => apiClient.get<TimerMode>(`/timer-modes/${id}`),
  createTimerMode: (data: CreateTimerModePayload) => apiClient.post<TimerMode>('/timer-modes', data),
  updateTimerMode: (id: string, data: UpdateTimerModePayload) =>
    apiClient.patch<TimerMode>(`/timer-modes/${id}`, data),
  deleteTimerMode: (id: string) => apiClient.delete<TimerMode>(`/timer-modes/${id}`),
  duplicateTimerMode: (id: string) => apiClient.post<TimerMode>(`/timer-modes/${id}/duplicate`),
};
