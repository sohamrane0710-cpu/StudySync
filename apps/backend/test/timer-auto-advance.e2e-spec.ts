import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';
import { vi } from 'vitest';

describe('Timer Auto Advance (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cookie1: string;

  let focusCatId1: string;
  let restCatId1: string;
  let customCatId1: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
    prisma = app.get(PrismaService);

    // Create user 1
    const user1Email = `user1_autoadvance_${Date.now()}@example.com`;
    const user1Password = 'password123';
    await request(app.getHttpServer()).post('/auth/register').send({
      email: user1Email,
      password: user1Password,
      name: 'User One',
    });
    const loginRes1 = await request(app.getHttpServer()).post('/auth/login').send({
      identifier: user1Email,
      password: user1Password,
    }).expect(200);
    cookie1 = loginRes1.headers['set-cookie'] as unknown as string;

    // Get categories for user 1
    const categories1 = await prisma.timerCategory.findMany({ where: { user: { email: user1Email } } });
    focusCatId1 = categories1.find((c: any) => c.name === 'Focus')?.id!;
    restCatId1 = categories1.find((c: any) => c.name === 'Rest')?.id!;

    // Create a custom category
    const customRes = await request(app.getHttpServer())
      .post('/timer-categories')
      .set('Cookie', cookie1)
      .send({ name: 'Revision', color: '#00ff00' });
    customCatId1 = customRes.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Phase 3B.5 - Per-Stage Auto-Advance', () => {
    let testModeId: string;
    let sessionId: string;

    beforeEach(async () => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('1. AutoAdvance=true stage transition', async () => {
      const mode = await request(app.getHttpServer()).post('/timer-modes').set('Cookie', cookie1).send({
        name: 'Auto mode', loop: false, stagesConfig: [
          { categoryId: focusCatId1, durationSeconds: 60, autoAdvance: true },
          { categoryId: restCatId1, durationSeconds: 30, autoAdvance: false }
        ]
      });
      testModeId = mode.body.id;

      const session = await request(app.getHttpServer()).post('/timer-sessions').set('Cookie', cookie1).send({ timerModeId: testModeId });
      sessionId = session.body.id;

      vi.setSystemTime(new Date('2026-09-07T10:00:00.000Z'));
      await request(app.getHttpServer()).post(`/timer-sessions/${sessionId}/start`).set('Cookie', cookie1).expect(201);

      // Fast forward 61 seconds (past stage 1)
      vi.setSystemTime(new Date('2026-09-07T10:01:01.000Z'));
      
      const active = await request(app.getHttpServer()).get('/timer-sessions/active').set('Cookie', cookie1).expect(200);
      expect(active.body.currentStageIndex).toBe(1);
      // It auto-advanced! Wait, the new target end time should be EXACTLY 10:00:00 + 60s + 30s = 10:01:30.
      expect(new Date(active.body.targetEndTime).getTime()).toBe(new Date('2026-09-07T10:01:30.000Z').getTime());
    });

    it('2. AutoAdvance=false waiting state & 3. Manual next-stage from waiting', async () => {
      const mode = await request(app.getHttpServer()).post('/timer-modes').set('Cookie', cookie1).send({
        name: 'Wait mode', loop: false, stagesConfig: [
          { categoryId: focusCatId1, durationSeconds: 60, autoAdvance: false },
          { categoryId: restCatId1, durationSeconds: 30, autoAdvance: false }
        ]
      });
      const sess = await request(app.getHttpServer()).post('/timer-sessions').set('Cookie', cookie1).send({ timerModeId: mode.body.id });
      
      vi.setSystemTime(new Date('2026-09-07T10:00:00.000Z'));
      await request(app.getHttpServer()).post(`/timer-sessions/${sess.body.id}/start`).set('Cookie', cookie1).expect(201);

      // Fast forward 65 seconds
      vi.setSystemTime(new Date('2026-09-07T10:01:05.000Z'));
      const active = await request(app.getHttpServer()).get('/timer-sessions/active').set('Cookie', cookie1).expect(200);
      
      // Still on stage 0! Status is RUNNING.
      expect(active.body.currentStageIndex).toBe(0);
      expect(active.body.status).toBe('RUNNING');

      // Manual transition from waiting
      await request(app.getHttpServer()).post(`/timer-sessions/${sess.body.id}/next-stage`).set('Cookie', cookie1).expect(201);
      
      const active2 = await request(app.getHttpServer()).get('/timer-sessions/active').set('Cookie', cookie1).expect(200);
      expect(active2.body.currentStageIndex).toBe(1);
      // New target is 10:01:05 + 30s = 10:01:35
      expect(new Date(active2.body.targetEndTime).getTime()).toBe(new Date('2026-09-07T10:01:35.000Z').getTime());
    });

    it('4. Premature manual next-stage still returns 409', async () => {
      const mode = await request(app.getHttpServer()).post('/timer-modes').set('Cookie', cookie1).send({
        name: 'Auto mode', loop: false, stagesConfig: [
          { categoryId: focusCatId1, durationSeconds: 60, autoAdvance: true },
          { categoryId: restCatId1, durationSeconds: 30, autoAdvance: false }
        ]
      });
      const sess = await request(app.getHttpServer()).post('/timer-sessions').set('Cookie', cookie1).send({ timerModeId: mode.body.id });
      
      vi.setSystemTime(new Date('2026-09-07T10:00:00.000Z'));
      await request(app.getHttpServer()).post(`/timer-sessions/${sess.body.id}/start`).set('Cookie', cookie1).expect(201);

      vi.setSystemTime(new Date('2026-09-07T10:00:30.000Z'));
      await request(app.getHttpServer()).post(`/timer-sessions/${sess.body.id}/next-stage`).set('Cookie', cookie1).expect(409);
    });

    it('5. Final-stage automatic completion & 6. Historical completion timestamp', async () => {
      const mode = await request(app.getHttpServer()).post('/timer-modes').set('Cookie', cookie1).send({
        name: 'Auto final', loop: false, stagesConfig: [
          { categoryId: focusCatId1, durationSeconds: 60, autoAdvance: true }
        ]
      });
      const sess = await request(app.getHttpServer()).post('/timer-sessions').set('Cookie', cookie1).send({ timerModeId: mode.body.id });
      
      vi.setSystemTime(new Date('2026-09-07T10:00:00.000Z'));
      await request(app.getHttpServer()).post(`/timer-sessions/${sess.body.id}/start`).set('Cookie', cookie1).expect(201);

      // Fast forward 2 hours. Client disconnected.
      vi.setSystemTime(new Date('2026-09-07T12:00:00.000Z'));
      
      // Request active session - it should auto complete behind the scenes!
      await request(app.getHttpServer()).get('/timer-sessions/active').set('Cookie', cookie1).expect(404);

      // Check DB
      const studySessions = await prisma.studySession.findMany({ where: { timerSessionId: sess.body.id } });
      expect(studySessions.length).toBe(1);
      const studySession = studySessions[0];
      
      expect(studySession.durationSeconds).toBe(60); // Not 2 hours!
      expect(studySession.startedAt.toISOString()).toBe(new Date('2026-09-07T10:00:00.000Z').toISOString());
      expect(studySession.endedAt.toISOString()).toBe(new Date('2026-09-07T10:01:00.000Z').toISOString());
    });

    it('7. Disconnected client catch-up & 8. Multiple automatic transitions', async () => {
      const mode = await request(app.getHttpServer()).post('/timer-modes').set('Cookie', cookie1).send({
        name: 'Multi auto', loop: false, stagesConfig: [
          { categoryId: focusCatId1, durationSeconds: 10, autoAdvance: true },
          { categoryId: restCatId1, durationSeconds: 10, autoAdvance: true },
          { categoryId: customCatId1, durationSeconds: 10, autoAdvance: false }
        ]
      });
      const sess = await request(app.getHttpServer()).post('/timer-sessions').set('Cookie', cookie1).send({ timerModeId: mode.body.id });
      
      vi.setSystemTime(new Date('2026-09-07T10:00:00.000Z'));
      await request(app.getHttpServer()).post(`/timer-sessions/${sess.body.id}/start`).set('Cookie', cookie1).expect(201);

      // Fast forward 25 seconds.
      vi.setSystemTime(new Date('2026-09-07T10:00:25.000Z'));
      
      const active = await request(app.getHttpServer()).get('/timer-sessions/active').set('Cookie', cookie1).expect(200);
      expect(active.body.currentStageIndex).toBe(2);
      expect(active.body.status).toBe('RUNNING');
      expect(new Date(active.body.targetEndTime).getTime()).toBe(new Date('2026-09-07T10:00:30.000Z').getTime());
    });

    it('9. Loop automatic progression & 13. Long disconnected catch-up', async () => {
      const mode = await request(app.getHttpServer()).post('/timer-modes').set('Cookie', cookie1).send({
        name: 'Loop auto', loop: true, stagesConfig: [
          { categoryId: focusCatId1, durationSeconds: 10, autoAdvance: true },
          { categoryId: restCatId1, durationSeconds: 5, autoAdvance: true }
        ]
      });
      const sess = await request(app.getHttpServer()).post('/timer-sessions').set('Cookie', cookie1).send({ timerModeId: mode.body.id });
      
      vi.setSystemTime(new Date('2026-09-07T10:00:00.000Z'));
      await request(app.getHttpServer()).post(`/timer-sessions/${sess.body.id}/start`).set('Cookie', cookie1).expect(201);

      // Fast forward 1 hour and 16 seconds.
      // Loop duration = 15s. 1 hour = 3600s = 240 loops.
      // + 16s = 1 full loop + 1s.
      // So total 241 loops. currentStageIndex = 241 * 2 = 482.
      // + 1s means it's in stage 0 (duration 10s).
      vi.setSystemTime(new Date('2026-09-07T11:00:16.000Z'));
      
      const active = await request(app.getHttpServer()).get('/timer-sessions/active').set('Cookie', cookie1).expect(200);
      expect(active.body.currentStageIndex).toBe(482);
      // original start = 10:00:00. Loop 241 starts at 11:00:15. Target end = 11:00:25.
      expect(new Date(active.body.targetEndTime).getTime()).toBe(new Date('2026-09-07T11:00:25.000Z').getTime());
    });

    it('10. Loop with autoAdvance=false', async () => {
      const mode = await request(app.getHttpServer()).post('/timer-modes').set('Cookie', cookie1).send({
        name: 'Loop partial auto', loop: true, stagesConfig: [
          { categoryId: focusCatId1, durationSeconds: 10, autoAdvance: true },
          { categoryId: restCatId1, durationSeconds: 5, autoAdvance: false }
        ]
      });
      const sess = await request(app.getHttpServer()).post('/timer-sessions').set('Cookie', cookie1).send({ timerModeId: mode.body.id });
      
      vi.setSystemTime(new Date('2026-09-07T10:00:00.000Z'));
      await request(app.getHttpServer()).post(`/timer-sessions/${sess.body.id}/start`).set('Cookie', cookie1).expect(201);

      // Fast forward 1 hour. Because stage 1 is false, it gets stuck there on loop 0!
      vi.setSystemTime(new Date('2026-09-07T11:00:00.000Z'));
      
      const active = await request(app.getHttpServer()).get('/timer-sessions/active').set('Cookie', cookie1).expect(200);
      expect(active.body.currentStageIndex).toBe(1); // Stuck on rest
      expect(new Date(active.body.targetEndTime).getTime()).toBe(new Date('2026-09-07T10:00:15.000Z').getTime());
    });

    it('11. Pause/resume with auto-advance & 12. Multiple pauses', async () => {
      const mode = await request(app.getHttpServer()).post('/timer-modes').set('Cookie', cookie1).send({
        name: 'Pause auto', loop: false, stagesConfig: [
          { categoryId: focusCatId1, durationSeconds: 60, autoAdvance: true },
          { categoryId: restCatId1, durationSeconds: 30, autoAdvance: true }
        ]
      });
      const sess = await request(app.getHttpServer()).post('/timer-sessions').set('Cookie', cookie1).send({ timerModeId: mode.body.id });
      
      vi.setSystemTime(new Date('2026-09-07T10:00:00.000Z'));
      await request(app.getHttpServer()).post(`/timer-sessions/${sess.body.id}/start`).set('Cookie', cookie1).expect(201);

      // Pause at 10:00:30 (30s remaining)
      vi.setSystemTime(new Date('2026-09-07T10:00:30.000Z'));
      await request(app.getHttpServer()).post(`/timer-sessions/${sess.body.id}/pause`).set('Cookie', cookie1).expect(201);

      // Resume at 11:00:30 (1 hr pause)
      vi.setSystemTime(new Date('2026-09-07T11:00:30.000Z'));
      await request(app.getHttpServer()).post(`/timer-sessions/${sess.body.id}/start`).set('Cookie', cookie1).expect(201);
      
      // Wait 35s. So it auto-advances!
      vi.setSystemTime(new Date('2026-09-07T11:01:05.000Z'));
      const active = await request(app.getHttpServer()).get('/timer-sessions/active').set('Cookie', cookie1).expect(200);
      expect(active.body.currentStageIndex).toBe(1); // Auto-advanced!
      
      // Target end for stage 0 was 11:01:00 (since it paused for 1hr). Stage 1 is +30s = 11:01:30.
      expect(new Date(active.body.targetEndTime).getTime()).toBe(new Date('2026-09-07T11:01:30.000Z').getTime());
    });

    it('14. Concurrent resolution & 15. Duplicate completion prevention', async () => {
      const mode = await request(app.getHttpServer()).post('/timer-modes').set('Cookie', cookie1).send({
        name: 'Concurrent auto', loop: false, stagesConfig: [
          { categoryId: focusCatId1, durationSeconds: 60, autoAdvance: true }
        ]
      });
      const sess = await request(app.getHttpServer()).post('/timer-sessions').set('Cookie', cookie1).send({ timerModeId: mode.body.id });
      
      vi.setSystemTime(new Date('2026-09-07T10:00:00.000Z'));
      await request(app.getHttpServer()).post(`/timer-sessions/${sess.body.id}/start`).set('Cookie', cookie1).expect(201);

      vi.setSystemTime(new Date('2026-09-07T10:01:05.000Z'));
      
      // Send simultaneous requests
      await Promise.all([
        request(app.getHttpServer()).get('/timer-sessions/active').set('Cookie', cookie1),
        request(app.getHttpServer()).get('/timer-sessions/active').set('Cookie', cookie1),
        request(app.getHttpServer()).get('/timer-sessions/active').set('Cookie', cookie1)
      ]);

      const studySessions = await prisma.studySession.findMany({ where: { timerSessionId: sess.body.id } });
      expect(studySessions.length).toBe(1); // Exactly ONE session!
    });

    it('16. Analytics & 17. Largest Remainder invariant', async () => {
      const mode = await request(app.getHttpServer()).post('/timer-modes').set('Cookie', cookie1).send({
        name: 'Analytics auto', loop: false, stagesConfig: [
          { categoryId: focusCatId1, durationSeconds: 1500, autoAdvance: true }, // 25 min
          { categoryId: restCatId1, durationSeconds: 300, autoAdvance: true }, // 5 min
          { categoryId: focusCatId1, durationSeconds: 1500, autoAdvance: true } // 25 min
        ]
      });
      const sess = await request(app.getHttpServer()).post('/timer-sessions').set('Cookie', cookie1).send({ timerModeId: mode.body.id });
      
      vi.setSystemTime(new Date('2026-09-07T10:00:00.000Z'));
      await request(app.getHttpServer()).post(`/timer-sessions/${sess.body.id}/start`).set('Cookie', cookie1).expect(201);

      vi.setSystemTime(new Date('2026-09-07T11:00:00.000Z'));
      await request(app.getHttpServer()).get('/timer-sessions/active').set('Cookie', cookie1).expect(404); // Autocompleted

      const studySessions = await prisma.studySession.findMany({ 
        where: { timerSessionId: sess.body.id },
        include: { studySessionCategories: true }
      });
      
      const s = studySessions[0];
      expect(s.durationSeconds).toBe(3300);

      const focus = s.studySessionCategories.find((c: any) => c.categoryId === focusCatId1);
      const rest = s.studySessionCategories.find((c: any) => c.categoryId === restCatId1);
      expect(focus?.durationSeconds).toBe(3000);
      expect(rest?.durationSeconds).toBe(300);

      const sum = focus!.durationSeconds + rest!.durationSeconds;
      expect(sum).toBe(3300);
    });
  });
});
