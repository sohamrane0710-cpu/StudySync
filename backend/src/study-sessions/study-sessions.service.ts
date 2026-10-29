import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateStudySessionDto } from './dto/create-study-session.dto';
import { QueryStudySessionsDto } from './dto/query-study-sessions.dto';
import { UpdateStudySessionDto } from './dto/update-study-session.dto';

@Injectable()
export class StudySessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateStudySessionDto, customTx?: Prisma.TransactionClient) {
    const client = customTx || this.prisma;

    // Validate ownership of provided categories
    if (dto.categoryIds && dto.categoryIds.length > 0) {
      const ownedCategoriesCount = await client.sessionCategory.count({
        where: {
          id: { in: dto.categoryIds },
          userId,
          isArchived: false,
        },
      });

      if (ownedCategoriesCount !== dto.categoryIds.length) {
        throw new ForbiddenException(
          'One or more specified categories do not exist or belong to another user',
        );
      }
    }

    // Validate ownership of provided labels
    if (dto.labelIds && dto.labelIds.length > 0) {
      const ownedLabelsCount = await client.sessionLabel.count({
        where: {
          id: { in: dto.labelIds },
          userId,
          isArchived: false,
        },
      });

      if (ownedLabelsCount !== dto.labelIds.length) {
        throw new ForbiddenException(
          'One or more specified labels do not exist or belong to another user',
        );
      }
    }

    return client.studySession.create({
      data: {
        userId,
        title: dto.title,
        phase: dto.phase || 'FOCUS',
        status: dto.status || 'COMPLETED',
        targetDuration: dto.targetDuration,
        actualDuration: dto.actualDuration,
        startedAt: new Date(dto.startedAt),
        endedAt: new Date(dto.endedAt),
        notes: dto.notes,
        timerSessionId: dto.timerSessionId,
        roomStudySessionId: dto.roomStudySessionId,
        ...(dto.categoryIds && dto.categoryIds.length > 0 && {
          categories: {
            create: dto.categoryIds.map((categoryId) => ({
              categoryId,
            })),
          },
        }),
        ...(dto.labelIds && dto.labelIds.length > 0 && {
          labels: {
            create: dto.labelIds.map((labelId) => ({
              labelId,
            })),
          },
        }),
      },
      include: {
        categories: {
          include: { category: true },
        },
        labels: {
          include: { label: true },
        },
      },
    });
  }

  async findAll(userId: string, query: QueryStudySessionsDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.StudySessionWhereInput = {
      userId,
      ...(query.status && { status: query.status }),
      ...(query.startDate && { startedAt: { gte: new Date(query.startDate) } }),
      ...(query.endDate && { endedAt: { lte: new Date(query.endDate) } }),
      ...(query.categoryId && {
        categories: {
          some: { categoryId: query.categoryId },
        },
      }),
      ...(query.labelId && {
        labels: {
          some: { labelId: query.labelId },
        },
      }),
    };

    const [total, data] = await Promise.all([
      this.prisma.studySession.count({ where }),
      this.prisma.studySession.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startedAt: 'desc' },
        include: {
          categories: {
            include: { category: true },
          },
          labels: {
            include: { label: true },
          },
        },
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(userId: string, id: string) {
    const session = await this.prisma.studySession.findUnique({
      where: { id },
      include: {
        categories: {
          include: { category: true },
        },
        labels: {
          include: { label: true },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Study session record not found');
    }

    if (session.userId !== userId) {
      throw new ForbiddenException('Access to study session is denied');
    }

    return session;
  }

  async update(userId: string, id: string, dto: UpdateStudySessionDto) {
    await this.findOne(userId, id);

    // Validate ownership of new categories
    if (dto.categoryIds && dto.categoryIds.length > 0) {
      const ownedCategoriesCount = await this.prisma.sessionCategory.count({
        where: {
          id: { in: dto.categoryIds },
          userId,
          isArchived: false,
        },
      });

      if (ownedCategoriesCount !== dto.categoryIds.length) {
        throw new ForbiddenException(
          'One or more specified categories do not exist or belong to another user',
        );
      }
    }

    // Validate ownership of new labels
    if (dto.labelIds && dto.labelIds.length > 0) {
      const ownedLabelsCount = await this.prisma.sessionLabel.count({
        where: {
          id: { in: dto.labelIds },
          userId,
          isArchived: false,
        },
      });

      if (ownedLabelsCount !== dto.labelIds.length) {
        throw new ForbiddenException(
          'One or more specified labels do not exist or belong to another user',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.categoryIds !== undefined) {
        await tx.studySessionCategory.deleteMany({
          where: { studySessionId: id },
        });

        if (dto.categoryIds.length > 0) {
          await tx.studySessionCategory.createMany({
            data: dto.categoryIds.map((categoryId) => ({
              studySessionId: id,
              categoryId,
            })),
          });
        }
      }

      if (dto.labelIds !== undefined) {
        await tx.studySessionLabel.deleteMany({
          where: { studySessionId: id },
        });

        if (dto.labelIds.length > 0) {
          await tx.studySessionLabel.createMany({
            data: dto.labelIds.map((labelId) => ({
              studySessionId: id,
              labelId,
            })),
          });
        }
      }

      return tx.studySession.update({
        where: { id },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
        },
        include: {
          categories: { include: { category: true } },
          labels: { include: { label: true } },
        },
      });
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);

    return this.prisma.studySession.delete({
      where: { id },
    });
  }
}
