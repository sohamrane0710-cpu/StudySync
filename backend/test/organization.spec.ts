import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { cleanDatabase, createDevToken, createTestApp } from './test-helper';
import { PrismaService } from '../src/database/prisma.service';

describe('3. Category & Label Taxonomy and Cross-User Isolation', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const userA = '33333333-3333-4333-8333-333333333333';
  const userB = '44444444-4444-4444-8444-444444444444';
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    const testSetup = await createTestApp();
    app = testSetup.app;
    prisma = testSetup.prisma;
    tokenA = createDevToken(userA, 'user_a@example.com', 'user_a');
    tokenB = createDevToken(userB, 'user_b@example.com', 'user_b');
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  let categoryAId: string;
  let labelAId: string;

  it('allows User A to create a category and a child label', async () => {
    const catRes = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Mathematics',
        color: '#6366F1',
      });

    expect(catRes.status).toBe(201);
    categoryAId = catRes.body.id;

    const labelRes = await request(app.getHttpServer())
      .post('/api/v1/labels')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Calculus',
        categoryId: categoryAId,
      });

    expect(labelRes.status).toBe(201);
    labelAId = labelRes.body.id;
  });

  it('prevents User B from accessing User A category', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/categories/${categoryAId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(403);
  });

  it('prevents User B from linking a label to User A category', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/labels')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        name: 'Hacked Label',
        categoryId: categoryAId,
      });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('another user\'s category');
  });

  it('prevents User B from attaching User A category/label to a study session', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/study-sessions')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        title: 'Unauthorized Study Record',
        targetDuration: 1500,
        actualDuration: 1500,
        startedAt: new Date(Date.now() - 1500000).toISOString(),
        endedAt: new Date().toISOString(),
        categoryIds: [categoryAId],
      });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('belong to another user');
  });
});
