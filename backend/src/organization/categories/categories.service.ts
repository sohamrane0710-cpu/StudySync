import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateCategoryDto) {
    const existing = await this.prisma.sessionCategory.findFirst({
      where: {
        userId,
        name: { equals: dto.name, mode: 'insensitive' },
        isArchived: false,
      },
    });

    if (existing) {
      throw new ConflictException(`Category "${dto.name}" already exists`);
    }

    return this.prisma.sessionCategory.create({
      data: {
        userId,
        name: dto.name,
        color: dto.color || '#6366F1',
        icon: dto.icon,
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.sessionCategory.findMany({
      where: {
        userId,
        isArchived: false,
      },
      include: {
        labels: {
          where: { isArchived: false },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(userId: string, id: string) {
    const category = await this.prisma.sessionCategory.findUnique({
      where: { id },
      include: {
        labels: {
          where: { isArchived: false },
        },
      },
    });

    if (!category || category.isArchived) {
      throw new NotFoundException('Category not found');
    }

    if (category.userId !== userId) {
      throw new ForbiddenException('Access to category denied');
    }

    return category;
  }

  async update(userId: string, id: string, dto: UpdateCategoryDto) {
    await this.findOne(userId, id);

    if (dto.name) {
      const duplicate = await this.prisma.sessionCategory.findFirst({
        where: {
          userId,
          name: { equals: dto.name, mode: 'insensitive' },
          id: { not: id },
          isArchived: false,
        },
      });

      if (duplicate) {
        throw new ConflictException(`Category "${dto.name}" already exists`);
      }
    }

    return this.prisma.sessionCategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.icon !== undefined && { icon: dto.icon }),
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);

    // Soft delete/archive so historical records remain intact
    return this.prisma.sessionCategory.update({
      where: { id },
      data: { isArchived: true },
    });
  }
}
