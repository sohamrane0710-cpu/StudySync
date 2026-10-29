import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TimerPhase, TimerStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { StudySessionsService } from '../study-sessions/study-sessions.service';
import { CancelTimerDto } from './dto/cancel-timer.dto';
import { CompleteTimerDto } from './dto/complete-timer.dto';
import { StartTimerDto } from './dto/start-timer.dto';

@Injectable()
export class TimersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly studySessionsService: StudySessionsService,
  ) {}

  async getActive(userId: string) {
    const session = await this.prisma.timerSession.findFirst({
      where: {
        userId,
        status: { in: [TimerStatus.RUNNING, TimerStatus.PAUSED] },
      },
      include: {
        timerMode: true,
      },
    });

    if (!session) {
      return null;
    }

    let currentRemaining = session.remainingSeconds;
    if (session.status === TimerStatus.RUNNING && session.expectedEndTime) {
      const remainingMs = session.expectedEndTime.getTime() - Date.now();
      currentRemaining = Math.max(0, Math.round(remainingMs / 1000));
    }

    return {
      ...session,
      authoritativeRemainingSeconds: currentRemaining,
      isExpired: currentRemaining === 0,
    };
  }

  async start(userId: string, dto: StartTimerDto) {
    // 1. Verify no existing active timer
    const existing = await this.prisma.timerSession.findFirst({
      where: {
        userId,
        status: { in: [TimerStatus.RUNNING, TimerStatus.PAUSED] },
      },
    });

    if (existing) {
      throw new ConflictException(
        'An active timer session is already running. Please pause, complete, or cancel it first.',
      );
    }

    const phase = dto.phase || TimerPhase.FOCUS;

    // 2. Determine target duration
    let targetDuration = dto.durationOverride;
    let timerModeId = dto.timerModeId;

    if (!targetDuration) {
      if (!timerModeId) {
        // Look up user's default timer mode
        const preferences = await this.prisma.userPreference.findUnique({
          where: { userId },
        });
        if (preferences?.defaultTimerModeId) {
          timerModeId = preferences.defaultTimerModeId;
        }
      }

      if (timerModeId) {
        const mode = await this.prisma.timerMode.findUnique({
          where: { id: timerModeId },
        });

        if (mode) {
          if (phase === TimerPhase.FOCUS) {
            targetDuration = mode.focusDuration;
          } else if (phase === TimerPhase.SHORT_BREAK) {
            targetDuration = mode.shortBreakDuration;
          } else if (phase === TimerPhase.LONG_BREAK) {
            targetDuration = mode.longBreakDuration;
          }
        }
      }

      // Safe defaults if no mode or override specified
      if (!targetDuration) {
        if (phase === TimerPhase.FOCUS) targetDuration = 1500; // 25 mins
        else if (phase === TimerPhase.SHORT_BREAK) targetDuration = 300; // 5 mins
        else targetDuration = 900; // 15 mins
      }
    }

    const now = new Date();
    const expectedEndTime = new Date(now.getTime() + targetDuration * 1000);

    const session = await this.prisma.timerSession.create({
      data: {
        userId,
        timerModeId,
        phase,
        status: TimerStatus.RUNNING,
        targetDuration,
        remainingSeconds: targetDuration,
        startedAt: now,
        expectedEndTime,
      },
      include: {
        timerMode: true,
      },
    });

    return {
      ...session,
      authoritativeRemainingSeconds: targetDuration,
      isExpired: false,
    };
  }

  async pause(userId: string) {
    const session = await this.prisma.timerSession.findFirst({
      where: {
        userId,
        status: { in: [TimerStatus.RUNNING, TimerStatus.PAUSED] },
      },
      include: { timerMode: true },
    });

    if (!session) {
      throw new NotFoundException('No active timer session found');
    }

    if (session.status !== TimerStatus.RUNNING) {
      throw new BadRequestException('Timer session is not in RUNNING state');
    }

    const now = new Date();
    const remainingMs = session.expectedEndTime
      ? session.expectedEndTime.getTime() - now.getTime()
      : session.remainingSeconds * 1000;
    const remainingSeconds = Math.max(0, Math.round(remainingMs / 1000));

    const updated = await this.prisma.timerSession.update({
      where: { id: session.id },
      data: {
        status: TimerStatus.PAUSED,
        remainingSeconds,
        pausedAt: now,
        expectedEndTime: null,
      },
      include: { timerMode: true },
    });

    return {
      ...updated,
      authoritativeRemainingSeconds: remainingSeconds,
      isExpired: remainingSeconds === 0,
    };
  }

  async resume(userId: string) {
    const session = await this.prisma.timerSession.findFirst({
      where: {
        userId,
        status: { in: [TimerStatus.RUNNING, TimerStatus.PAUSED] },
      },
      include: { timerMode: true },
    });

    if (!session) {
      throw new NotFoundException('No active timer session found');
    }

    if (session.status !== TimerStatus.PAUSED) {
      throw new BadRequestException('Timer session is not in PAUSED state');
    }

    const now = new Date();
    const expectedEndTime = new Date(now.getTime() + session.remainingSeconds * 1000);

    const updated = await this.prisma.timerSession.update({
      where: { id: session.id },
      data: {
        status: TimerStatus.RUNNING,
        pausedAt: null,
        expectedEndTime,
      },
      include: { timerMode: true },
    });

    return {
      ...updated,
      authoritativeRemainingSeconds: session.remainingSeconds,
      isExpired: session.remainingSeconds === 0,
    };
  }

  async complete(userId: string, dto: CompleteTimerDto) {
    // Transactional, idempotent completion
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.timerSession.findFirst({
        where: {
          userId,
          status: { in: [TimerStatus.RUNNING, TimerStatus.PAUSED] },
        },
        include: { timerMode: true },
      });

      if (!session) {
        // Idempotency check: see if the user recently completed a session
        const recentCompleted = await tx.timerSession.findFirst({
          where: {
            userId,
            status: TimerStatus.COMPLETED,
          },
          orderBy: { updatedAt: 'desc' },
          include: {
            studySessions: {
              include: {
                categories: { include: { category: true } },
                labels: { include: { label: true } },
              },
            },
          },
        });

        if (recentCompleted && recentCompleted.studySessions.length > 0) {
          return {
            timerSession: recentCompleted,
            studySession: recentCompleted.studySessions[0],
            idempotentReplay: true,
          };
        }

        throw new NotFoundException('No active timer session available to complete');
      }

      const now = new Date();
      let actualDuration = session.targetDuration;

      if (session.status === TimerStatus.RUNNING && session.expectedEndTime) {
        if (now < session.expectedEndTime) {
          const remainingMs = session.expectedEndTime.getTime() - now.getTime();
          const remainingSeconds = Math.max(0, Math.round(remainingMs / 1000));
          actualDuration = Math.max(0, session.targetDuration - remainingSeconds);
        }
      } else if (session.status === TimerStatus.PAUSED) {
        actualDuration = Math.max(0, session.targetDuration - session.remainingSeconds);
      }

      // Mark session as COMPLETED
      const completedSession = await tx.timerSession.update({
        where: { id: session.id },
        data: {
          status: TimerStatus.COMPLETED,
          remainingSeconds: 0,
          expectedEndTime: null,
          totalFocusSeconds:
            session.phase === TimerPhase.FOCUS
              ? session.totalFocusSeconds + actualDuration
              : session.totalFocusSeconds,
          cycleCount:
            session.phase === TimerPhase.FOCUS
              ? session.cycleCount + 1
              : session.cycleCount,
        },
      });

      let studySessionRecord = null;

      // For focus sessions, record authoritative credited study history
      if (session.phase === TimerPhase.FOCUS) {
        studySessionRecord = await this.studySessionsService.create(
          userId,
          {
            title: dto.title || session.timerMode?.name || 'Focus Session',
            phase: TimerPhase.FOCUS,
            status: 'COMPLETED',
            targetDuration: session.targetDuration,
            actualDuration,
            startedAt: session.startedAt.toISOString(),
            endedAt: now.toISOString(),
            notes: dto.notes,
            categoryIds: dto.categoryIds,
            labelIds: dto.labelIds,
            timerSessionId: session.id,
          },
          tx,
        );
      }

      // Calculate next recommended phase
      const interval = session.timerMode?.longBreakInterval || 4;
      let nextPhase: TimerPhase = TimerPhase.SHORT_BREAK;
      if (session.phase === TimerPhase.FOCUS) {
        if (completedSession.cycleCount % interval === 0) {
          nextPhase = TimerPhase.LONG_BREAK;
        } else {
          nextPhase = TimerPhase.SHORT_BREAK;
        }
      } else {
        nextPhase = TimerPhase.FOCUS;
      }

      return {
        timerSession: completedSession,
        studySession: studySessionRecord,
        creditedDuration: actualDuration,
        nextPhase,
        idempotentReplay: false,
      };
    });
  }

  async cancel(userId: string, dto: CancelTimerDto) {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.timerSession.findFirst({
        where: {
          userId,
          status: { in: [TimerStatus.RUNNING, TimerStatus.PAUSED] },
        },
        include: { timerMode: true },
      });

      if (!session) {
        throw new NotFoundException('No active timer session to cancel');
      }

      const now = new Date();
      let elapsedSeconds = 0;

      if (session.status === TimerStatus.RUNNING && session.expectedEndTime) {
        const remainingMs = Math.max(0, session.expectedEndTime.getTime() - now.getTime());
        elapsedSeconds = Math.max(0, session.targetDuration - Math.round(remainingMs / 1000));
      } else if (session.status === TimerStatus.PAUSED) {
        elapsedSeconds = Math.max(0, session.targetDuration - session.remainingSeconds);
      }

      // Update timer session to CANCELLED
      const cancelledSession = await tx.timerSession.update({
        where: { id: session.id },
        data: {
          status: TimerStatus.CANCELLED,
          remainingSeconds: 0,
          expectedEndTime: null,
        },
      });

      let interruptedStudyRecord = null;

      // Save partial record if minimum 60 seconds threshold met
      if (
        session.phase === TimerPhase.FOCUS &&
        elapsedSeconds >= 60 &&
        dto.savePartialRecord !== false
      ) {
        interruptedStudyRecord = await this.studySessionsService.create(
          userId,
          {
            title: session.timerMode?.name
              ? `${session.timerMode.name} (Interrupted)`
              : 'Interrupted Session',
            phase: TimerPhase.FOCUS,
            status: 'INTERRUPTED',
            targetDuration: session.targetDuration,
            actualDuration: elapsedSeconds,
            startedAt: session.startedAt.toISOString(),
            endedAt: now.toISOString(),
            notes: dto.reason ? `Cancelled: ${dto.reason}` : 'Cancelled early',
            timerSessionId: session.id,
          },
          tx,
        );
      }

      return {
        timerSession: cancelledSession,
        interruptedStudyRecord,
        elapsedSeconds,
      };
    });
  }
}
