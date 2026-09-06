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
