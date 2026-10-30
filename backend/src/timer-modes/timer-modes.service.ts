import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { TimerDirection, TimerStatus, TimerStepType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateTimerModeDto } from './dto/create-timer-mode.dto';
import { CreateTimerModeStepDto } from './dto/create-timer-mode-step.dto';
import { ReorderStepsDto } from './dto/reorder-steps.dto';
import { UpdateTimerModeDto } from './dto/update-timer-mode.dto';
import { UpdateTimerModeStepDto } from './dto/update-timer-mode-step.dto';

@Injectable()
export class TimerModesService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  private async lockUser(tx: any, userId: string): Promise<void> {
    await tx.$queryRaw`SELECT id FROM profiles WHERE id = ${userId}::uuid FOR UPDATE`;
  }

  private generateDefaultSteps(
    focusDuration: number,
    shortBreakDuration: number,
    longBreakDuration: number,
    interval: number,
  ) {
    const n = Math.max(1, interval || 4);
    const steps: Array<{
      name: string;
      type: TimerStepType;
      duration: number;
      order: number;
    }> = [];

    for (let k = 0; k < n; k++) {
      // Focus step (Order 2k)
      steps.push({
        name: `Focus ${k + 1}`,
        type: TimerStepType.FOCUS,
        duration: focusDuration,
        order: 2 * k,
      });

      // Break step (Order 2k + 1)
      if (k < n - 1) {
        steps.push({
          name: `Short Rest ${k + 1}`,
          type: TimerStepType.REST,
          duration: shortBreakDuration,
          order: 2 * k + 1,
        });
      } else {
        steps.push({
          name: 'Long Rest',
          type: TimerStepType.REST,
          duration: longBreakDuration,
          order: 2 * k + 1,
        });
      }
    }

    return steps;
  }

  /**
   * Synchronizes legacy mode duration fields (focusDuration, shortBreakDuration,
   * longBreakDuration, longBreakInterval) to match the current step sequence.
   */
  private async syncLegacyModeFields(tx: any, modeId: string) {
    const steps = await tx.timerModeStep.findMany({
      where: { timerModeId: modeId },
      orderBy: { order: 'asc' },
    });
    if (steps.length === 0) return;

    const firstFocus = steps.find((s: any) => s.type === TimerStepType.FOCUS);
    const firstRest = steps.find((s: any) => s.type === TimerStepType.REST);
    const lastRest = [...steps].reverse().find((s: any) => s.type === TimerStepType.REST);
    const focusCount = steps.filter((s: any) => s.type === TimerStepType.FOCUS).length;

    await tx.timerMode.update({
      where: { id: modeId },
      data: {
        ...(firstFocus && { focusDuration: firstFocus.duration }),
        ...(firstRest && { shortBreakDuration: firstRest.duration }),
        ...(lastRest && { longBreakDuration: lastRest.duration }),
        longBreakInterval: focusCount > 0 ? focusCount : 1,
      },
    });
  }

  async onModuleInit() {
    // Seed default global templates if none exist
    const systemModes = await this.prisma.timerMode.findMany({
      where: { userId: null },
      include: { steps: true },
    });

    if (systemModes.length === 0) {
      const templates = [
        {
          name: 'Standard Pomodoro',
          description: 'Classic 25m focus with 5m short break and 15m long break',
          focusDuration: 1500,
          shortBreakDuration: 300,
          longBreakDuration: 900,
          longBreakInterval: 4,
          isLooping: true,
          defaultDirection: TimerDirection.COUNTDOWN,
        },
        {
          name: 'Deep Work 50/10',
          description: 'Intense 50m focus with 10m short break and 30m long break',
          focusDuration: 3000,
          shortBreakDuration: 600,
          longBreakDuration: 1800,
          longBreakInterval: 3,
          isLooping: true,
          defaultDirection: TimerDirection.COUNTDOWN,
        },
        {
          name: 'Quick Sprint 15/3',
          description: 'High-energy 15m sprint with 3m short break',
          focusDuration: 900,
          shortBreakDuration: 180,
          longBreakDuration: 600,
          longBreakInterval: 4,
          isLooping: true,
          defaultDirection: TimerDirection.COUNTDOWN,
        },
      ];

      for (const t of templates) {
        const steps = this.generateDefaultSteps(
          t.focusDuration,
          t.shortBreakDuration,
          t.longBreakDuration,
          t.longBreakInterval,
        );

        await this.prisma.timerMode.create({
          data: {
            userId: null,
            name: t.name,
            description: t.description,
            focusDuration: t.focusDuration,
            shortBreakDuration: t.shortBreakDuration,
            longBreakDuration: t.longBreakDuration,
            longBreakInterval: t.longBreakInterval,
            isLooping: t.isLooping,
            defaultDirection: t.defaultDirection,
            steps: {
              create: steps,
            },
          },
        });
      }
    } else {
      // If system modes exist but any lack steps, backfill them
      for (const mode of systemModes) {
        if (mode.steps.length === 0) {
          const steps = this.generateDefaultSteps(
            mode.focusDuration,
            mode.shortBreakDuration,
            mode.longBreakDuration,
            mode.longBreakInterval,
          );
          await this.prisma.timerModeStep.createMany({
            data: steps.map((s) => ({
              ...s,
              timerModeId: mode.id,
            })),
          });
        }
      }
    }
  }

  async create(userId: string, dto: CreateTimerModeDto) {
    let resolvedSteps: Array<{
      name: string;
      type: TimerStepType;
      duration: number;
      order: number;
    }> = [];

    if (dto.steps !== undefined) {
      if (!Array.isArray(dto.steps) || dto.steps.length === 0) {
        throw new BadRequestException('A timer mode must contain at least one step');
      }

      for (const step of dto.steps) {
        if (step.duration < 10 || step.duration > 86400) {
          throw new BadRequestException('Step duration must be between 10 seconds and 24 hours (86400s)');
        }
        if (!step.name || step.name.trim().length === 0) {
          throw new BadRequestException('Step name cannot be empty');
        }
      }

      const hasFocus = dto.steps.some((s) => (s.type || TimerStepType.FOCUS) === TimerStepType.FOCUS);
      if (!hasFocus) {
        throw new BadRequestException('A timer mode sequence must contain at least one FOCUS step');
      }

      resolvedSteps = dto.steps.map((s, index) => ({
        name: s.name.trim(),
        type: s.type || TimerStepType.FOCUS,
        duration: s.duration,
        order: index,
      }));
    } else {
      // Legacy fallback
      const focusDuration = dto.focusDuration || 1500;
      const shortBreakDuration = dto.shortBreakDuration || 300;
      const longBreakDuration = dto.longBreakDuration || 900;
      const interval = dto.longBreakInterval || 4;

      resolvedSteps = this.generateDefaultSteps(
        focusDuration,
        shortBreakDuration,
        longBreakDuration,
        interval,
      );
    }

    // Compute legacy fields from resolved steps to maintain compatibility
    const firstFocus = resolvedSteps.find((s) => s.type === TimerStepType.FOCUS);
    const firstRest = resolvedSteps.find((s) => s.type === TimerStepType.REST);
    const lastRest = [...resolvedSteps].reverse().find((s) => s.type === TimerStepType.REST);
    const focusCount = resolvedSteps.filter((s) => s.type === TimerStepType.FOCUS).length;

    const legacyFocus = firstFocus ? firstFocus.duration : (dto.focusDuration || 1500);
    const legacyShort = firstRest ? firstRest.duration : (dto.shortBreakDuration || 300);
    const legacyLong = lastRest ? lastRest.duration : (dto.longBreakDuration || 900);
    const legacyInterval = focusCount > 0 ? focusCount : (dto.longBreakInterval || 4);

    return this.prisma.timerMode.create({
      data: {
        userId,
        name: dto.name.trim(),
        description: dto.description?.trim(),
        isLooping: dto.isLooping !== undefined ? dto.isLooping : true,
        defaultDirection: dto.defaultDirection || TimerDirection.COUNTDOWN,
        focusDuration: legacyFocus,
        shortBreakDuration: legacyShort,
        longBreakDuration: legacyLong,
        longBreakInterval: legacyInterval,
        steps: {
          create: resolvedSteps,
        },
      },
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.timerMode.findMany({
      where: {
        isArchived: false,
        OR: [{ userId: null }, { userId }],
      },
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: [{ userId: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(userId: string, id: string) {
    const mode = await this.prisma.timerMode.findUnique({
      where: { id },
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!mode || mode.isArchived) {
      throw new NotFoundException('Timer mode not found');
    }

    if (mode.userId !== null && mode.userId !== userId) {
      throw new ForbiddenException('Access to private timer mode is denied');
    }

    return mode;
  }

  async update(userId: string, id: string, dto: UpdateTimerModeDto) {
    const mode = await this.prisma.timerMode.findUnique({
      where: { id },
      include: { steps: { orderBy: { order: 'asc' } } },
    });

    if (!mode || mode.isArchived) {
      throw new NotFoundException('Timer mode not found');
    }

    if (mode.userId === null) {
      throw new ForbiddenException('System default timer modes cannot be modified');
    }

    if (mode.userId !== userId) {
      throw new ForbiddenException('You can only modify your own timer modes');
    }

    return this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userId);
      let legacyFields: any = {};

      if (dto.steps !== undefined) {
        if (!Array.isArray(dto.steps) || dto.steps.length === 0) {
          throw new BadRequestException('A timer mode must contain at least one step');
        }

        for (const step of dto.steps) {
          if (step.duration < 10 || step.duration > 86400) {
            throw new BadRequestException('Step duration must be between 10 seconds and 24 hours (86400s)');
          }
          if (!step.name || step.name.trim().length === 0) {
            throw new BadRequestException('Step name cannot be empty');
          }
        }

        const hasFocus = dto.steps.some((s) => (s.type || TimerStepType.FOCUS) === TimerStepType.FOCUS);
        if (!hasFocus) {
          throw new BadRequestException('A timer mode sequence must contain at least one FOCUS step');
        }

        // Active session protection
        const activeSession = await tx.timerSession.findFirst({
          where: {
            timerModeId: id,
            status: { in: [TimerStatus.RUNNING, TimerStatus.PAUSED] },
          },
        });

        if (activeSession) {
          throw new BadRequestException('Cannot modify sequence steps while an active timer session is running on this mode');
        }

        // Replace steps
        await tx.timerModeStep.deleteMany({
          where: { timerModeId: id },
        });

        const newSteps = dto.steps.map((s, idx) => ({
          timerModeId: id,
          name: s.name.trim(),
          type: s.type || TimerStepType.FOCUS,
          duration: s.duration,
          order: idx,
        }));

        await tx.timerModeStep.createMany({
          data: newSteps,
        });

        const firstFocus = newSteps.find((s) => s.type === TimerStepType.FOCUS);
        const firstRest = newSteps.find((s) => s.type === TimerStepType.REST);
        const lastRest = [...newSteps].reverse().find((s) => s.type === TimerStepType.REST);
        const focusCount = newSteps.filter((s) => s.type === TimerStepType.FOCUS).length;

        legacyFields = {
          focusDuration: firstFocus ? firstFocus.duration : mode.focusDuration,
          shortBreakDuration: firstRest ? firstRest.duration : mode.shortBreakDuration,
          longBreakDuration: lastRest ? lastRest.duration : mode.longBreakDuration,
          longBreakInterval: focusCount > 0 ? focusCount : mode.longBreakInterval,
        };
      } else {
        if (dto.focusDuration !== undefined) legacyFields.focusDuration = dto.focusDuration;
        if (dto.shortBreakDuration !== undefined) legacyFields.shortBreakDuration = dto.shortBreakDuration;
        if (dto.longBreakDuration !== undefined) legacyFields.longBreakDuration = dto.longBreakDuration;
        if (dto.longBreakInterval !== undefined) legacyFields.longBreakInterval = dto.longBreakInterval;
      }

      return tx.timerMode.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name.trim() }),
          ...(dto.description !== undefined && { description: dto.description?.trim() }),
          ...(dto.isLooping !== undefined && { isLooping: dto.isLooping }),
          ...(dto.defaultDirection !== undefined && { defaultDirection: dto.defaultDirection }),
          ...legacyFields,
        },
        include: {
          steps: {
            orderBy: { order: 'asc' },
          },
        },
      });
    });
  }

  async remove(userId: string, id: string) {
    const mode = await this.prisma.timerMode.findUnique({
      where: { id },
    });

    if (!mode || mode.isArchived) {
      throw new NotFoundException('Timer mode not found');
    }

    if (mode.userId === null) {
      throw new ForbiddenException('System default timer modes cannot be archived');
    }

    if (mode.userId !== userId) {
      throw new ForbiddenException('You can only delete your own timer modes');
    }

    // Active session protection
    const activeSession = await this.prisma.timerSession.findFirst({
      where: {
        timerModeId: id,
        status: { in: [TimerStatus.RUNNING, TimerStatus.PAUSED] },
      },
    });

    if (activeSession) {
      throw new BadRequestException('Cannot delete a timer mode with an active timer session');
    }

    return this.prisma.timerMode.update({
      where: { id },
      data: { isArchived: true },
    });
  }

  async duplicate(userId: string, id: string) {
    const source = await this.findOne(userId, id);

    return this.prisma.timerMode.create({
      data: {
        userId,
        name: `${source.name} (Copy)`,
        description: source.description,
        isLooping: source.isLooping,
        defaultDirection: source.defaultDirection,
        focusDuration: source.focusDuration,
        shortBreakDuration: source.shortBreakDuration,
        longBreakDuration: source.longBreakDuration,
        longBreakInterval: source.longBreakInterval,
        steps: {
          create: source.steps.map((s) => ({
            name: s.name,
            type: s.type,
            duration: s.duration,
            order: s.order,
          })),
        },
      },
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  // --- Step-Specific Operations ---

  async addStep(userId: string, modeId: string, dto: CreateTimerModeStepDto) {
    await this.findOne(userId, modeId);

    const mode = await this.prisma.timerMode.findUnique({
      where: { id: modeId },
    });

    if (!mode || mode.isArchived) {
      throw new NotFoundException('Timer mode not found');
    }

    if (mode.userId === null) {
      throw new ForbiddenException('System default timer modes cannot be modified');
    }

    if (mode.userId !== userId) {
      throw new ForbiddenException('You can only modify steps in your own timer modes');
    }

    if (!dto.name || dto.name.trim().length === 0) {
      throw new BadRequestException('Step name cannot be empty');
    }

    if (dto.duration < 10 || dto.duration > 86400) {
      throw new BadRequestException('Step duration must be between 10 seconds and 24 hours (86400s)');
    }

    return this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userId);
      // Active session protection inside transaction
      const activeSession = await tx.timerSession.findFirst({
        where: {
          timerModeId: modeId,
          status: { in: [TimerStatus.RUNNING, TimerStatus.PAUSED] },
        },
      });

      if (activeSession) {
        throw new BadRequestException('Cannot add steps to a timer mode with an active timer session');
      }

      const existingSteps = await tx.timerModeStep.findMany({
        where: { timerModeId: modeId },
        orderBy: { order: 'asc' },
      });

      const count = existingSteps.length;
      const targetOrder =
        dto.order !== undefined && dto.order >= 0 && dto.order <= count
          ? dto.order
          : count;

      // Shift existing steps at or after targetOrder down in descending order to avoid unique collision
      if (targetOrder < count) {
        const toShift = await tx.timerModeStep.findMany({
          where: { timerModeId: modeId, order: { gte: targetOrder } },
          orderBy: { order: 'desc' },
        });

        for (const step of toShift) {
          await tx.timerModeStep.update({
            where: { id: step.id },
            data: { order: step.order + 1 },
          });
        }
      }

      await tx.timerModeStep.create({
        data: {
          timerModeId: modeId,
          name: dto.name.trim(),
          type: dto.type || TimerStepType.FOCUS,
          duration: dto.duration,
          order: targetOrder,
        },
      });

      await this.syncLegacyModeFields(tx, modeId);

      return tx.timerMode.findUnique({
        where: { id: modeId },
        include: { steps: { orderBy: { order: 'asc' } } },
      });
    });
  }

  async updateStep(
    userId: string,
    modeId: string,
    stepId: string,
    dto: UpdateTimerModeStepDto,
  ) {
    await this.findOne(userId, modeId);

    const mode = await this.prisma.timerMode.findUnique({
      where: { id: modeId },
    });

    if (!mode || mode.isArchived) {
      throw new NotFoundException('Timer mode not found');
    }

    if (mode.userId === null) {
      throw new ForbiddenException('System default timer modes cannot be modified');
    }

    if (mode.userId !== userId) {
      throw new ForbiddenException('You can only modify steps in your own timer modes');
    }

    const step = await this.prisma.timerModeStep.findUnique({
      where: { id: stepId },
    });

    if (!step || step.timerModeId !== modeId) {
      throw new NotFoundException('Step not found in this timer mode');
    }

    if (dto.name !== undefined && dto.name.trim().length === 0) {
      throw new BadRequestException('Step name cannot be empty');
    }

    if (dto.duration !== undefined && (dto.duration < 10 || dto.duration > 86400)) {
      throw new BadRequestException('Step duration must be between 10 seconds and 24 hours (86400s)');
    }

    return this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userId);
      await tx.timerModeStep.update({
        where: { id: stepId },
        data: {
          ...(dto.name !== undefined && { name: dto.name.trim() }),
          ...(dto.type !== undefined && { type: dto.type }),
          ...(dto.duration !== undefined && { duration: dto.duration }),
        },
      });

      await this.syncLegacyModeFields(tx, modeId);

      return tx.timerMode.findUnique({
        where: { id: modeId },
        include: { steps: { orderBy: { order: 'asc' } } },
      });
    });
  }

  async deleteStep(userId: string, modeId: string, stepId: string) {
    await this.findOne(userId, modeId);

    const mode = await this.prisma.timerMode.findUnique({
      where: { id: modeId },
    });

    if (!mode || mode.isArchived) {
      throw new NotFoundException('Timer mode not found');
    }

    if (mode.userId === null) {
      throw new ForbiddenException('System default timer modes cannot be modified');
    }

    if (mode.userId !== userId) {
      throw new ForbiddenException('You can only modify steps in your own timer modes');
    }

    const step = await this.prisma.timerModeStep.findUnique({
      where: { id: stepId },
    });

    if (!step || step.timerModeId !== modeId) {
      throw new NotFoundException('Step not found in this timer mode');
    }

    const totalSteps = await this.prisma.timerModeStep.count({
      where: { timerModeId: modeId },
    });

    if (totalSteps <= 1) {
      throw new BadRequestException('A timer mode must contain at least one step');
    }

    return this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userId);
      // Active session reference protection inside transaction
      const activeSession = await tx.timerSession.findFirst({
        where: {
          stepId,
          status: { in: [TimerStatus.RUNNING, TimerStatus.PAUSED] },
        },
      });

      if (activeSession) {
        throw new BadRequestException('Cannot delete a step that is currently in use by an active timer session');
      }

      await tx.timerModeStep.delete({
        where: { id: stepId },
      });

      // Re-compact remaining steps contiguous 0..N-1 with safe two-phase update
      const remaining = await tx.timerModeStep.findMany({
        where: { timerModeId: modeId },
        orderBy: { order: 'asc' },
      });

      for (let i = 0; i < remaining.length; i++) {
        await tx.timerModeStep.update({
          where: { id: remaining[i].id },
          data: { order: -(i + 1) },
        });
      }

      for (let i = 0; i < remaining.length; i++) {
        await tx.timerModeStep.update({
          where: { id: remaining[i].id },
          data: { order: i },
        });
      }

      await this.syncLegacyModeFields(tx, modeId);

      return tx.timerMode.findUnique({
        where: { id: modeId },
        include: { steps: { orderBy: { order: 'asc' } } },
      });
    });
  }

  async duplicateStep(userId: string, modeId: string, stepId: string) {
    await this.findOne(userId, modeId);

    const mode = await this.prisma.timerMode.findUnique({
      where: { id: modeId },
    });

    if (!mode || mode.isArchived) {
      throw new NotFoundException('Timer mode not found');
    }

    if (mode.userId === null) {
      throw new ForbiddenException('System default timer modes cannot be modified');
    }

    if (mode.userId !== userId) {
      throw new ForbiddenException('You can only modify steps in your own timer modes');
    }

    const step = await this.prisma.timerModeStep.findUnique({
      where: { id: stepId },
    });

    if (!step || step.timerModeId !== modeId) {
      throw new NotFoundException('Step not found in this timer mode');
    }

    return this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userId);
      // Active session protection
      const activeSession = await tx.timerSession.findFirst({
        where: {
          timerModeId: modeId,
          status: { in: [TimerStatus.RUNNING, TimerStatus.PAUSED] },
        },
      });

      if (activeSession) {
        throw new BadRequestException('Cannot duplicate steps in a timer mode with an active timer session');
      }

      const toShift = await tx.timerModeStep.findMany({
        where: { timerModeId: modeId, order: { gt: step.order } },
        orderBy: { order: 'desc' },
      });

      for (const s of toShift) {
        await tx.timerModeStep.update({
          where: { id: s.id },
          data: { order: s.order + 1 },
        });
      }

      await tx.timerModeStep.create({
        data: {
          timerModeId: modeId,
          name: `${step.name} (Copy)`,
          type: step.type,
          duration: step.duration,
          order: step.order + 1,
        },
      });

      await this.syncLegacyModeFields(tx, modeId);

      return tx.timerMode.findUnique({
        where: { id: modeId },
        include: { steps: { orderBy: { order: 'asc' } } },
      });
    });
  }

  async reorderSteps(userId: string, modeId: string, dto: ReorderStepsDto) {
    await this.findOne(userId, modeId);

    const mode = await this.prisma.timerMode.findUnique({
      where: { id: modeId },
    });

    if (!mode || mode.isArchived) {
      throw new NotFoundException('Timer mode not found');
    }

    if (mode.userId === null) {
      throw new ForbiddenException('System default timer modes cannot be modified');
    }

    if (mode.userId !== userId) {
      throw new ForbiddenException('You can only modify steps in your own timer modes');
    }

    const currentSteps = await this.prisma.timerModeStep.findMany({
      where: { timerModeId: modeId },
    });

    // Enforce every step ID must appear exactly once without duplicates
    const uniqueIds = new Set(dto.stepIds);
    if (uniqueIds.size !== currentSteps.length || dto.stepIds.length !== currentSteps.length) {
      throw new BadRequestException('Reordering must include every existing step ID exactly once without duplicates');
    }

    const currentMap = new Map(currentSteps.map((s) => [s.id, s]));
    for (const stepId of dto.stepIds) {
      if (!currentMap.has(stepId)) {
        throw new BadRequestException(`Step ${stepId} does not belong to this timer mode`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userId);
      // Active session protection inside transaction
      const activeSession = await tx.timerSession.findFirst({
        where: {
          timerModeId: modeId,
          status: { in: [TimerStatus.RUNNING, TimerStatus.PAUSED] },
        },
      });

      if (activeSession) {
        throw new BadRequestException('Cannot reorder steps while a timer session is actively running on this mode');
      }

      // Phase 1: temporary negative indices to prevent unique collisions
      for (let i = 0; i < dto.stepIds.length; i++) {
        await tx.timerModeStep.update({
          where: { id: dto.stepIds[i] },
          data: { order: -(i + 1) },
        });
      }

      // Phase 2: assign desired 0..N-1 order
      for (let i = 0; i < dto.stepIds.length; i++) {
        await tx.timerModeStep.update({
          where: { id: dto.stepIds[i] },
          data: { order: i },
        });
      }

      await this.syncLegacyModeFields(tx, modeId);

      return tx.timerMode.findUnique({
        where: { id: modeId },
        include: { steps: { orderBy: { order: 'asc' } } },
      });
    });
  }
}
