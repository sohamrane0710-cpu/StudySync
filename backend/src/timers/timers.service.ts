import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  TimerDirection,
  TimerPhase,
  TimerStatus,
  TimerStepType,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { StudySessionsService } from '../study-sessions/study-sessions.service';
import { CancelTimerDto } from './dto/cancel-timer.dto';
import { CompleteTimerDto } from './dto/complete-timer.dto';
import { FinishSequenceDto } from './dto/finish-sequence.dto';
import { PauseTimerDto } from './dto/pause-timer.dto';
import { ResumeTimerDto } from './dto/resume-timer.dto';
import { SkipTimerDto } from './dto/skip-timer.dto';
import { StartTimerDto } from './dto/start-timer.dto';

export interface SequenceSnapshotStep {
  id?: string;
  name: string;
  type: TimerStepType;
  configuredDuration: number; // configured default from TimerModeStep
  effectiveDuration: number;  // duration actually used for this execution
  duration: number;           // preserved as effectiveDuration for backward compatibility
  order: number;
}

export interface TimerSequenceSnapshot {
  modeId: string | null;
  modeName: string;
  isLooping: boolean;
  defaultDirection: TimerDirection;
  direction: TimerDirection;
  totalSteps: number;
  currentStepIndex: number;
  steps: SequenceSnapshotStep[];
}

@Injectable()
export class TimersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly studySessionsService: StudySessionsService,
  ) {}

  /**
   * Acquire an exclusive row-level lock on the user's Profile record.
   * This serializes all concurrent timer operations for the same user in PostgreSQL.
   */
  private async lockUser(tx: Prisma.TransactionClient, userId: string): Promise<void> {
    await tx.$queryRaw`SELECT id FROM profiles WHERE id = ${userId}::uuid FOR UPDATE`;
  }

  /**
   * Builds an immutable sequence snapshot preserving the mode defaults, steps,
   * loop configuration, direction, and any per-run overrides.
   */
  private async buildSequenceSnapshot(
    tx: Prisma.TransactionClient,
    userId: string,
    timerModeId?: string,
    stepIndex = 0,
    durationOverride?: number,
    directionOverride?: TimerDirection,
    legacyPhase?: TimerPhase,
  ): Promise<{
    snapshot: TimerSequenceSnapshot;
    selectedStep: SequenceSnapshotStep;
    modeId: string | null;
    direction: TimerDirection;
  }> {
    let mode = null;

    if (timerModeId) {
      mode = await tx.timerMode.findFirst({
        where: {
          id: timerModeId,
          isArchived: false,
          OR: [{ userId }, { userId: null }],
        },
        include: { steps: { orderBy: { order: 'asc' } } },
      });

      if (!mode) {
        throw new NotFoundException(`Timer mode with ID "${timerModeId}" not found`);
      }
    } else {
      // Look up user's default timer mode preference
      const preferences = await tx.userPreference.findUnique({
        where: { userId },
      });

      if (preferences?.defaultTimerModeId) {
        mode = await tx.timerMode.findFirst({
          where: {
            id: preferences.defaultTimerModeId,
            isArchived: false,
            OR: [{ userId }, { userId: null }],
          },
          include: { steps: { orderBy: { order: 'asc' } } },
        });
      }

      if (!mode) {
        // Fallback to first global mode
        mode = await tx.timerMode.findFirst({
          where: { userId: null, isArchived: false },
          include: { steps: { orderBy: { order: 'asc' } } },
        });
      }
    }

    let snapshotSteps: SequenceSnapshotStep[] = [];
    let isLooping = true;
    let defaultDirection: TimerDirection = TimerDirection.COUNTDOWN;
    let modeName = 'Default Focus';
    let modeId: string | null = null;

    if (mode && mode.steps && mode.steps.length > 0) {
      modeId = mode.id;
      modeName = mode.name;
      isLooping = mode.isLooping ?? true;
      defaultDirection = mode.defaultDirection ?? TimerDirection.COUNTDOWN;
      snapshotSteps = mode.steps.map((s) => ({
        id: s.id,
        name: s.name,
        type: s.type,
        configuredDuration: s.duration,
        effectiveDuration: s.duration,
        duration: s.duration,
        order: s.order,
      }));
    } else {
      // Ad-hoc single step or legacy fallback
      const initialType =
        legacyPhase === TimerPhase.SHORT_BREAK || legacyPhase === TimerPhase.LONG_BREAK
          ? TimerStepType.REST
          : TimerStepType.FOCUS;
      const initialDuration =
        durationOverride ||
        (initialType === TimerStepType.FOCUS ? 1500 : legacyPhase === TimerPhase.LONG_BREAK ? 900 : 300);

      snapshotSteps = [
        {
          name: initialType === TimerStepType.FOCUS ? 'Focus' : 'Break',
          type: initialType,
          configuredDuration: initialDuration,
          effectiveDuration: initialDuration,
          duration: initialDuration,
          order: 0,
        },
      ];
      isLooping = true;
      defaultDirection = TimerDirection.COUNTDOWN;
      modeName = initialType === TimerStepType.FOCUS ? 'Focus' : 'Break';
      modeId = null;
    }

    // Resolve starting index safely
    let resolvedIndex = stepIndex;
    if (resolvedIndex < 0 || resolvedIndex >= snapshotSteps.length) {
      resolvedIndex = 0;
    }

    const direction = directionOverride || defaultDirection;

    // Apply per-run duration override ONLY to the starting step instance
    if (durationOverride) {
      snapshotSteps = snapshotSteps.map((s, idx) =>
        idx === resolvedIndex
          ? {
              ...s,
              configuredDuration: s.configuredDuration,
              effectiveDuration: durationOverride,
              duration: durationOverride,
            }
          : s,
      );
    }

    const selectedStep = snapshotSteps[resolvedIndex];

    const snapshot: TimerSequenceSnapshot = {
      modeId,
      modeName,
      isLooping,
      defaultDirection,
      direction,
      totalSteps: snapshotSteps.length,
      currentStepIndex: resolvedIndex,
      steps: snapshotSteps,
    };

    return { snapshot, selectedStep, modeId, direction };
  }

  /**
   * Formats active timer state including authoritative remaining/elapsed seconds,
   * snapshot details, and progression previews.
   */
  private formatSessionState(session: any) {
    if (!session) return null;

    let authoritativeRemainingSeconds = session.remainingSeconds;
    let authoritativeElapsedSeconds = session.elapsedSeconds;
    let isExpired = false;
    const now = Date.now();

    if (session.status === TimerStatus.RUNNING) {
      if (session.direction === TimerDirection.COUNTDOWN) {
        if (session.expectedEndTime) {
          const remainingMs = session.expectedEndTime.getTime() - now;
          authoritativeRemainingSeconds = Math.max(0, Math.round(remainingMs / 1000));
          isExpired = authoritativeRemainingSeconds === 0;
        }
        authoritativeElapsedSeconds = Math.max(
          0,
          session.targetDuration - authoritativeRemainingSeconds,
        );
      } else {
        // COUNT_UP: elapsed increases from last resumedAt/startedAt
        const anchor = session.resumedAt || session.startedAt;
        const additionalElapsed = anchor
          ? Math.max(0, Math.floor((now - new Date(anchor).getTime()) / 1000))
          : 0;
        authoritativeElapsedSeconds = session.elapsedSeconds + additionalElapsed;
        authoritativeRemainingSeconds = 0;
        isExpired = false; // COUNT_UP never auto-expires
      }
    } else if (session.status === TimerStatus.PAUSED) {
      if (session.direction === TimerDirection.COUNTDOWN) {
        authoritativeRemainingSeconds = Math.max(0, session.remainingSeconds);
        authoritativeElapsedSeconds = Math.max(
          0,
          session.targetDuration - authoritativeRemainingSeconds,
        );
        isExpired = authoritativeRemainingSeconds === 0;
      } else {
        authoritativeElapsedSeconds = session.elapsedSeconds;
        authoritativeRemainingSeconds = 0;
        isExpired = false;
      }
    }

    // Sequence progression preview
    const snapshot = (session.sequenceSnapshot as unknown as TimerSequenceSnapshot) || null;
    let nextStepPreview: SequenceSnapshotStep | null = null;
    let isSequenceFinished = false;

    if (snapshot && snapshot.steps && snapshot.steps.length > 0) {
      const nextIndex = session.stepIndex + 1;
      if (nextIndex < snapshot.steps.length) {
        nextStepPreview = snapshot.steps[nextIndex];
      } else if (snapshot.isLooping) {
        nextStepPreview = snapshot.steps[0];
      } else {
        isSequenceFinished = true;
      }
    }

    return {
      ...session,
      authoritativeRemainingSeconds,
      authoritativeElapsedSeconds,
      isExpired,
      isSequenceFinished,
      currentStep: {
        stepIndex: session.stepIndex,
        stepName: session.stepName || 'Focus',
        stepType: session.stepType || TimerStepType.FOCUS,
        duration: session.targetDuration,
        totalSteps: session.totalSteps,
      },
      nextStepPreview: nextStepPreview
        ? {
            stepIndex: nextStepPreview.order ?? (session.stepIndex + 1) % (snapshot?.steps.length || 1),
            stepName: nextStepPreview.name,
            stepType: nextStepPreview.type,
            duration: nextStepPreview.configuredDuration ?? nextStepPreview.duration,
            totalSteps: snapshot?.steps.length || 1,
          }
        : null,
    };
  }

  /**
   * Retrieves currently active personal timer.
   * If an expired countdown is encountered, it is reconciled transactionally and idempotently.
   */
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

    // Check if running countdown has expired
    if (
      session.status === TimerStatus.RUNNING &&
      session.direction === TimerDirection.COUNTDOWN &&
      session.expectedEndTime &&
      Date.now() >= session.expectedEndTime.getTime()
    ) {
      // Transactional authoritative reconciliation
      return this.reconcileExpiredCountdown(userId, session.id);
    }

    return this.formatSessionState(session);
  }

  /**
   * Reconciles an expired countdown timer transactionally and idempotently.
   */
  private async reconcileExpiredCountdown(userId: string, sessionId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userId);

      const session = await tx.timerSession.findUnique({
        where: { id: sessionId },
        include: { timerMode: true },
      });

      if (
        !session ||
        session.status !== TimerStatus.RUNNING ||
        session.direction !== TimerDirection.COUNTDOWN ||
        !session.expectedEndTime ||
        Date.now() < session.expectedEndTime.getTime()
      ) {
        // Already reconciled or status changed by concurrent request
        const currentActive = await tx.timerSession.findFirst({
          where: {
            userId,
            status: { in: [TimerStatus.RUNNING, TimerStatus.PAUSED] },
          },
          include: { timerMode: true },
        });
        return this.formatSessionState(currentActive);
      }

      // Complete the expired session
      const result = await this.executeCompleteInsideTx(tx, userId, session, {
        timerSessionId: session.id,
        title: session.stepName || session.timerMode?.name || 'Focus Session',
      });

      if (result.nextTimerSession) {
        return this.formatSessionState(result.nextTimerSession);
      }

      // No next session auto-started; return formatted completed session with next step preview
      return {
        ...this.formatSessionState(result.timerSession),
        isExpired: true,
        authoritativeRemainingSeconds: 0,
      };
    });
  }

  /**
   * Starts a new timer run capturing an immutable sequence snapshot.
   */
  async start(userId: string, dto: StartTimerDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userId);

      // Verify no active timer already exists
      const existing = await tx.timerSession.findFirst({
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

      // Build immutable sequence snapshot
      const { snapshot, selectedStep, modeId, direction } =
        await this.buildSequenceSnapshot(
          tx,
          userId,
          dto.timerModeId,
          dto.stepIndex,
          dto.durationOverride,
          dto.directionOverride,
          dto.phase,
        );

      // Legacy phase compatibility check:
      // If legacy phase is provided, verify it does not contradict selected sequence step type
      if (dto.phase) {
        const isFocusPhase = dto.phase === TimerPhase.FOCUS;
        const isFocusStep = selectedStep.type === TimerStepType.FOCUS;
        if (isFocusPhase !== isFocusStep) {
          throw new BadRequestException(
            `Provided phase "${dto.phase}" conflicts with sequence step "${selectedStep.name}" of type ${selectedStep.type}`,
          );
        }
      }

      const now = new Date();
      const targetDuration = selectedStep.effectiveDuration;
      const expectedEndTime =
        direction === TimerDirection.COUNTDOWN
          ? new Date(now.getTime() + targetDuration * 1000)
          : null;

      const phase =
        selectedStep.type === TimerStepType.FOCUS
          ? TimerPhase.FOCUS
          : dto.phase === TimerPhase.LONG_BREAK
          ? TimerPhase.LONG_BREAK
          : TimerPhase.SHORT_BREAK;

      const session = await tx.timerSession.create({
        data: {
          userId,
          timerModeId: modeId,
          stepId: selectedStep.id || null,
          stepIndex: snapshot.currentStepIndex,
          stepName: selectedStep.name,
          stepType: selectedStep.type,
          totalSteps: snapshot.totalSteps,
          direction,
          phase,
          status: TimerStatus.RUNNING,
          targetDuration,
          remainingSeconds: targetDuration,
          elapsedSeconds: 0,
          startedAt: now,
          resumedAt: now,
          expectedEndTime,
          sequenceSnapshot: snapshot as unknown as Prisma.InputJsonValue,
        },
        include: {
          timerMode: true,
        },
      });

      return this.formatSessionState(session);
    });
  }

  /**
   * Pauses the active timer session with authoritative time accounting and session identity verification.
   */
  async pause(userId: string, dto?: PauseTimerDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userId);

      const session = await tx.timerSession.findFirst({
        where: {
          userId,
          status: { in: [TimerStatus.RUNNING, TimerStatus.PAUSED] },
        },
        include: { timerMode: true },
      });

      if (!session) {
        throw new NotFoundException('No active timer session found');
      }

      if (dto?.timerSessionId && dto.timerSessionId !== session.id) {
        throw new ConflictException('Provided session ID does not match the active session');
      }

      if (session.status !== TimerStatus.RUNNING) {
        throw new BadRequestException('Timer session is not in RUNNING state');
      }

      const now = new Date();

      // Check if timer has already expired
      if (
        session.direction === TimerDirection.COUNTDOWN &&
        session.expectedEndTime &&
        session.expectedEndTime.getTime() <= now.getTime()
      ) {
        throw new BadRequestException(
          'Cannot pause an expired countdown timer. Please complete or reconcile it.',
        );
      }

      let remainingSeconds = session.remainingSeconds;
      let elapsedSeconds = session.elapsedSeconds;

      if (session.direction === TimerDirection.COUNTDOWN) {
        const remainingMs = session.expectedEndTime
          ? session.expectedEndTime.getTime() - now.getTime()
          : session.remainingSeconds * 1000;
        remainingSeconds = Math.max(0, Math.round(remainingMs / 1000));
        elapsedSeconds = Math.max(0, session.targetDuration - remainingSeconds);
      } else {
        // COUNT_UP
        const anchor = session.resumedAt || session.startedAt;
        const additionalElapsed = anchor
          ? Math.max(0, Math.floor((now.getTime() - new Date(anchor).getTime()) / 1000))
          : 0;
        elapsedSeconds = session.elapsedSeconds + additionalElapsed;
        remainingSeconds = 0;
      }

      const updated = await tx.timerSession.update({
        where: { id: session.id },
        data: {
          status: TimerStatus.PAUSED,
          remainingSeconds,
          elapsedSeconds,
          pausedAt: now,
          resumedAt: null,
          expectedEndTime: null,
        },
        include: { timerMode: true },
      });

      return this.formatSessionState(updated);
    });
  }

  /**
   * Resumes a paused timer session recalculating expectedEndTime or tracking elapsed time.
   */
  async resume(userId: string, dto?: ResumeTimerDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userId);

      const session = await tx.timerSession.findFirst({
        where: {
          userId,
          status: { in: [TimerStatus.RUNNING, TimerStatus.PAUSED] },
        },
        include: { timerMode: true },
      });

      if (!session) {
        throw new NotFoundException('No active timer session found');
      }

      if (dto?.timerSessionId && dto.timerSessionId !== session.id) {
        throw new ConflictException('Provided session ID does not match the active session');
      }

      if (session.status !== TimerStatus.PAUSED) {
        throw new BadRequestException('Timer session is not in PAUSED state');
      }

      if (
        session.direction === TimerDirection.COUNTDOWN &&
        session.remainingSeconds <= 0
      ) {
        throw new BadRequestException(
          'Cannot resume an expired countdown timer. Please complete it.',
        );
      }

      const now = new Date();
      const expectedEndTime =
        session.direction === TimerDirection.COUNTDOWN
          ? new Date(now.getTime() + session.remainingSeconds * 1000)
          : null;

      const updated = await tx.timerSession.update({
        where: { id: session.id },
        data: {
          status: TimerStatus.RUNNING,
          pausedAt: null,
          resumedAt: now,
          expectedEndTime,
        },
        include: { timerMode: true },
      });

      return this.formatSessionState(updated);
    });
  }

  /**
   * Internal transactional execution for completion and sequence progression.
   */
  private async executeCompleteInsideTx(
    tx: Prisma.TransactionClient,
    userId: string,
    session: any,
    dto: CompleteTimerDto,
  ) {
    const now = new Date();
    let actualDuration = session.targetDuration;

    if (session.direction === TimerDirection.COUNTDOWN) {
      if (session.status === TimerStatus.RUNNING && session.expectedEndTime) {
        if (now < session.expectedEndTime) {
          const remainingMs = session.expectedEndTime.getTime() - now.getTime();
          const remainingSeconds = Math.max(0, Math.round(remainingMs / 1000));
          actualDuration = Math.max(0, session.targetDuration - remainingSeconds);
        } else {
          actualDuration = session.targetDuration;
        }
      } else if (session.status === TimerStatus.PAUSED) {
        actualDuration = Math.max(0, session.targetDuration - session.remainingSeconds);
      }
    } else {
      // COUNT_UP
      if (session.status === TimerStatus.RUNNING) {
        const anchor = session.resumedAt || session.startedAt;
        const additionalElapsed = anchor
          ? Math.max(0, Math.floor((now.getTime() - new Date(anchor).getTime()) / 1000))
          : 0;
        actualDuration = session.elapsedSeconds + additionalElapsed;
      } else {
        actualDuration = session.elapsedSeconds;
      }
    }

    const isFocus =
      session.stepType === TimerStepType.FOCUS ||
      (!session.stepType && session.phase === TimerPhase.FOCUS);

    // Update session to COMPLETED
    const completedSession = await tx.timerSession.update({
      where: { id: session.id },
      data: {
        status: TimerStatus.COMPLETED,
        remainingSeconds: 0,
        expectedEndTime: null,
        resumedAt: null,
        elapsedSeconds: actualDuration,
        totalFocusSeconds: isFocus
          ? session.totalFocusSeconds + actualDuration
          : session.totalFocusSeconds,
        cycleCount: isFocus ? session.cycleCount + 1 : session.cycleCount,
      },
    });

    let studySessionRecord = null;

    // Credit study session ONLY for completed FOCUS steps
    if (isFocus) {
      studySessionRecord = await this.studySessionsService.create(
        userId,
        {
          title: dto.title || session.stepName || session.timerMode?.name || 'Focus Session',
          phase: TimerPhase.FOCUS,
          status: 'COMPLETED',
          targetDuration: session.targetDuration,
          actualDuration,
          startedAt: session.startedAt.toISOString(),
          endedAt: now.toISOString(),
          stepName: session.stepName || undefined,
          stepIndex: session.stepIndex,
          notes: dto.notes,
          categoryIds: dto.categoryIds,
          labelIds: dto.labelIds,
          timerSessionId: session.id,
        },
        tx,
      );
    }

    // Sequence progression calculation from immutable snapshot
    const snapshot = (session.sequenceSnapshot as unknown as TimerSequenceSnapshot) || null;
    let nextStep: SequenceSnapshotStep | null = null;
    let nextStepIndex = session.stepIndex + 1;
    let isSequenceFinished = false;

    if (snapshot && snapshot.steps && snapshot.steps.length > 0) {
      if (nextStepIndex < snapshot.steps.length) {
        nextStep = snapshot.steps[nextStepIndex];
      } else if (snapshot.isLooping) {
        nextStepIndex = 0;
        nextStep = snapshot.steps[0];
      } else {
        isSequenceFinished = true;
        nextStep = null;
      }
    }

    // Check user preference for autoStartNextSession
    const preferences = await tx.userPreference.findUnique({ where: { userId } });
    const autoStartEnabled = preferences?.autoStartNextSession ?? false;
    const shouldAutoStart =
      dto.advanceToNextPhase !== false && autoStartEnabled && !isSequenceFinished && nextStep !== null;

    let nextTimerSession = null;

    if (shouldAutoStart && nextStep) {
      // For subsequent loop wraps or next steps, use configuredDuration (override applies only to initial step)
      const nextTargetDuration = nextStep.configuredDuration ?? nextStep.duration;
      const nextDirection = snapshot?.direction || TimerDirection.COUNTDOWN;
      const nextExpectedEndTime =
        nextDirection === TimerDirection.COUNTDOWN
          ? new Date(now.getTime() + nextTargetDuration * 1000)
          : null;

      const nextPhase =
        nextStep.type === TimerStepType.FOCUS
          ? TimerPhase.FOCUS
          : nextStepIndex % 4 === 0
          ? TimerPhase.LONG_BREAK
          : TimerPhase.SHORT_BREAK;

      // Clean snapshot steps: subsequent loop visits use configuredDuration
      const cleanSteps = snapshot.steps.map((s) => ({
        ...s,
        effectiveDuration: s.configuredDuration ?? s.duration,
        duration: s.configuredDuration ?? s.duration,
      }));

      nextTimerSession = await tx.timerSession.create({
        data: {
          userId,
          timerModeId: session.timerModeId,
          stepId: nextStep.id || null,
          stepIndex: nextStepIndex,
          stepName: nextStep.name,
          stepType: nextStep.type,
          totalSteps: snapshot?.steps.length || 1,
          direction: nextDirection,
          phase: nextPhase,
          status: TimerStatus.RUNNING,
          targetDuration: nextTargetDuration,
          remainingSeconds: nextTargetDuration,
          elapsedSeconds: 0,
          startedAt: now,
          resumedAt: now,
          expectedEndTime: nextExpectedEndTime,
          cycleCount: completedSession.cycleCount,
          totalFocusSeconds: completedSession.totalFocusSeconds,
          sequenceSnapshot: {
            ...snapshot,
            steps: cleanSteps,
            currentStepIndex: nextStepIndex,
          } as unknown as Prisma.InputJsonValue,
        },
        include: { timerMode: true },
      });
    }

    // Determine legacy next phase indicator for backward compatibility
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
      isSequenceFinished,
      nextStepPreview: nextStep
        ? {
            stepIndex: nextStepIndex,
            stepName: nextStep.name,
            stepType: nextStep.type,
            duration: nextStep.configuredDuration ?? nextStep.duration,
            totalSteps: snapshot?.steps.length || 1,
          }
        : null,
      nextTimerSession: nextTimerSession ? this.formatSessionState(nextTimerSession) : null,
      autoStarted: !!nextTimerSession,
      idempotentReplay: false,
    };
  }

  /**
   * Completes an active timer session with mandatory session identity.
   */
  async complete(userId: string, dto: CompleteTimerDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userId);

      if (!dto.timerSessionId) {
        throw new BadRequestException('timerSessionId is required to complete a session');
      }

      const session = await tx.timerSession.findFirst({
        where: {
          id: dto.timerSessionId,
          userId,
        },
        include: {
          timerMode: true,
          studySessions: {
            include: {
              categories: { include: { category: true } },
              labels: { include: { label: true } },
            },
          },
        },
      });

      if (!session) {
        throw new NotFoundException(`Timer session with ID "${dto.timerSessionId}" not found`);
      }

      // Idempotency: exact duplicate completion returns existing completed record
      if (session.status === TimerStatus.COMPLETED) {
        const creditedStudySession = session.studySessions[0] || null;
        return {
          timerSession: session,
          studySession: creditedStudySession,
          creditedDuration: session.elapsedSeconds,
          isSequenceFinished: false,
          nextStepPreview: null,
          nextTimerSession: null,
          autoStarted: false,
          idempotentReplay: true,
        };
      }

      if (session.status === TimerStatus.CANCELLED) {
        throw new ConflictException('Timer session was already cancelled');
      }

      if (session.status !== TimerStatus.RUNNING && session.status !== TimerStatus.PAUSED) {
        throw new ConflictException('Timer session is not in an active state');
      }

      return this.executeCompleteInsideTx(tx, userId, session, dto);
    });
  }

  /**
   * Skips the current step without recording study credit and advances the sequence.
   * Requires mandatory timerSessionId.
   */
  async skip(userId: string, dto: SkipTimerDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userId);

      if (!dto.timerSessionId) {
        throw new BadRequestException('timerSessionId is required to skip a session');
      }

      const session = await tx.timerSession.findFirst({
        where: { id: dto.timerSessionId, userId },
        include: { timerMode: true },
      });

      if (!session) {
        throw new NotFoundException(`Timer session with ID "${dto.timerSessionId}" not found`);
      }

      if (session.status === TimerStatus.COMPLETED) {
        throw new ConflictException('Timer session was already completed');
      }

      if (session.status === TimerStatus.CANCELLED) {
        throw new ConflictException('Timer session was already cancelled or skipped');
      }

      if (session.status !== TimerStatus.RUNNING && session.status !== TimerStatus.PAUSED) {
        throw new ConflictException('Timer session is not in an active state');
      }

      const now = new Date();

      // Mark current session as CANCELLED (skipped)
      const cancelledSession = await tx.timerSession.update({
        where: { id: session.id },
        data: {
          status: TimerStatus.CANCELLED,
          remainingSeconds: 0,
          expectedEndTime: null,
          resumedAt: null,
        },
      });

      // Sequence progression calculation from snapshot
      const snapshot = (session.sequenceSnapshot as unknown as TimerSequenceSnapshot) || null;
      let nextStep: SequenceSnapshotStep | null = null;
      let nextStepIndex = session.stepIndex + 1;
      let isSequenceFinished = false;

      if (snapshot && snapshot.steps && snapshot.steps.length > 0) {
        if (nextStepIndex < snapshot.steps.length) {
          nextStep = snapshot.steps[nextStepIndex];
        } else if (snapshot.isLooping) {
          nextStepIndex = 0;
          nextStep = snapshot.steps[0];
        } else {
          isSequenceFinished = true;
          nextStep = null;
        }
      }

      const preferences = await tx.userPreference.findUnique({ where: { userId } });
      const autoStartEnabled = preferences?.autoStartNextSession ?? false;
      let nextTimerSession = null;

      if (autoStartEnabled && !isSequenceFinished && nextStep) {
        const nextTargetDuration = nextStep.configuredDuration ?? nextStep.duration;
        const nextDirection = snapshot?.direction || TimerDirection.COUNTDOWN;
        const nextExpectedEndTime =
          nextDirection === TimerDirection.COUNTDOWN
            ? new Date(now.getTime() + nextTargetDuration * 1000)
            : null;

        const nextPhase =
          nextStep.type === TimerStepType.FOCUS
            ? TimerPhase.FOCUS
            : nextStepIndex % 4 === 0
            ? TimerPhase.LONG_BREAK
            : TimerPhase.SHORT_BREAK;

        const cleanSteps = snapshot.steps.map((s) => ({
          ...s,
          effectiveDuration: s.configuredDuration ?? s.duration,
          duration: s.configuredDuration ?? s.duration,
        }));

        nextTimerSession = await tx.timerSession.create({
          data: {
            userId,
            timerModeId: session.timerModeId,
            stepId: nextStep.id || null,
            stepIndex: nextStepIndex,
            stepName: nextStep.name,
            stepType: nextStep.type,
            totalSteps: snapshot?.steps.length || 1,
            direction: nextDirection,
            phase: nextPhase,
            status: TimerStatus.RUNNING,
            targetDuration: nextTargetDuration,
            remainingSeconds: nextTargetDuration,
            elapsedSeconds: 0,
            startedAt: now,
            resumedAt: now,
            expectedEndTime: nextExpectedEndTime,
            cycleCount: session.cycleCount,
            totalFocusSeconds: session.totalFocusSeconds,
            sequenceSnapshot: {
              ...snapshot,
              steps: cleanSteps,
              currentStepIndex: nextStepIndex,
            } as unknown as Prisma.InputJsonValue,
          },
          include: { timerMode: true },
        });
      }

      return {
        timerSession: cancelledSession,
        studySession: null,
        isSequenceFinished,
        nextStepPreview: nextStep
          ? {
              stepIndex: nextStepIndex,
              stepName: nextStep.name,
              stepType: nextStep.type,
              duration: nextStep.configuredDuration ?? nextStep.duration,
              totalSteps: snapshot?.steps.length || 1,
            }
          : null,
        nextTimerSession: nextTimerSession ? this.formatSessionState(nextTimerSession) : null,
        autoStarted: !!nextTimerSession,
      };
    });
  }

  /**
   * Finishes the current sequence.
   * If a timer is currently active, requires exact session ID and cancels it without study credit.
   * If already idle (viewing next-step choices), marks sequence finished idempotently.
   */
  async finishSequence(userId: string, dto?: FinishSequenceDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userId);

      const activeSession = await tx.timerSession.findFirst({
        where: {
          userId,
          status: { in: [TimerStatus.RUNNING, TimerStatus.PAUSED] },
        },
      });

      if (activeSession) {
        if (!dto?.timerSessionId) {
          throw new BadRequestException('timerSessionId is required to terminate an active session');
        }
        if (dto.timerSessionId !== activeSession.id) {
          throw new ConflictException('Provided session ID does not match the active session');
        }

        // Cancel active step WITHOUT crediting it as completed
        await tx.timerSession.update({
          where: { id: activeSession.id },
          data: {
            status: TimerStatus.CANCELLED,
            remainingSeconds: 0,
            expectedEndTime: null,
            resumedAt: null,
          },
        });
      } else if (dto?.timerSessionId) {
        const session = await tx.timerSession.findFirst({
          where: { id: dto.timerSessionId, userId },
        });
        if (!session) {
          throw new NotFoundException(`Timer session with ID "${dto.timerSessionId}" not found`);
        }
      }

      return {
        finished: true,
        isSequenceFinished: true,
        nextTimerSession: null,
        nextStepPreview: null,
      };
    });
  }

  /**
   * Cancels active timer session with optional partial study session recording and identity verification.
   */
  async cancel(userId: string, dto: CancelTimerDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userId);

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

      if (dto?.timerSessionId && dto.timerSessionId !== session.id) {
        throw new ConflictException('Provided session ID does not match the active session');
      }

      const now = new Date();
      let elapsedSeconds = 0;

      if (session.direction === TimerDirection.COUNTDOWN) {
        if (session.status === TimerStatus.RUNNING && session.expectedEndTime) {
          const remainingMs = Math.max(0, session.expectedEndTime.getTime() - now.getTime());
          elapsedSeconds = Math.max(0, session.targetDuration - Math.round(remainingMs / 1000));
        } else if (session.status === TimerStatus.PAUSED) {
          elapsedSeconds = Math.max(0, session.targetDuration - session.remainingSeconds);
        }
      } else {
        // COUNT_UP
        if (session.status === TimerStatus.RUNNING) {
          const anchor = session.resumedAt || session.startedAt;
          const additionalElapsed = anchor
            ? Math.max(0, Math.floor((now.getTime() - new Date(anchor).getTime()) / 1000))
            : 0;
          elapsedSeconds = session.elapsedSeconds + additionalElapsed;
        } else {
          elapsedSeconds = session.elapsedSeconds;
        }
      }

      // Update timer session to CANCELLED
      const cancelledSession = await tx.timerSession.update({
        where: { id: session.id },
        data: {
          status: TimerStatus.CANCELLED,
          remainingSeconds: 0,
          expectedEndTime: null,
          resumedAt: null,
          elapsedSeconds,
        },
      });

      let interruptedStudyRecord = null;
      const isFocus =
        session.stepType === TimerStepType.FOCUS ||
        (!session.stepType && session.phase === TimerPhase.FOCUS);

      // Save partial record if minimum 60 seconds threshold met for focus
      if (isFocus && elapsedSeconds >= 60 && dto.savePartialRecord !== false) {
        interruptedStudyRecord = await this.studySessionsService.create(
          userId,
          {
            title: session.stepName
              ? `${session.stepName} (Interrupted)`
              : session.timerMode?.name
              ? `${session.timerMode.name} (Interrupted)`
              : 'Interrupted Session',
            phase: TimerPhase.FOCUS,
            status: 'INTERRUPTED',
            targetDuration: session.targetDuration,
            actualDuration: elapsedSeconds,
            startedAt: session.startedAt.toISOString(),
            endedAt: now.toISOString(),
            stepName: session.stepName || undefined,
            stepIndex: session.stepIndex,
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
