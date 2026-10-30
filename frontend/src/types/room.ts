import type { TimerPhase, TimerStatus } from './timer';

export type RoomRole = 'OWNER' | 'MODERATOR' | 'MEMBER';

export interface RoomMemberUser {
  id: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
}

export interface RoomMember {
  id: string;
  roomId: string;
  userId: string;
  role: RoomRole;
  joinedAt: string;
  user: RoomMemberUser;
}

export interface RoomParticipant {
  id: string;
  roomStudySessionId?: string;
  roomTimerSessionId?: string;
  userId: string;
  joinedAt: string;
  leftAt?: string | null;
  user: RoomMemberUser;
}

export interface RoomTimerSession {
  id: string;
  roomId: string;
  phase: TimerPhase;
  status: TimerStatus;
  targetDuration: number;
  remainingSeconds: number;
  startedAt: string;
  pausedAt?: string | null;
  expectedEndTime?: string | null;
  authoritativeRemainingSeconds?: number;
  isExpired?: boolean;
  participants: RoomParticipant[];
}

export interface Room {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  isPrivate: boolean;
  maxParticipants: number;
  createdAt: string;
  updatedAt: string;
  ownerId?: string;
  _count?: {
    members: number;
  };
  currentUserRole?: RoomRole | null;
}

export interface RoomDetail extends Room {
  members: RoomMember[];
  activeTimerSession?: RoomTimerSession | null;
}

export interface CreateRoomPayload {
  name: string;
  description?: string;
  slug?: string;
  isPrivate?: boolean;
  maxParticipants?: number;
}

export interface UpdateRoomPayload {
  name?: string;
  description?: string;
  isPrivate?: boolean;
  maxParticipants?: number;
}

export interface StartRoomTimerPayload {
  phase?: TimerPhase;
  durationOverride?: number; // in seconds
  timerModeId?: string;
}
