import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateTimerModeDto } from './dto/create-timer-mode.dto';
import { UpdateTimerModeDto } from './dto/update-timer-mode.dto';

@Injectable()
export class TimerModesService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    // Seed default global templates if none exist
    const systemCount = await this.prisma.timerMode.count({
      where: { userId: null },
    });

    if (systemCount === 0) {
      await this.prisma.timerMode.createMany({
        data: [
          {
            name: 'Standard Pomodoro',
            description: 'Classic 25m focus with 5m short break and 15m long break',
            focusDuration: 1500, // 25 mins
            shortBreakDuration: 300, // 5 mins
            longBreakDuration: 900, // 15 mins
            longBreakInterval: 4,
            userId: null,
          },
          {
            name: 'Deep Work 50/10',
            description: 'Intense 50m focus with 10m short break and 30m long break',
            focusDuration: 3000, // 50 mins
            shortBreakDuration: 600, // 10 mins
            longBreakDuration: 1800, // 30 mins
            longBreakInterval: 3,
            userId: null,
          },
          {
            name: 'Quick Sprint 15/3',
            description: 'High-energy 15m sprint with 3m short break',
            focusDuration: 900, // 15 mins
            shortBreakDuration: 180, // 3 mins
            longBreakDuration: 600, // 10 mins
            longBreakInterval: 4,
            userId: null,
          },
        ],
      });
    }
  }

  async create(userId: string, dto: CreateTimerModeDto) {
    return this.prisma.timerMode.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description,
        focusDuration: dto.focusDuration,
        shortBreakDuration: dto.shortBreakDuration,
        longBreakDuration: dto.longBreakDuration,
        longBreakInterval: dto.longBreakInterval || 4,
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.timerMode.findMany({
      where: {
        isArchived: false,
        OR: [{ userId: null }, { userId }],
      },
      orderBy: [{ userId: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(userId: string, id: string) {
    const mode = await this.prisma.timerMode.findUnique({
      where: { id },
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

    return this.prisma.timerMode.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.focusDuration !== undefined && { focusDuration: dto.focusDuration }),
        ...(dto.shortBreakDuration !== undefined && { shortBreakDuration: dto.shortBreakDuration }),
        ...(dto.longBreakDuration !== undefined && { longBreakDuration: dto.longBreakDuration }),
        ...(dto.longBreakInterval !== undefined && { longBreakInterval: dto.longBreakInterval }),
      },
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
        focusDuration: source.focusDuration,
        shortBreakDuration: source.shortBreakDuration,
        longBreakDuration: source.longBreakDuration,
        longBreakInterval: source.longBreakInterval,
      },
    });
  }
}
