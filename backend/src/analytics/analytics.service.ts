import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(userId: string, startDate?: string, endDate?: string) {
    const where: Prisma.StudySessionWhereInput = {
      userId,
      phase: 'FOCUS',
      ...(startDate && { startedAt: { gte: new Date(startDate) } }),
      ...(endDate && { endedAt: { lte: new Date(endDate) } }),
    };

    const sessions = await this.prisma.studySession.findMany({
      where,
      select: {
        id: true,
        actualDuration: true,
        status: true,
        startedAt: true,
      },
    });

    let totalFocusSeconds = 0;
    let completedCount = 0;
    let interruptedCount = 0;
    const dailyMap = new Map<string, { date: string; focusSeconds: number; sessionsCount: number }>();

    for (const session of sessions) {
      totalFocusSeconds += session.actualDuration;

      if (session.status === 'COMPLETED') {
        completedCount++;
      } else if (session.status === 'INTERRUPTED') {
        interruptedCount++;
      }

      const dateStr = session.startedAt.toISOString().slice(0, 10);
      const existing = dailyMap.get(dateStr) || { date: dateStr, focusSeconds: 0, sessionsCount: 0 };
      existing.focusSeconds += session.actualDuration;
      existing.sessionsCount += 1;
      dailyMap.set(dateStr, existing);
    }

    const totalSessions = completedCount + interruptedCount;
    const averageSessionSeconds = totalSessions > 0 ? Math.round(totalFocusSeconds / totalSessions) : 0;

    return {
      totalFocusSeconds,
      completedSessionsCount: completedCount,
      interruptedSessionsCount: interruptedCount,
      totalSessionsCount: totalSessions,
      averageSessionSeconds,
      dailyBreakdown: Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  async getCategoryBreakdown(userId: string, startDate?: string, endDate?: string) {
    const where: Prisma.StudySessionWhereInput = {
      userId,
      phase: 'FOCUS',
      ...(startDate && { startedAt: { gte: new Date(startDate) } }),
      ...(endDate && { endedAt: { lte: new Date(endDate) } }),
    };

    const sessions = await this.prisma.studySession.findMany({
      where,
      select: {
        id: true,
        actualDuration: true,
        categories: {
          select: {
            category: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
          },
        },
      },
    });

    const categoryMap = new Map<
      string,
      { categoryId: string; categoryName: string; color: string; totalSeconds: number; sessionCount: number }
    >();

    let uncategorizedSeconds = 0;
    let uncategorizedCount = 0;

    for (const session of sessions) {
      if (!session.categories || session.categories.length === 0) {
        uncategorizedSeconds += session.actualDuration;
        uncategorizedCount++;
      } else {
        // Distribute session duration evenly if multiple categories attached, or attribute to each
        for (const item of session.categories) {
          const cat = item.category;
          const entry = categoryMap.get(cat.id) || {
            categoryId: cat.id,
            categoryName: cat.name,
            color: cat.color,
            totalSeconds: 0,
            sessionCount: 0,
          };
          entry.totalSeconds += session.actualDuration;
          entry.sessionCount += 1;
          categoryMap.set(cat.id, entry);
        }
      }
    }

    const breakdown = Array.from(categoryMap.values()).sort((a, b) => b.totalSeconds - a.totalSeconds);

    if (uncategorizedCount > 0) {
      breakdown.push({
        categoryId: 'uncategorized',
        categoryName: 'Uncategorized',
        color: '#9CA3AF',
        totalSeconds: uncategorizedSeconds,
        sessionCount: uncategorizedCount,
      });
    }

    return breakdown;
  }

  async getLabelBreakdown(userId: string, startDate?: string, endDate?: string) {
    const where: Prisma.StudySessionWhereInput = {
      userId,
      phase: 'FOCUS',
      ...(startDate && { startedAt: { gte: new Date(startDate) } }),
      ...(endDate && { endedAt: { lte: new Date(endDate) } }),
    };

    const sessions = await this.prisma.studySession.findMany({
      where,
      select: {
        id: true,
        actualDuration: true,
        labels: {
          select: {
            label: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
          },
        },
      },
    });

    const labelMap = new Map<
      string,
      { labelId: string; labelName: string; color: string | null; totalSeconds: number; sessionCount: number }
    >();

    for (const session of sessions) {
      for (const item of session.labels) {
        const lbl = item.label;
        const entry = labelMap.get(lbl.id) || {
          labelId: lbl.id,
          labelName: lbl.name,
          color: lbl.color,
          totalSeconds: 0,
          sessionCount: 0,
        };
        entry.totalSeconds += session.actualDuration;
        entry.sessionCount += 1;
        labelMap.set(lbl.id, entry);
      }
    }

    return Array.from(labelMap.values()).sort((a, b) => b.totalSeconds - a.totalSeconds);
  }
}
