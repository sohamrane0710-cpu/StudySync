import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { cleanDatabase, createDevToken, createTestApp } from './test-helper';
import { PrismaService } from '../src/database/prisma.service';

describe('2. Personal Timer State Machine and Idempotency', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const userId = '22222222-2222-4222-8222-222222222222';
  let token: string;
  let timerSessionId: string;

  beforeAll(async () => {
    const testSetup = await createTestApp();
    app = testSetup.app;
    prisma = testSetup.prisma;
    token = createDevToken(userId, 'timer_user@example.com', 'timer_user');
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  it('starts a new personal focus timer', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/timers/start')
      .set('Authorization', `Bearer ${token}`)
      .send({
        phase: 'FOCUS',
        durationOverride: 1500,
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('RUNNING');
    expect(res.body.phase).toBe('FOCUS');
    expect(res.body.targetDuration).toBe(1500);
    expect(res.body.authoritativeRemainingSeconds).toBe(1500);
    timerSessionId = res.body.id;
  });

  it('rejects starting a concurrent active timer with 409 Conflict', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/timers/start')
      .set('Authorization', `Bearer ${token}`)
      .send({
        phase: 'FOCUS',
        durationOverride: 1800,
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('active timer session is already running');
  });

  it('pauses the running timer and captures authoritative remaining seconds', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/timers/pause')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('PAUSED');
    expect(res.body.authoritativeRemainingSeconds).toBeLessThanOrEqual(1500);
    expect(res.body.pausedAt).toBeDefined();
  });

  it('resumes a paused timer with recalculated expectedEndTime', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/timers/resume')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('RUNNING');
    expect(res.body.expectedEndTime).toBeDefined();
  });

  it('completes the active timer, creates a study session, and guarantees idempotency', async () => {
    // Initial completion
    const completeRes = await request(app.getHttpServer())
      .post('/api/v1/timers/complete')
      .set('Authorization', `Bearer ${token}`)
      .send({
        timerSessionId,
        title: 'Deep Work on Compiler Design',
        notes: 'AST transformations and semantic checks',
      });

    expect(completeRes.status).toBe(200);
    expect(completeRes.body.timerSession.status).toBe('COMPLETED');
    expect(completeRes.body.studySession).toBeDefined();
    expect(completeRes.body.studySession.title).toBe('Deep Work on Compiler Design');
    expect(completeRes.body.idempotentReplay).toBe(false);

    const initialStudySessionId = completeRes.body.studySession.id;

    // Verify study sessions in DB: should be exactly 1
    const studyCountBefore = await prisma.studySession.count({ where: { userId } });
    expect(studyCountBefore).toBe(1);

    // Immediate idempotent retry of complete
    const retryRes = await request(app.getHttpServer())
      .post('/api/v1/timers/complete')
      .set('Authorization', `Bearer ${token}`)
      .send({
        timerSessionId,
        title: 'Deep Work on Compiler Design',
      });

    expect(retryRes.status).toBe(200);
    expect(retryRes.body.idempotentReplay).toBe(true);
    expect(retryRes.body.studySession.id).toBe(initialStudySessionId);

    // Database count must still be exactly 1 (no double credit)
    const studyCountAfter = await prisma.studySession.count({ where: { userId } });
    expect(studyCountAfter).toBe(1);
  });
});
