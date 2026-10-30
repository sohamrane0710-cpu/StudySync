import { apiClient } from './client';
import type {
  RoomInvite,
  CreateInvitePayload,
  AcceptInvitePayload,
  AcceptInviteResponse,
} from '@/types/invitation';

export const invitationsApi = {
  createInvite: (roomId: string, data?: CreateInvitePayload) =>
    apiClient.post<RoomInvite>(`/rooms/${roomId}/invites`, data || {}),
  getInvites: (roomId: string) => apiClient.get<RoomInvite[]>(`/rooms/${roomId}/invites`),
  deleteInvite: (roomId: string, inviteId: string) =>
    apiClient.delete<void>(`/rooms/${roomId}/invites/${inviteId}`),
  acceptInvite: (token: string) =>
    apiClient.post<AcceptInviteResponse>('/invites/accept', { token } satisfies AcceptInvitePayload),
};
