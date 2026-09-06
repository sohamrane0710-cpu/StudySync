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

  async updateTimerMode(userId: string, modeId: string, dto: import('./dto/update-timer-mode.dto.js').UpdateTimerModeDto) {
    await this.getTimerMode(userId, modeId); // Verify ownership and existence

    // Check if there are active timer sessions using this mode
    const activeSessions = await this.prisma.timerSession.findFirst({
      where: {
        timerModeId: modeId,
        status: {
          in: [TimerStatus.PENDING, TimerStatus.RUNNING, TimerStatus.PAUSED],
        },
      },
    });

    if (activeSessions) {
      throw new ConflictException('Cannot edit TimerMode because it is currently in use by an active session.');
    }

    return this.prisma.timerMode.update({
      where: { id: modeId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.loop !== undefined && { loop: dto.loop }),
        ...(dto.stagesConfig !== undefined && { stagesConfig: dto.stagesConfig as any }),
      },
    });
  }

  async deleteTimerMode(userId: string, modeId: string) {
    await this.getTimerMode(userId, modeId); // Verify ownership and existence

    try {
      await this.prisma.timerMode.delete({
        where: { id: modeId },
      });
      return { success: true };
    } catch (error: any) {
      // Prisma error code for foreign key constraint failure or raw Postgres RESTRICT error
      if (error.code === 'P2003' || (error.message && error.message.includes('violates RESTRICT setting'))) {
        throw new ConflictException('This mode has history and cannot be deleted.');
      }
      throw error;
    }
  }

  async getActiveTimerSession(userId: string) {
    const sessions = await this.prisma.timerSession.findMany({
      where: {
        userId,
        roomId: null,
        status: {
          in: [TimerStatus.PENDING, TimerStatus.RUNNING, TimerStatus.PAUSED],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
      include: { timerMode: true },
    });
    
    if (sessions.length === 0) {
      throw new NotFoundException('No active timer session found');
    }
    
    return sessions[0];
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
    const currentStage = stages[session.currentStageIndex % stages.length];
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

  async nextStageTimerSession(userId: string, sessionId: string) {
    const session = await this.prisma.timerSession.findUnique({
      where: { id: sessionId },
      include: { timerMode: true },
    });

    if (!session) throw new NotFoundException('TimerSession not found');
    if (session.userId !== userId) throw new ForbiddenException('Not your session');

    if (session.status !== TimerStatus.RUNNING) {
      throw new ConflictException('Can only advance a RUNNING session');
    }

    const now = new Date();

    // Prevent premature skipping (with a 2-second grace period for network/execution latency)
    if (session.targetEndTime && session.targetEndTime.getTime() > now.getTime() + 2000) {
      throw new ConflictException('Cannot transition stage before current stage duration completes');
    }

    const stages = session.timerMode.stagesConfig as any[];
    const nextIndex = session.currentStageIndex + 1;
    
    // If loop is false and we reached the end, complete it.
    if (!session.timerMode.loop && nextIndex >= stages.length) {
      return this.completeTimerSession(userId, sessionId);
    }

    const nextStage = stages[nextIndex % stages.length];
    const targetEndTime = new Date(now.getTime() + nextStage.durationSeconds * 1000);

    return this.prisma.timerSession.update({
      where: { id: sessionId },
      data: {
        currentStageIndex: nextIndex,
        targetEndTime,
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
      const currentStage = stages[session.currentStageIndex % stages.length];
      
      let remainingMs = 0;
      if (session.status === TimerStatus.PAUSED && session.pausedAt && session.targetEndTime) {
        remainingMs = session.targetEndTime.getTime() - session.pausedAt.getTime();
      } else if (session.targetEndTime) {
        remainingMs = session.targetEndTime.getTime() - now.getTime();
      }

      // Cap remainingMs at 0 in case they overran the timer
      if (remainingMs < 0) remainingMs = 0;

      const stageDurationMs = currentStage.durationSeconds * 1000;
      let currentStageElapsedMs = stageDurationMs - remainingMs;
      if (currentStageElapsedMs < 0) currentStageElapsedMs = 0;

      let previousStagesElapsedMs = 0;
      for (let i = 0; i < session.currentStageIndex; i++) {
        previousStagesElapsedMs += stages[i % stages.length].durationSeconds * 1000;
      }

      const totalElapsedMs = previousStagesElapsedMs + currentStageElapsedMs;
      const durationSeconds = Math.round(totalElapsedMs / 1000);

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
