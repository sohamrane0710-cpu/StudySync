import { apiClient } from './client';
import type {
  RoomTimerSession,
  StartRoomTimerPayload,
  RoomParticipant,
} from '@/types/room';

export const collaborationApi = {
  getRoomTimer: (roomId: string) =>
    apiClient.get<RoomTimerSession | null>(`/rooms/${roomId}/timer`),
  startRoomTimer: (roomId: string, data: StartRoomTimerPayload) =>
    apiClient.post<RoomTimerSession>(`/rooms/${roomId}/timer/start`, data),
  pauseRoomTimer: (roomId: string) =>
    apiClient.post<RoomTimerSession>(`/rooms/${roomId}/timer/pause`),
  resumeRoomTimer: (roomId: string) =>
    apiClient.post<RoomTimerSession>(`/rooms/${roomId}/timer/resume`),
  completeRoomTimer: (roomId: string) =>
    apiClient.post<{ roomTimerSession: RoomTimerSession; creditedParticipantsCount: number }>(
      `/rooms/${roomId}/timer/complete`
    ),
  cancelRoomTimer: (roomId: string) =>
    apiClient.post<{ roomTimerSession: RoomTimerSession }>(`/rooms/${roomId}/timer/cancel`),
  joinRoomTimer: (roomId: string) =>
    apiClient.post<RoomParticipant>(`/rooms/${roomId}/timer/join`),
  leaveRoomTimer: (roomId: string) =>
    apiClient.post<RoomParticipant>(`/rooms/${roomId}/timer/leave`),
};
