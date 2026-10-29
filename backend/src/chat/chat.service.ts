import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RoomRole } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { EditMessageDto } from './dto/edit-message.dto';
import { QueryMessagesDto } from './dto/query-messages.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertRoomMembership(userId: string, roomId: string) {
    const membership = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });

    if (!membership) {
      throw new ForbiddenException('You must be a member of this room to access chat');
    }

    return membership;
  }

  async getMessages(userId: string, roomId: string, query: QueryMessagesDto) {
    await this.assertRoomMembership(userId, roomId);

    const limit = query.limit || 30;
    const where: any = {
      roomId,
      deletedAt: null,
      ...(query.before && { createdAt: { lt: new Date(query.before) } }),
    };

    const messages = await this.prisma.message.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    const chronologicallyOrdered = [...messages].reverse();
    const nextCursor = messages.length === limit ? messages[messages.length - 1].createdAt : null;

    return {
      messages: chronologicallyOrdered,
      nextCursor,
    };
  }

  async sendMessage(userId: string, roomId: string, dto: SendMessageDto) {
    await this.assertRoomMembership(userId, roomId);

    return this.prisma.message.create({
      data: {
        roomId,
        senderId: userId,
        content: dto.content,
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  async editMessage(
    userId: string,
    roomId: string,
    messageId: string,
    dto: EditMessageDto,
  ) {
    await this.assertRoomMembership(userId, roomId);

    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message || message.roomId !== roomId || message.deletedAt !== null) {
      throw new NotFoundException('Message not found');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }

    return this.prisma.message.update({
      where: { id: messageId },
      data: {
        content: dto.content,
        isEdited: true,
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  async deleteMessage(userId: string, roomId: string, messageId: string) {
    const membership = await this.assertRoomMembership(userId, roomId);

    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message || message.roomId !== roomId || message.deletedAt !== null) {
      throw new NotFoundException('Message not found');
    }

    const isAuthor = message.senderId === userId;
    const isPrivileged =
      membership.role === RoomRole.OWNER || membership.role === RoomRole.MODERATOR;

    if (!isAuthor && !isPrivileged) {
      throw new ForbiddenException(
        'You do not have permission to delete this message',
      );
    }

    return this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    });
  }
}
