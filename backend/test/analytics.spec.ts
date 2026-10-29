import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { cleanDatabase, createDevToken, createTestApp } from './test-helper';
import { PrismaService } from '../src/database/prisma.service';

describe('7. Analytics Aggregation Without Double-Counting', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const userId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  let token: string;

  beforeAll(async () => {
    const testSetup = await createTestApp();
    app = testSetup.app;
    prisma = testSetup.prisma;
    token = createDevToken(userId, 'analytics@example.com', 'analytics_user');

    // Ensure user profile exists
    await prisma.profile.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        username: 'analytics_user',
        displayName: 'Analytics User',
      },
    });

    // Create 2 categories
    const cat1 = await prisma.sessionCategory.create({
      data: { userId, name: 'Computer Science', color: '#3B82F6' },
    });
    const cat2 = await prisma.sessionCategory.create({
      data: { userId, name: 'Physics', color: '#10B981' },
    });

    const now = new Date();

    // Session 1: 1500s completed, CS category
    await prisma.studySession.create({
      data: {
        userId,
        title: 'Algorithms',
        phase: 'FOCUS',
        status: 'COMPLETED',
        targetDuration: 1500,
        actualDuration: 1500,
        startedAt: new Date(now.getTime() - 7200000),
        endedAt: new Date(now.getTime() - 5700000),
        categories: { create: [{ categoryId: cat1.id }] },
      },
    });

    // Session 2: 1200s interrupted, Physics category
    await prisma.studySession.create({
      data: {
        userId,
        title: 'Mechanics',
        phase: 'FOCUS',
        status: 'INTERRUPTED',
        targetDuration: 1800,
        actualDuration: 1200,
        startedAt: new Date(now.getTime() - 3600000),
        endedAt: new Date(now.getTime() - 2400000),
        categories: { create: [{ categoryId: cat2.id }] },
      },
    });
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  it('aggregates summary without double counting duration', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/analytics/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.totalFocusSeconds).toBe(2700); // 1500 + 1200
    expect(res.body.completedSessionsCount).toBe(1);
    expect(res.body.interruptedSessionsCount).toBe(1);
    expect(res.body.totalSessionsCount).toBe(2);
    expect(res.body.averageSessionSeconds).toBe(1350); // 2700 / 2
  });

  it('correctly aggregates category breakdown', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/analytics/categories')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);

    const cs = res.body.find((c: any) => c.categoryName === 'Computer Science');
    const physics = res.body.find((c: any) => c.categoryName === 'Physics');

    expect(cs.totalSeconds).toBe(1500);
    expect(physics.totalSeconds).toBe(1200);
  });
});
