import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RoomRole } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { CreateInviteDto } from './dto/create-invite.dto';

@Injectable()
export class InvitationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createInvite(userId: string, roomId: string, dto: CreateInviteDto) {
    const membership = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });

    if (
      !membership ||
      (membership.role !== RoomRole.OWNER && membership.role !== RoomRole.MODERATOR)
    ) {
      throw new ForbiddenException(
        'Only room owners and moderators can create invitation links',
      );
    }

    // Generate 32 bytes (256 bits) of cryptographically secure randomness
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    let expiresAt: Date | null = null;
    if (dto.expiresInHours) {
      expiresAt = new Date(Date.now() + dto.expiresInHours * 60 * 60 * 1000);
    }

    const invite = await this.prisma.roomInvite.create({
      data: {
        roomId,
        inviterId: userId,
        tokenHash,
        maxUses: dto.maxUses,
        expiresAt,
      },
    });

    return {
      id: invite.id,
      roomId: invite.roomId,
      token: rawToken, // Returned ONLY ONCE upon creation
      maxUses: invite.maxUses,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
    };
  }

  async acceptInvite(userId: string, dto: AcceptInviteDto) {
    const tokenHash = crypto.createHash('sha256').update(dto.token).digest('hex');
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const invite = await tx.roomInvite.findUnique({
        where: { tokenHash },
        include: {
          room: {
            include: {
              _count: { select: { members: true } },
            },
          },
        },
      });

      if (!invite) {
        throw new NotFoundException('Invalid invitation token');
      }

      if (invite.isRevoked) {
        throw new BadRequestException('This invitation has been revoked');
      }

      if (invite.expiresAt && now > invite.expiresAt) {
        throw new BadRequestException('This invitation has expired');
      }

      if (invite.maxUses !== null && invite.usesCount >= invite.maxUses) {
        throw new BadRequestException('This invitation has reached its maximum usage limit');
      }

      // Check if user is already a member
      const existingMember = await tx.roomMember.findUnique({
        where: { roomId_userId: { roomId: invite.roomId, userId } },
      });

      if (existingMember) {
        return {
          room: invite.room,
          alreadyMember: true,
          role: existingMember.role,
        };
      }

      // Enforce room capacity
      if (invite.room._count.members >= invite.room.maxParticipants) {
        throw new ConflictException('Room has reached maximum capacity');
      }

      // Increment usage count atomically
      await tx.roomInvite.update({
        where: { id: invite.id },
        data: { usesCount: { increment: 1 } },
      });

      // Add user to room members
      const newMember = await tx.roomMember.create({
        data: {
          roomId: invite.roomId,
          userId,
          role: RoomRole.MEMBER,
        },
      });

      return {
        room: invite.room,
        alreadyMember: false,
        role: newMember.role,
      };
    });
  }

  async listInvites(userId: string, roomId: string) {
    const membership = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });

    if (
      !membership ||
      (membership.role !== RoomRole.OWNER && membership.role !== RoomRole.MODERATOR)
    ) {
      throw new ForbiddenException(
        'Only room owners and moderators can view room invitations',
      );
    }

    const invites = await this.prisma.roomInvite.findMany({
      where: { roomId, isRevoked: false },
      include: {
        inviter: {
          select: { id: true, username: true, displayName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Never expose token hashes to API consumers
    return invites.map((inv) => ({
      id: inv.id,
      roomId: inv.roomId,
      inviter: inv.inviter,
      maxUses: inv.maxUses,
      usesCount: inv.usesCount,
      expiresAt: inv.expiresAt,
      isRevoked: inv.isRevoked,
      createdAt: inv.createdAt,
    }));
  }

  async revokeInvite(userId: string, roomId: string, inviteId: string) {
    const membership = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });

    if (
      !membership ||
      (membership.role !== RoomRole.OWNER && membership.role !== RoomRole.MODERATOR)
    ) {
      throw new ForbiddenException(
        'Only room owners and moderators can revoke invitation links',
      );
    }

    const invite = await this.prisma.roomInvite.findUnique({
      where: { id: inviteId },
    });

    if (!invite || invite.roomId !== roomId) {
      throw new NotFoundException('Invitation not found in this room');
    }

    return this.prisma.roomInvite.update({
      where: { id: inviteId },
      data: { isRevoked: true },
    });
  }
}
