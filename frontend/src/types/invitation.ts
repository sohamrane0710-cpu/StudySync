import type { Room, RoomRole } from './room';

export interface RoomInvite {
  id: string;
  roomId: string;
  maxUses?: number | null;
  usesCount?: number;
  expiresAt?: string | null;
  createdAt: string;
  token?: string; // Only present upon creation!
}

export interface CreateInvitePayload {
  expiresInHours?: number | null;
  maxUses?: number | null;
}

export interface AcceptInvitePayload {
  token: string;
}

export interface AcceptInviteResponse {
  room: Room;
  alreadyMember: boolean;
  role: RoomRole;
}
