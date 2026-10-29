import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoomRole } from '@prisma/client';
import { AuthenticatedUser } from '../decorators/current-user.decorator';
import { ROOM_ROLES_KEY } from '../decorators/require-room-role.decorator';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class RoomRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<RoomRole[]>(
      ROOM_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no roles are specified, no role-based restriction is applied
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;

    if (!user) {
      throw new ForbiddenException('User is not authenticated');
    }

    const roomId = request.params.id || request.params.roomId;
    if (!roomId) {
      throw new ForbiddenException('Room ID is missing in request path');
    }

    const membership = await this.prisma.roomMember.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId: user.id,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this room');
    }

    if (!requiredRoles.includes(membership.role)) {
      throw new ForbiddenException(
        `Insufficient room privileges. Required: ${requiredRoles.join(' or ')}. Your role: ${membership.role}`,
      );
    }

    // Attach membership to request for downstream handlers
    request.roomMembership = membership;
    return true;
  }
}
