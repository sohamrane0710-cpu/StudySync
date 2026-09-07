import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateTimerCategoryDto, UpdateTimerCategoryDto } from './dto.js';

@Injectable()
export class TimerCategoryService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateTimerCategoryDto) {
    // Enforce case-insensitive uniqueness per user
    const existing = await this.prisma.timerCategory.findFirst({
      where: {
        userId,
        name: {
          equals: dto.name,
          mode: 'insensitive',
        },
      },
    });

    if (existing) {
      throw new ConflictException('A category with this name already exists');
    }

    return this.prisma.timerCategory.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description,
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.timerCategory.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(userId: string, id: string) {
    const category = await this.prisma.timerCategory.findFirst({
      where: { id, userId },
    });

    if (!category) {
      throw new NotFoundException('Timer category not found');
    }

    return category;
  }

  async update(userId: string, id: string, dto: UpdateTimerCategoryDto) {
    await this.findOne(userId, id); // Ensure exists and owned

    if (dto.name) {
      const existing = await this.prisma.timerCategory.findFirst({
        where: {
          userId,
          name: {
            equals: dto.name,
            mode: 'insensitive',
          },
          id: { not: id },
        },
      });

      if (existing) {
        throw new ConflictException('A category with this name already exists');
      }
    }

    return this.prisma.timerCategory.update({
      where: { id },
      data: dto,
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id); // Ensure exists and owned

    // Check if used in any TimerMode
    const modes = await this.prisma.timerMode.findMany({
      where: { userId },
    });

    for (const mode of modes) {
      const stages = mode.stagesConfig as any[];
      if (Array.isArray(stages) && stages.some((s) => s.categoryId === id)) {
        throw new ConflictException('Cannot delete category because it is used in a TimerMode');
      }
    }

    try {
      await this.prisma.timerCategory.delete({
        where: { id },
      });
    } catch (error: any) {
      // Prisma error P2003: Foreign key constraint failed
      if (error.code === 'P2003') {
        throw new ConflictException('Cannot delete category because it has historical study sessions');
      }
      throw error;
    }
  }
}
