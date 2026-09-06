import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateTimerModeDto } from './dto/create-timer-mode.dto.js';
import { CreateTimerSessionDto } from './dto/create-timer-session.dto.js';
import { TimerStatus } from '@prisma/client';

@Injectable()
export class TimerService {
  constructor(private readonly prisma: PrismaService) {}

  async createTimerMode(userId: string, dto: CreateTimerModeDto) {
    return this.prisma.timerMode.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description,
        loop: dto.loop,
        stagesConfig: dto.stagesConfig as any,
      },
    });
  }

  async getTimerModes(userId: string) {
    return this.prisma.timerMode.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTimerMode(userId: string, modeId: string) {
    const mode = await this.prisma.timerMode.findUnique({
      where: { id: modeId },
    });

    if (!mode) {
      throw new NotFoundException('TimerMode not found');
    }
    if (mode.userId !== userId) {
      throw new ForbiddenException('You do not own this TimerMode');
    }

    return mode;
  }

  async createTimerSession(userId: string, dto: CreateTimerSessionDto) {
    const mode = await this.getTimerMode(userId, dto.timerModeId);

    return this.prisma.timerSession.create({
      data: {
        userId,
        roomId: null, // Ensure this is explicitly null for personal timers
        timerModeId: mode.id,
        status: TimerStatus.PENDING,
        currentStageIndex: 0,
      },
    });
  }

  async startTimerSession(userId: string, sessionId: string) {
    const session = await this.prisma.timerSession.findUnique({
      where: { id: sessionId },
      include: { timerMode: true },
    });

    if (!session) throw new NotFoundException('TimerSession not found');
    if (session.userId !== userId) throw new ForbiddenException('Not your session');

    if (session.status === TimerStatus.RUNNING) {
      throw new ConflictException('Timer is already running');
    }
    if (session.status === TimerStatus.COMPLETED || session.status === TimerStatus.CANCELLED) {
      throw new ConflictException('Cannot start a completed or cancelled timer');
    }

    const stages = session.timerMode.stagesConfig as any[];
    const currentStage = stages[session.currentStageIndex];
    if (!currentStage) throw new BadRequestException('Invalid stage index');

    const now = new Date();

    if (session.status === TimerStatus.PENDING) {
      // First start
      const targetEndTime = new Date(now.getTime() + currentStage.durationSeconds * 1000);
      return this.prisma.timerSession.update({
        where: { id: sessionId },
        data: {
          status: TimerStatus.RUNNING,
          startedAt: now,
          targetEndTime,
          pausedAt: null,
        },
      });
    } else if (session.status === TimerStatus.PAUSED) {
      // Resume
      if (!session.targetEndTime || !session.pausedAt) {
        throw new ConflictException('Missing targetEndTime or pausedAt on paused session');
      }
      
      const remainingMs = session.targetEndTime.getTime() - session.pausedAt.getTime();
      const newTargetEndTime = new Date(now.getTime() + remainingMs);

      return this.prisma.timerSession.update({
        where: { id: sessionId },
        data: {
          status: TimerStatus.RUNNING,
          targetEndTime: newTargetEndTime,
          pausedAt: null,
        },
      });
    }
  }

  async pauseTimerSession(userId: string, sessionId: string) {
    const session = await this.prisma.timerSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) throw new NotFoundException('TimerSession not found');
    if (session.userId !== userId) throw new ForbiddenException('Not your session');

    if (session.status !== TimerStatus.RUNNING) {
      throw new ConflictException('Can only pause a RUNNING session');
    }

    return this.prisma.timerSession.update({
      where: { id: sessionId },
      data: {
        status: TimerStatus.PAUSED,
        pausedAt: new Date(),
      },
    });
  }

  async completeTimerSession(userId: string, sessionId: string) {
    const session = await this.prisma.timerSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) throw new NotFoundException('TimerSession not found');
    if (session.userId !== userId) throw new ForbiddenException('Not your session');

    if (session.status === TimerStatus.COMPLETED) {
      return session; // idempotent
    }
    if (session.status === TimerStatus.CANCELLED || session.status === TimerStatus.PENDING) {
      throw new ConflictException('Cannot complete a pending or cancelled session');
    }

    if (!session.startedAt) {
        throw new ConflictException('Session has no startedAt time');
    }

    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const mode = await tx.timerMode.findUnique({ where: { id: session.timerModeId } });
      if (!mode) throw new NotFoundException('TimerMode not found');
      
      const stages = mode.stagesConfig as any[];
      const currentStage = stages[session.currentStageIndex];
      
      let remainingMs = 0;
      if (session.status === TimerStatus.PAUSED && session.pausedAt && session.targetEndTime) {
        remainingMs = session.targetEndTime.getTime() - session.pausedAt.getTime();
      } else if (session.targetEndTime) {
        remainingMs = session.targetEndTime.getTime() - now.getTime();
      }

      // Cap remainingMs at 0 in case they overran the timer
      if (remainingMs < 0) remainingMs = 0;

      const stageDurationMs = currentStage.durationSeconds * 1000;
      let elapsedMs = stageDurationMs - remainingMs;
      if (elapsedMs < 0) elapsedMs = 0;
      
      const durationSeconds = Math.round(elapsedMs / 1000);

      const completedSession = await tx.timerSession.update({
        where: { id: sessionId },
        data: {
          status: TimerStatus.COMPLETED,
          completedAt: now,
        },
      });

      // StudySession only records focus time conceptually, but we'll record whatever stage it was for now, 
      // or should we only record FOCUS stages? The prompt doesn't specify, but StudySession is the historical log.
      // We'll create it for the completed stage duration.
      await tx.studySession.create({
        data: {
          userId,
          timerSessionId: sessionId,
          startedAt: session.startedAt!,
          endedAt: now,
          durationSeconds,
        },
      });

      return completedSession;
    });
  }
}
