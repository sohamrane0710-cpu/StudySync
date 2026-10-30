import { apiClient } from './client';
import type {
  Room,
  RoomDetail,
  CreateRoomPayload,
  UpdateRoomPayload,
} from '@/types/room';

export const roomsApi = {
  getRooms: () => apiClient.get<Room[]>('/rooms'),
  getRoom: (id: string) => apiClient.get<RoomDetail>(`/rooms/${id}`),
  createRoom: (data: CreateRoomPayload) => apiClient.post<Room>('/rooms', data),
  updateRoom: (id: string, data: UpdateRoomPayload) =>
    apiClient.patch<Room>(`/rooms/${id}`, data),
  deleteRoom: (id: string) => apiClient.delete<Room>(`/rooms/${id}`),
  joinRoom: (id: string) => apiClient.post<Room>(`/rooms/${id}/join`),
  leaveRoom: (id: string) => apiClient.post<Room>(`/rooms/${id}/leave`),
};
