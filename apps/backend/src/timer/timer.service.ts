import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateTimerModeDto } from './dto/create-timer-mode.dto.js';
import { CreateTimerSessionDto } from './dto/create-timer-session.dto.js';
import { TimerStatus } from '@prisma/client';

@Injectable()
export class TimerService {
  constructor(private readonly prisma: PrismaService) {}

  async createTimerMode(userId: string, dto: CreateTimerModeDto) {
    await this.validateStagesConfigCategories(userId, dto.stagesConfig as any[]);
    
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

  private async validateStagesConfigCategories(userId: string, stages: any[]) {
    if (!stages || stages.length === 0) return;
    
    const categoryIds = [...new Set(stages.map((s) => s.categoryId))];
    if (categoryIds.some(id => !id)) {
      throw new BadRequestException('All stages must have a categoryId');
    }

    const categories = await this.prisma.timerCategory.findMany({
      where: {
        id: { in: categoryIds },
        userId,
      },
    });

    if (categories.length !== categoryIds.length) {
      throw new BadRequestException('One or more categories are invalid or do not belong to you');
    }
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

    if (dto.stagesConfig) {
      await this.validateStagesConfigCategories(userId, dto.stagesConfig as any[]);
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

  // --- Core Lifecycle Logic --- //

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
    });
    
    if (sessions.length === 0) {
      throw new NotFoundException('No active timer session found');
    }

    // Attempt to resolve state
    const resolved = await this.resolveTimerState(sessions[0].id);
    if (!resolved || resolved.status === TimerStatus.COMPLETED) {
       throw new NotFoundException('No active timer session found');
    }
    
    return resolved;
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
    let session = await this.resolveTimerState(sessionId);

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
    const session = await this.resolveTimerState(sessionId);

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
    const session = await this.resolveTimerState(sessionId);

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
    let session = await this.resolveTimerState(sessionId);

    if (!session) throw new NotFoundException('TimerSession not found');
    if (session.userId !== userId) throw new ForbiddenException('Not your session');

    if (session.status === TimerStatus.COMPLETED) {
      return session; // idempotent
    }
    if (session.status === TimerStatus.CANCELLED || session.status === TimerStatus.PENDING) {
      throw new ConflictException('Cannot complete a pending or cancelled session');
    }

    return this.prisma.$transaction(async (tx) => {
      const mode = await tx.timerMode.findUnique({ where: { id: session!.timerModeId } });
      if (!mode) throw new NotFoundException('TimerMode not found');
      
      const completedSession = await this._finalizeTimerSession(tx, session, mode, new Date());
      if (!completedSession) {
         return tx.timerSession.findUnique({ where: { id: sessionId } });
      }
      return completedSession;
    });
  }

  // --- Lazy Evaluation & Catch-up --- //

  async resolveTimerState(sessionId: string) {
    const session = await this.prisma.timerSession.findUnique({
      where: { id: sessionId },
      include: { timerMode: true },
    });
    if (!session) return null;

    const now = new Date();

    if (session.status !== TimerStatus.RUNNING || !session.targetEndTime || session.targetEndTime.getTime() > now.getTime()) {
      return session; 
    }

    const stagesConfig = session.timerMode.stagesConfig as any[];
    if (!stagesConfig || stagesConfig.length === 0) return session;

    let overdueMs = now.getTime() - session.targetEndTime.getTime();
    if (overdueMs < 0) return session;

    let newCurrentStageIndex = session.currentStageIndex;
    let newTargetEndTime = session.targetEndTime;
    let shouldComplete = false;
    let effectiveCompletedAt: Date | null = null;

    // Fast path: if loop=true and ALL stages have autoAdvance=true
    const allAutoAdvance = stagesConfig.every(s => s.autoAdvance === true);
    if (session.timerMode.loop && allAutoAdvance) {
      const loopDurationMs = stagesConfig.reduce((sum, s) => sum + s.durationSeconds, 0) * 1000;
      if (loopDurationMs > 0) {
        const totalLoops = Math.floor(overdueMs / loopDurationMs);
        if (totalLoops > 0) {
          newCurrentStageIndex += totalLoops * stagesConfig.length;
          newTargetEndTime = new Date(newTargetEndTime.getTime() + totalLoops * loopDurationMs);
          overdueMs = now.getTime() - newTargetEndTime.getTime();
        }
      }
    }

    // Resolve remaining stages iteratively
    while (overdueMs >= 0) {
      const currentStage = stagesConfig[newCurrentStageIndex % stagesConfig.length];
      if (!currentStage.autoAdvance) {
        break; // Waiting state
      }

      if (!session.timerMode.loop && newCurrentStageIndex >= stagesConfig.length - 1) {
        shouldComplete = true;
        effectiveCompletedAt = newTargetEndTime; // Exact historical target
        break;
      }

      newCurrentStageIndex++;
      const nextStage = stagesConfig[newCurrentStageIndex % stagesConfig.length];
      newTargetEndTime = new Date(newTargetEndTime.getTime() + nextStage.durationSeconds * 1000);
      overdueMs = now.getTime() - newTargetEndTime.getTime();
    }

    if (shouldComplete) {
      // Execute transactional completion immediately using historical time
      const result = await this.prisma.$transaction(async (tx) => {
        return this._finalizeTimerSession(
          tx, 
          { ...session, currentStageIndex: newCurrentStageIndex, targetEndTime: newTargetEndTime }, 
          session.timerMode, 
          effectiveCompletedAt!
        );
      });
      return result || (await this.prisma.timerSession.findUnique({ where: { id: sessionId }, include: { timerMode: true } }));
    } else if (newCurrentStageIndex !== session.currentStageIndex) {
      // Optimistic concurrency update
      const result = await this.prisma.timerSession.updateMany({
        where: {
          id: sessionId,
          status: TimerStatus.RUNNING,
          currentStageIndex: session.currentStageIndex,
          targetEndTime: session.targetEndTime,
        },
        data: {
          currentStageIndex: newCurrentStageIndex,
          targetEndTime: newTargetEndTime,
        },
      });
      return this.prisma.timerSession.findUnique({ where: { id: sessionId }, include: { timerMode: true } });
    }

    return session;
  }

  private async _finalizeTimerSession(tx: any, session: any, mode: any, effectiveCompletedAt: Date) {
    if (!session.startedAt) {
        throw new ConflictException('Session has no startedAt time');
    }

    // 1. CAS Update for strict completion atomicity
    const result = await tx.timerSession.updateMany({
      where: { id: session.id, status: TimerStatus.RUNNING },
      data: {
        status: TimerStatus.COMPLETED,
        completedAt: effectiveCompletedAt,
      }
    });

    if (result.count === 0) {
      return null; // Concurrently modified
    }

    const stages = mode.stagesConfig as any[];
    const currentStage = stages[session.currentStageIndex % stages.length];
    
    let remainingMs = 0;
    if (session.status === TimerStatus.PAUSED && session.pausedAt && session.targetEndTime) {
      remainingMs = session.targetEndTime.getTime() - session.pausedAt.getTime();
    } else if (session.targetEndTime) {
      remainingMs = session.targetEndTime.getTime() - effectiveCompletedAt.getTime();
    }

    if (remainingMs < 0) remainingMs = 0;

    const stageDurationMs = currentStage.durationSeconds * 1000;
    let currentStageElapsedMs = stageDurationMs - remainingMs;
    if (currentStageElapsedMs < 0) currentStageElapsedMs = 0;

    let previousStagesElapsedMs = 0;
    const categoryDurations: Record<string, number> = {};

    if (currentStage && currentStage.categoryId) {
      categoryDurations[currentStage.categoryId] = currentStageElapsedMs;
    }

    for (let i = 0; i < session.currentStageIndex; i++) {
      const pastStage = stages[i % stages.length];
      const pastDurationMs = pastStage.durationSeconds * 1000;
      previousStagesElapsedMs += pastDurationMs;

      if (pastStage.categoryId) {
        categoryDurations[pastStage.categoryId] = (categoryDurations[pastStage.categoryId] || 0) + pastDurationMs;
      }
    }

    const totalElapsedMs = previousStagesElapsedMs + currentStageElapsedMs;
    const durationSeconds = Math.round(totalElapsedMs / 1000);

    const studySession = await tx.studySession.create({
      data: {
        userId: session.userId,
        timerSessionId: session.id,
        startedAt: session.startedAt!,
        endedAt: effectiveCompletedAt,
        durationSeconds,
      },
    });

    const categoryEntries = Object.entries(categoryDurations);
    if (categoryEntries.length > 0) {
      const allocations = categoryEntries.map(([categoryId, ms]) => {
        const exactSeconds = ms / 1000;
        const flooredSeconds = Math.floor(exactSeconds);
        const remainder = exactSeconds - flooredSeconds;
        return { categoryId, flooredSeconds, remainder, finalSeconds: flooredSeconds };
      });

      const allocatedSeconds = allocations.reduce((sum, a) => sum + a.flooredSeconds, 0);
      let remainingSeconds = durationSeconds - allocatedSeconds;

      if (remainingSeconds < 0) {
        throw new Error('Category duration allocation exceeded total session duration');
      }
      if (remainingSeconds > allocations.length) {
        throw new Error('Category duration allocation required more seconds than available categories');
      }

      allocations.sort((a, b) => {
        if (Math.abs(b.remainder - a.remainder) > 1e-9) {
          return b.remainder - a.remainder;
        }
        return a.categoryId.localeCompare(b.categoryId);
      });

      for (let i = 0; i < remainingSeconds; i++) {
        allocations[i].finalSeconds += 1;
      }

      const finalAllocatedSeconds = allocations.reduce((sum, a) => sum + a.finalSeconds, 0);
      if (finalAllocatedSeconds !== durationSeconds) {
        throw new Error('Category duration allocation invariant violated');
      }

      await tx.studySessionCategory.createMany({
        data: allocations.map((a) => ({
          studySessionId: studySession.id,
          categoryId: a.categoryId,
          durationSeconds: a.finalSeconds,
        })),
      });
    }

    return tx.timerSession.findUnique({ where: { id: session.id } });
  }
}
