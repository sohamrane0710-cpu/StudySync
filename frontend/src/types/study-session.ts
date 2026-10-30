import type { TimerPhase } from './timer';

export type StudySessionStatus = 'COMPLETED' | 'INTERRUPTED' | 'ABANDONED';

export interface StudySessionCategoryRelation {
  category: {
    id: string;
    name: string;
    color: string;
  };
}

export interface StudySessionLabelRelation {
  label: {
    id: string;
    name: string;
    color: string;
  };
}

export interface StudySession {
  id: string;
  userId: string;
  title: string | null;
  phase: TimerPhase;
  status: StudySessionStatus;
  targetDuration: number; // in seconds
  actualDuration: number; // in seconds
  startedAt: string;
  endedAt: string;
  notes?: string | null;
  categories?: StudySessionCategoryRelation[];
  labels?: StudySessionLabelRelation[];
  createdAt: string;
  updatedAt: string;
}

export interface QueryStudySessionsParams {
  startDate?: string;
  endDate?: string;
  status?: StudySessionStatus;
  categoryId?: string;
  labelId?: string;
  page?: number;
  limit?: number;
}

export interface CreateStudySessionPayload {
  title?: string;
  phase?: TimerPhase;
  status?: StudySessionStatus;
  targetDuration: number;
  actualDuration: number;
  startedAt: string;
  endedAt: string;
  notes?: string;
  categoryIds?: string[];
  labelIds?: string[];
}

export interface UpdateStudySessionPayload {
  title?: string;
  notes?: string;
  categoryIds?: string[];
  labelIds?: string[];
}
