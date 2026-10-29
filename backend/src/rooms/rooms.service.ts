import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RoomRole } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateRoomDto) {
    let slug = dto.slug;
    if (!slug) {
      const sanitized = dto.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
      const suffix = Math.random().toString(36).substring(2, 6);
      slug = `${sanitized || 'room'}-${suffix}`;
    }

    const existingSlug = await this.prisma.room.findUnique({
      where: { slug },
    });
    if (existingSlug) {
      throw new ConflictException(`Room slug "${slug}" is already taken`);
    }

    return this.prisma.$transaction(async (tx) => {
      const room = await tx.room.create({
        data: {
          name: dto.name,
          description: dto.description,
          slug,
          isPrivate: dto.isPrivate || false,
          maxParticipants: dto.maxParticipants || 25,
          ownerId: userId,
        },
      });

      // Automatically add creator as OWNER
      await tx.roomMember.create({
        data: {
          roomId: room.id,
          userId,
          role: RoomRole.OWNER,
        },
      });

      return room;
    });
  }

  async findAll(userId: string) {
    return this.prisma.room.findMany({
      where: {
        OR: [
          { isPrivate: false },
          {
            members: {
              some: { userId },
            },
          },
        ],
      },
      include: {
        _count: {
          select: { members: true },
        },
        members: {
          where: { userId },
          select: { role: true, joinedAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const room = await this.prisma.room.findUnique({
      where: { id },
      include: {
        _count: {
          select: { members: true },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
        roomStudySessions: {
          where: { status: { in: ['RUNNING', 'PAUSED'] } },
          include: {
            participants: {
              where: { leftAt: null },
              include: {
                user: {
                  select: { id: true, username: true, displayName: true },
                },
              },
            },
          },
        },
      },
    });

    if (!room) {
      throw new NotFoundException('Study room not found');
    }

    const isMember = room.members.some((m) => m.userId === userId);
    if (room.isPrivate && !isMember) {
      throw new ForbiddenException('Access to private study room requires membership');
    }

    return {
      ...room,
      isMember,
    };
  }

  async join(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const room = await tx.room.findUnique({
        where: { id },
        include: {
          _count: { select: { members: true } },
        },
      });

      if (!room) {
        throw new NotFoundException('Room not found');
      }

      if (room.isPrivate) {
        throw new ForbiddenException('Cannot join private room without an invitation link');
      }

      const existingMember = await tx.roomMember.findUnique({
        where: { roomId_userId: { roomId: id, userId } },
      });

      if (existingMember) {
        return existingMember;
      }

      if (room._count.members >= room.maxParticipants) {
        throw new ConflictException('Room has reached maximum capacity');
      }

      return tx.roomMember.create({
        data: {
          roomId: id,
          userId,
          role: RoomRole.MEMBER,
        },
        include: {
          room: true,
        },
      });
    });
  }

  async leave(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const membership = await tx.roomMember.findUnique({
        where: { roomId_userId: { roomId: id, userId } },
      });

      if (!membership) {
        throw new NotFoundException('You are not a member of this room');
      }

      if (membership.role === RoomRole.OWNER) {
        const otherMembers = await tx.roomMember.findMany({
          where: { roomId: id, userId: { not: userId } },
          orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
        });

        if (otherMembers.length === 0) {
          // Sole owner leaves: delete room
          await tx.room.delete({ where: { id } });
          return { message: 'Room deleted as sole owner left' };
        } else {
          // Transfer ownership to senior moderator or next member
          const successor = otherMembers[0];
          await tx.roomMember.update({
            where: { id: successor.id },
            data: { role: RoomRole.OWNER },
          });
          await tx.room.update({
            where: { id },
            data: { ownerId: successor.userId },
          });
        }
      }

      await tx.roomMember.delete({
        where: { id: membership.id },
      });

      return { message: 'Successfully left the room' };
    });
  }

  async update(userId: string, id: string, dto: UpdateRoomDto) {
    const membership = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId: id, userId } },
    });

    if (!membership || (membership.role !== RoomRole.OWNER && membership.role !== RoomRole.MODERATOR)) {
      throw new ForbiddenException('Only room owners and moderators can modify room settings');
    }

    return this.prisma.room.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isPrivate !== undefined && { isPrivate: dto.isPrivate }),
        ...(dto.maxParticipants !== undefined && { maxParticipants: dto.maxParticipants }),
      },
    });
  }

  async remove(userId: string, id: string) {
    const room = await this.prisma.room.findUnique({
      where: { id },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    if (room.ownerId !== userId) {
      throw new ForbiddenException('Only the room owner can delete this room');
    }

    return this.prisma.room.delete({
      where: { id },
    });
  }
}
