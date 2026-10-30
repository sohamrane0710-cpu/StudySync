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
    const name = dto.name.trim();

    const active = await this.prisma.sessionCategory.findFirst({
      where: {
        userId,
        name: { equals: name, mode: 'insensitive' },
        isArchived: false,
      },
    });

    if (active) {
      throw new ConflictException(`Category "${name}" already exists`);
    }

    const archived = await this.prisma.sessionCategory.findFirst({
      where: {
        userId,
        name: { equals: name, mode: 'insensitive' },
        isArchived: true,
      },
    });

    if (archived) {
      return this.prisma.sessionCategory.update({
        where: { id: archived.id },
        data: {
          isArchived: false,
          name,
          ...(dto.color && { color: dto.color }),
          ...(dto.icon !== undefined && { icon: dto.icon }),
        },
      });
    }

    try {
      return await this.prisma.sessionCategory.create({
        data: {
          userId,
          name,
          color: dto.color || '#6366F1',
          icon: dto.icon,
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        const raceArchived = await this.prisma.sessionCategory.findFirst({
          where: { userId, name: { equals: name, mode: 'insensitive' }, isArchived: true },
        });
        if (raceArchived) {
          return this.prisma.sessionCategory.update({
            where: { id: raceArchived.id },
            data: {
              isArchived: false,
              name,
              ...(dto.color && { color: dto.color }),
              ...(dto.icon !== undefined && { icon: dto.icon }),
            },
          });
        }
        throw new ConflictException(`Category "${name}" already exists`);
      }
      throw err;
    }
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
      const name = dto.name.trim();
      const duplicate = await this.prisma.sessionCategory.findFirst({
        where: {
          userId,
          name: { equals: name, mode: 'insensitive' },
          id: { not: id },
        },
      });

      if (duplicate) {
        throw new ConflictException(`Category "${name}" already exists`);
      }
    }

    try {
      return await this.prisma.sessionCategory.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name.trim() }),
          ...(dto.color !== undefined && { color: dto.color }),
          ...(dto.icon !== undefined && { icon: dto.icon }),
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException(`Category "${dto.name?.trim()}" already exists`);
      }
      throw err;
    }
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
