import { apiClient } from './client';
import type { PaginatedResponse } from '@/types/api';
import type {
  StudySession,
  QueryStudySessionsParams,
  CreateStudySessionPayload,
  UpdateStudySessionPayload,
} from '@/types/study-session';

export const studySessionsApi = {
  getStudySessions: (params?: QueryStudySessionsParams) =>
    apiClient.get<PaginatedResponse<StudySession>>('/study-sessions', {
      params: params as Record<string, string | number | boolean | undefined | null>,
    }),
  getStudySession: (id: string) => apiClient.get<StudySession>(`/study-sessions/${id}`),
  createStudySession: (data: CreateStudySessionPayload) =>
    apiClient.post<StudySession>('/study-sessions', data),
  updateStudySession: (id: string, data: UpdateStudySessionPayload) =>
    apiClient.patch<StudySession>(`/study-sessions/${id}`, data),
  deleteStudySession: (id: string) => apiClient.delete<StudySession>(`/study-sessions/${id}`),
};
