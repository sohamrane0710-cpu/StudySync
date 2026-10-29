import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateLabelDto } from './dto/create-label.dto';
import { UpdateLabelDto } from './dto/update-label.dto';

@Injectable()
export class LabelsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateLabelDto) {
    if (dto.categoryId) {
      const category = await this.prisma.sessionCategory.findUnique({
        where: { id: dto.categoryId },
      });

      if (!category || category.isArchived) {
        throw new NotFoundException('Specified parent category does not exist');
      }

      if (category.userId !== userId) {
        throw new ForbiddenException('Cannot link a label to another user\'s category');
      }
    }

    const existing = await this.prisma.sessionLabel.findFirst({
      where: {
        userId,
        name: { equals: dto.name, mode: 'insensitive' },
        isArchived: false,
      },
    });

    if (existing) {
      throw new ConflictException(`Label "${dto.name}" already exists`);
    }

    return this.prisma.sessionLabel.create({
      data: {
        userId,
        name: dto.name,
        color: dto.color,
        categoryId: dto.categoryId,
      },
      include: {
        category: true,
      },
    });
  }

  async findAll(userId: string, categoryId?: string) {
    return this.prisma.sessionLabel.findMany({
      where: {
        userId,
        isArchived: false,
        ...(categoryId && { categoryId }),
      },
      include: {
        category: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(userId: string, id: string) {
    const label = await this.prisma.sessionLabel.findUnique({
      where: { id },
      include: {
        category: true,
      },
    });

    if (!label || label.isArchived) {
      throw new NotFoundException('Label not found');
    }

    if (label.userId !== userId) {
      throw new ForbiddenException('Access to label denied');
    }

    return label;
  }

  async update(userId: string, id: string, dto: UpdateLabelDto) {
    await this.findOne(userId, id);

    if (dto.categoryId) {
      const category = await this.prisma.sessionCategory.findUnique({
        where: { id: dto.categoryId },
      });

      if (!category || category.isArchived) {
        throw new NotFoundException('Specified parent category does not exist');
      }

      if (category.userId !== userId) {
        throw new ForbiddenException('Cannot link a label to another user\'s category');
      }
    }

    if (dto.name) {
      const duplicate = await this.prisma.sessionLabel.findFirst({
        where: {
          userId,
          name: { equals: dto.name, mode: 'insensitive' },
          id: { not: id },
          isArchived: false,
        },
      });

      if (duplicate) {
        throw new ConflictException(`Label "${dto.name}" already exists`);
      }
    }

    return this.prisma.sessionLabel.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
      },
      include: {
        category: true,
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);

    return this.prisma.sessionLabel.update({
      where: { id },
      data: { isArchived: true },
    });
  }
}
