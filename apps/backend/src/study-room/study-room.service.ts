import { Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateStudyRoomDto } from './dto/create-study-room.dto.js';
import { RoomVisibility, RoomRole } from '@prisma/client';

@Injectable()
export class StudyRoomService {
  constructor(private readonly prisma: PrismaService) {}

  async createRoom(userId: string, dto: CreateStudyRoomDto) {
    if (!dto.name.trim()) {
      throw new BadRequestException('Room name cannot be empty');
    }

    const room = await this.prisma.studyRoom.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        visibility: dto.visibility || RoomVisibility.PUBLIC,
        createdById: userId,
        roomMembers: {
          create: {
            userId: userId,
            role: RoomRole.OWNER,
          },
        },
      },
      include: {
        _count: {
          select: { roomMembers: true },
        },
        createdBy: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
      },
    });

    return room;
  }

  async listPublicRooms() {
    const rooms = await this.prisma.studyRoom.findMany({
      where: { visibility: RoomVisibility.PUBLIC },
      include: {
        _count: {
          select: { roomMembers: true },
        },
        createdBy: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rooms;
  }

  async getRoom(userId: string, roomId: string) {
    const room = await this.prisma.studyRoom.findUnique({
      where: { id: roomId },
      include: {
        _count: {
          select: { roomMembers: true },
        },
        createdBy: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        roomMembers: {
          where: { userId },
        },
      },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const isMember = room.roomMembers.length > 0;
    if (room.visibility === RoomVisibility.PRIVATE && !isMember) {
      throw new ForbiddenException('You do not have access to this room');
    }

    const { roomMembers, ...safeRoom } = room;
    const currentUserMembership = isMember ? { role: roomMembers[0].role } : null;

    return {
      ...safeRoom,
      currentUserMembership,
    };
  }

  async joinRoom(userId: string, roomId: string) {
    const room = await this.prisma.studyRoom.findUnique({
      where: { id: roomId },
      include: {
        roomMembers: {
          where: { userId },
        },
      },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    if (room.roomMembers.length > 0) {
      throw new ConflictException('You are already a member of this room');
    }

    if (room.visibility === RoomVisibility.PRIVATE) {
      throw new ForbiddenException('Cannot join a private room directly');
    }

    const membership = await this.prisma.roomMember.create({
      data: {
        roomId,
        userId,
        role: RoomRole.MEMBER,
      },
    });

    return membership;
  }

  async leaveRoom(userId: string, roomId: string) {
    const membership = await this.prisma.roomMember.findUnique({
      where: {
        roomId_userId: { roomId, userId },
      },
    });

    if (!membership) {
      throw new NotFoundException('You are not a member of this room');
    }

    if (membership.role === RoomRole.OWNER) {
      // Simplest safe behavior: reject leaving for owner.
      throw new ForbiddenException('Owner cannot leave the room');
    }

    await this.prisma.roomMember.delete({
      where: {
        roomId_userId: { roomId, userId },
      },
    });

    return { success: true };
  }
}
