import { SetMetadata } from '@nestjs/common';
import { RoomRole } from '@prisma/client';

export const ROOM_ROLES_KEY = 'room_roles';
export const RequireRoomRole = (...roles: RoomRole[]) => SetMetadata(ROOM_ROLES_KEY, roles);
