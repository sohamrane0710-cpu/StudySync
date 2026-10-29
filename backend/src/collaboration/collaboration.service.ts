import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RoomRole, TimerPhase, TimerStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { StudySessionsService } from '../study-sessions/study-sessions.service';
import { CollaborationGateway } from './collaboration.gateway';
import { StartRoomTimerDto } from './dto/start-room-timer.dto';

@Injectable()
export class CollaborationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly studySessionsService: StudySessionsService,
    private readonly gateway: CollaborationGateway,
  ) {}

  private async assertRoomPrivilege(
    userId: string,
    roomId: string,
    requiredRoles: RoomRole[] = [RoomRole.OWNER, RoomRole.MODERATOR],
  ) {
    const membership = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });

    if (!membership) {
      throw new ForbiddenException('You must be a member of this room');
    }

    if (!requiredRoles.includes(membership.role)) {
      throw new ForbiddenException(
        `Action requires room role: ${requiredRoles.join(' or ')}`,
      );
    }

    return membership;
  }

  async getRoomTimer(userId: string, roomId: string) {
    await this.assertRoomPrivilege(userId, roomId, [
      RoomRole.OWNER,
      RoomRole.MODERATOR,
      RoomRole.MEMBER,
    ]);

    const session = await this.prisma.roomStudySession.findFirst({
      where: {
        roomId,
        status: { in: [TimerStatus.RUNNING, TimerStatus.PAUSED] },
      },
      include: {
        timerMode: true,
        participants: {
          where: { leftAt: null },
          include: {
            user: {
              select: { id: true, username: true, displayName: true, avatarUrl: true },
            },
          },
        },
      },
    });

    if (!session) {
      return null;
    }

    let authoritativeRemaining = session.remainingSeconds;
    if (session.status === TimerStatus.RUNNING && session.expectedEndTime) {
      const remainingMs = session.expectedEndTime.getTime() - Date.now();
      authoritativeRemaining = Math.max(0, Math.round(remainingMs / 1000));
    }

    return {
      ...session,
      authoritativeRemainingSeconds: authoritativeRemaining,
      isExpired: authoritativeRemaining === 0,
      activeParticipantCount: session.participants.length,
    };
  }

  async startRoomTimer(userId: string, roomId: string, dto: StartRoomTimerDto) {
    await this.assertRoomPrivilege(userId, roomId, [RoomRole.OWNER, RoomRole.MODERATOR]);

    // Ensure no active timer exists for this room
    const existing = await this.prisma.roomStudySession.findFirst({
      where: {
        roomId,
        status: { in: [TimerStatus.RUNNING, TimerStatus.PAUSED] },
      },
    });

    if (existing) {
      throw new ConflictException('A room timer is already running or paused');
    }

    const phase = dto.phase || TimerPhase.FOCUS;
    let targetDuration = dto.durationOverride;

    if (!targetDuration && dto.timerModeId) {
      const mode = await this.prisma.timerMode.findUnique({
        where: { id: dto.timerModeId },
      });
      if (mode) {
        if (phase === TimerPhase.FOCUS) targetDuration = mode.focusDuration;
        else if (phase === TimerPhase.SHORT_BREAK) targetDuration = mode.shortBreakDuration;
        else targetDuration = mode.longBreakDuration;
      }
    }

    if (!targetDuration) {
      targetDuration = phase === TimerPhase.FOCUS ? 1500 : 300;
    }

    const now = new Date();
    const expectedEndTime = new Date(now.getTime() + targetDuration * 1000);

    const session = await this.prisma.$transaction(async (tx) => {
      const roomSession = await tx.roomStudySession.create({
        data: {
          roomId,
          timerModeId: dto.timerModeId,
          phase,
          status: TimerStatus.RUNNING,
          targetDuration,
          remainingSeconds: targetDuration,
          startedAt: now,
          expectedEndTime,
        },
      });

      // Automatically register the starting moderator as first participant
      await tx.roomStudySessionParticipant.create({
        data: {
          roomStudySessionId: roomSession.id,
          userId,
          joinedAt: now,
        },
      });

      return roomSession;
    });

    const payload = {
      ...session,
      authoritativeRemainingSeconds: targetDuration,
      isExpired: false,
    };

    this.gateway.broadcastToRoom(roomId, 'timer:started', payload);
    return payload;
  }

  async pauseRoomTimer(userId: string, roomId: string) {
    await this.assertRoomPrivilege(userId, roomId, [RoomRole.OWNER, RoomRole.MODERATOR]);

    const session = await this.prisma.roomStudySession.findFirst({
      where: {
        roomId,
        status: TimerStatus.RUNNING,
      },
    });

    if (!session) {
      throw new NotFoundException('No running timer to pause in this room');
    }

    const now = new Date();
    const remainingMs = session.expectedEndTime
      ? session.expectedEndTime.getTime() - now.getTime()
      : session.remainingSeconds * 1000;
    const remainingSeconds = Math.max(0, Math.round(remainingMs / 1000));

    const updated = await this.prisma.roomStudySession.update({
      where: { id: session.id },
      data: {
        status: TimerStatus.PAUSED,
        remainingSeconds,
        pausedAt: now,
        expectedEndTime: null,
      },
    });

    const payload = {
      ...updated,
      authoritativeRemainingSeconds: remainingSeconds,
      isExpired: remainingSeconds === 0,
    };

    this.gateway.broadcastToRoom(roomId, 'timer:paused', payload);
    return payload;
  }

  async resumeRoomTimer(userId: string, roomId: string) {
    await this.assertRoomPrivilege(userId, roomId, [RoomRole.OWNER, RoomRole.MODERATOR]);

    const session = await this.prisma.roomStudySession.findFirst({
      where: {
        roomId,
        status: TimerStatus.PAUSED,
      },
    });

    if (!session) {
      throw new NotFoundException('No paused timer to resume in this room');
    }

    const now = new Date();
    const expectedEndTime = new Date(now.getTime() + session.remainingSeconds * 1000);

    const updated = await this.prisma.roomStudySession.update({
      where: { id: session.id },
      data: {
        status: TimerStatus.RUNNING,
        pausedAt: null,
        expectedEndTime,
      },
    });

    const payload = {
      ...updated,
      authoritativeRemainingSeconds: session.remainingSeconds,
      isExpired: session.remainingSeconds === 0,
    };

    this.gateway.broadcastToRoom(roomId, 'timer:resumed', payload);
    return payload;
  }

  async completeRoomTimer(userId: string, roomId: string) {
    await this.assertRoomPrivilege(userId, roomId, [RoomRole.OWNER, RoomRole.MODERATOR]);

    return this.prisma.$transaction(async (tx) => {
      const session = await tx.roomStudySession.findFirst({
        where: {
          roomId,
          status: { in: [TimerStatus.RUNNING, TimerStatus.PAUSED] },
        },
        include: {
          room: true,
          timerMode: true,
          participants: {
            where: { leftAt: null },
          },
        },
      });

      if (!session) {
        throw new NotFoundException('No active room timer to complete');
      }

      const now = new Date();

      // Mark room timer as COMPLETED
      const completedRoomSession = await tx.roomStudySession.update({
        where: { id: session.id },
        data: {
          status: TimerStatus.COMPLETED,
          remainingSeconds: 0,
          expectedEndTime: null,
        },
      });

      // Close all active participant records and commit individual study records
      for (const participant of session.participants) {
        const joinedAtTime = participant.joinedAt.getTime();
        const participationSeconds = Math.max(
          0,
          Math.min(
            session.targetDuration,
            Math.round((now.getTime() - joinedAtTime) / 1000),
          ),
        );

        let personalStudySession = null;
        if (session.phase === TimerPhase.FOCUS && participationSeconds >= 60) {
          personalStudySession = await this.studySessionsService.create(
            participant.userId,
            {
              title: `Room: ${session.room.name}`,
              phase: TimerPhase.FOCUS,
              status: 'COMPLETED',
              targetDuration: session.targetDuration,
              actualDuration: participationSeconds,
              startedAt: participant.joinedAt.toISOString(),
              endedAt: now.toISOString(),
              notes: `Participated in room study session "${session.room.name}"`,
              roomStudySessionId: session.id,
            },
            tx,
          );
        }

        await tx.roomStudySessionParticipant.update({
          where: { id: participant.id },
          data: {
            leftAt: now,
            creditedSeconds: participationSeconds,
            personalStudySessionId: personalStudySession?.id || null,
          },
        });
      }

      const payload = {
        roomSession: completedRoomSession,
        completedAt: now,
        participantCount: session.participants.length,
      };

      this.gateway.broadcastToRoom(roomId, 'timer:completed', payload);
      return payload;
    });
  }

  async cancelRoomTimer(userId: string, roomId: string) {
    await this.assertRoomPrivilege(userId, roomId, [RoomRole.OWNER, RoomRole.MODERATOR]);

    return this.prisma.$transaction(async (tx) => {
      const session = await tx.roomStudySession.findFirst({
        where: {
          roomId,
          status: { in: [TimerStatus.RUNNING, TimerStatus.PAUSED] },
        },
        include: {
          participants: { where: { leftAt: null } },
        },
      });

      if (!session) {
        throw new NotFoundException('No active room timer to cancel');
      }

      const now = new Date();

      const cancelled = await tx.roomStudySession.update({
        where: { id: session.id },
        data: {
          status: TimerStatus.CANCELLED,
          remainingSeconds: 0,
          expectedEndTime: null,
        },
      });

      // Mark leftAt for remaining participants
      await tx.roomStudySessionParticipant.updateMany({
        where: {
          roomStudySessionId: session.id,
          leftAt: null,
        },
        data: {
          leftAt: now,
        },
      });

      this.gateway.broadcastToRoom(roomId, 'timer:cancelled', { roomId });
      return cancelled;
    });
  }

  async joinRoomTimer(userId: string, roomId: string) {
    await this.assertRoomPrivilege(userId, roomId, [
      RoomRole.OWNER,
      RoomRole.MODERATOR,
      RoomRole.MEMBER,
    ]);

    const session = await this.prisma.roomStudySession.findFirst({
      where: {
        roomId,
        status: { in: [TimerStatus.RUNNING, TimerStatus.PAUSED] },
      },
    });

    if (!session) {
      throw new NotFoundException('There is no active timer in this room to join');
    }

    const existingParticipant = await this.prisma.roomStudySessionParticipant.findUnique({
      where: {
        roomStudySessionId_userId: {
          roomStudySessionId: session.id,
          userId,
        },
      },
    });

    if (existingParticipant && existingParticipant.leftAt === null) {
      return existingParticipant;
    }

    const now = new Date();
    const participant = await this.prisma.roomStudySessionParticipant.upsert({
      where: {
        roomStudySessionId_userId: {
          roomStudySessionId: session.id,
          userId,
        },
      },
      update: {
        joinedAt: now,
        leftAt: null,
        creditedSeconds: 0,
        personalStudySessionId: null,
      },
      create: {
        roomStudySessionId: session.id,
        userId,
        joinedAt: now,
      },
      include: {
        user: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
      },
    });

    this.gateway.broadcastToRoom(roomId, 'participant:joined', {
      userId,
      user: participant.user,
      joinedAt: now,
    });

    return participant;
  }

  async leaveRoomTimer(userId: string, roomId: string) {
    await this.assertRoomPrivilege(userId, roomId, [
      RoomRole.OWNER,
      RoomRole.MODERATOR,
      RoomRole.MEMBER,
    ]);

    const session = await this.prisma.roomStudySession.findFirst({
      where: {
        roomId,
        status: { in: [TimerStatus.RUNNING, TimerStatus.PAUSED] },
      },
      include: { room: true },
    });

    if (!session) {
      throw new NotFoundException('No active room timer found');
    }

    return this.prisma.$transaction(async (tx) => {
      const participant = await tx.roomStudySessionParticipant.findUnique({
        where: {
          roomStudySessionId_userId: {
            roomStudySessionId: session.id,
            userId,
          },
        },
      });

      if (!participant || participant.leftAt !== null) {
        throw new BadRequestException('You are not currently an active participant in this room timer');
      }

      const now = new Date();
      const participationSeconds = Math.max(
        0,
        Math.min(
          session.targetDuration,
          Math.round((now.getTime() - participant.joinedAt.getTime()) / 1000),
        ),
      );

      let personalStudySession = null;
      if (session.phase === TimerPhase.FOCUS && participationSeconds >= 60) {
        personalStudySession = await this.studySessionsService.create(
          userId,
          {
            title: `Room: ${session.room.name}`,
            phase: TimerPhase.FOCUS,
            status: 'COMPLETED',
            targetDuration: session.targetDuration,
            actualDuration: participationSeconds,
            startedAt: participant.joinedAt.toISOString(),
            endedAt: now.toISOString(),
            notes: `Participated for ${Math.round(participationSeconds / 60)}m in room "${session.room.name}"`,
            roomStudySessionId: session.id,
          },
          tx,
        );
      }

      const updated = await tx.roomStudySessionParticipant.update({
        where: { id: participant.id },
        data: {
          leftAt: now,
          creditedSeconds: participationSeconds,
          personalStudySessionId: personalStudySession?.id || null,
        },
      });

      this.gateway.broadcastToRoom(roomId, 'participant:left', {
        userId,
        leftAt: now,
        creditedSeconds: participationSeconds,
      });

      return updated;
    });
  }
}
