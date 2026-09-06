export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const url = `${API_URL}${endpoint}`;
  
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    let message = 'Network response was not ok';
    try {
      const errorData = await response.json();
      message = errorData.message || errorData.error || message;
    } catch (e) {
      // Ignore
    }
    throw new Error(message);
  }

  // Not all responses have JSON body, e.g., 204 No Content
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return null;
  }

  try {
    return await response.json();
  } catch (e) {
    return null;
  }
}

// --- Study Room Types & API ---

export interface UserBasic {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface StudyRoom {
  id: string;
  name: string;
  description: string | null;
  visibility: 'PUBLIC' | 'PRIVATE';
  createdAt: string;
  updatedAt: string;
  createdBy?: UserBasic;
  _count?: {
    roomMembers: number;
  };
  currentUserMembership?: {
    role: 'OWNER' | 'MEMBER';
  } | null;
}

export async function getStudyRooms(): Promise<StudyRoom[]> {
  return fetchApi('/study-rooms');
}

export async function getStudyRoom(roomId: string): Promise<StudyRoom> {
  return fetchApi(`/study-rooms/${roomId}`);
}

export async function createStudyRoom(data: { name: string; description?: string; visibility: 'PUBLIC' | 'PRIVATE' }): Promise<StudyRoom> {
  return fetchApi('/study-rooms', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function joinStudyRoom(roomId: string): Promise<{ roomId: string; userId: string; role: 'OWNER' | 'MEMBER' }> {
  return fetchApi(`/study-rooms/${roomId}/join`, {
    method: 'POST',
  });
}

export async function leaveStudyRoom(roomId: string): Promise<{ success: boolean }> {
  return fetchApi(`/study-rooms/${roomId}/membership`, {
    method: 'DELETE',
  });
}

// --- Timer Types & API ---

export interface TimerStageConfig {
  type: 'FOCUS' | 'SHORT_BREAK' | 'LONG_BREAK';
  durationSeconds: number;
}

export interface TimerMode {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  loop: boolean;
  stagesConfig: TimerStageConfig[];
  createdAt: string;
  updatedAt: string;
}

export interface TimerSession {
  id: string;
  userId: string;
  roomId: string | null;
  timerModeId: string;
  status: 'PENDING' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  currentStageIndex: number;
  startedAt: string | null;
  targetEndTime: string | null;
  pausedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  timerMode?: TimerMode;
}

export async function getTimerModes(): Promise<TimerMode[]> {
  return fetchApi('/timer-modes');
}

export async function getActiveTimerSession(): Promise<TimerSession | null> {
  try {
    return await fetchApi('/timer-sessions/active');
  } catch (e: any) {
    if (e.message?.includes('Not Found') || e.message?.includes('No active timer session')) return null;
    throw e;
  }
}

export async function createTimerSession(timerModeId: string): Promise<TimerSession> {
  return fetchApi('/timer-sessions', {
    method: 'POST',
    body: JSON.stringify({ timerModeId }),
  });
}

export async function startTimerSession(sessionId: string): Promise<TimerSession> {
  return fetchApi(`/timer-sessions/${sessionId}/start`, {
    method: 'POST',
  });
}

export async function pauseTimerSession(sessionId: string): Promise<TimerSession> {
  return fetchApi(`/timer-sessions/${sessionId}/pause`, {
    method: 'POST',
  });
}

export async function completeTimerSession(sessionId: string): Promise<TimerSession> {
  return fetchApi(`/timer-sessions/${sessionId}/complete`, {
    method: 'POST',
  });
}
