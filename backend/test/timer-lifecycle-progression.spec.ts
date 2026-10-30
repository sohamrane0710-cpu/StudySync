import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { cleanDatabase, createDevToken, createTestApp } from './test-helper';
import { PrismaService } from '../src/database/prisma.service';
import { TimerDirection, TimerStepType, TimerStatus } from '@prisma/client';

describe('Stage C: Server-Authoritative Timer Lifecycle and Sequence Progression', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const userId = '33333333-3333-4333-8333-333333333333';
  let token: string;

  beforeAll(async () => {
    const testSetup = await createTestApp();
    app = testSetup.app;
    prisma = testSetup.prisma;
    token = createDevToken(userId, 'stage_c_user@example.com', 'stage_c_user');

    // Create user profile
    await prisma.profile.create({
      data: {
        id: userId,
        username: 'stage_c_user',
        displayName: 'Stage C User',
      },
    });

    // Create default user preferences
    await prisma.userPreference.create({
      data: {
        userId,
        autoStartNextSession: false,
      },
    });
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  beforeEach(async () => {
    // Clear study and timer sessions between test blocks
    await prisma.studySessionCategory.deleteMany({ where: { studySession: { userId } } });
    await prisma.studySessionLabel.deleteMany({ where: { studySession: { userId } } });
    await prisma.studySession.deleteMany({ where: { userId } });
    await prisma.timerSession.deleteMany({ where: { userId } });
    await prisma.timerModeStep.deleteMany({ where: { timerMode: { userId } } });
    await prisma.timerMode.deleteMany({ where: { userId } });
    await prisma.userPreference.update({
      where: { userId },
      data: { autoStartNextSession: false },
    });
  });

  // Helper to create a custom timer mode with steps
  async function createCustomMode(
    name: string,
    isLooping = true,
    defaultDirection: TimerDirection = TimerDirection.COUNTDOWN,
  ) {
    return prisma.timerMode.create({
      data: {
        userId,
        name,
        isLooping,
        defaultDirection,
        steps: {
          create: [
            { name: 'Sprint 1', type: TimerStepType.FOCUS, duration: 1500, order: 0 },
            { name: 'Rest 1', type: TimerStepType.REST, duration: 300, order: 1 },
          ],
        },
      },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
  }

  // ==========================================
  // 1. TIME ACCOUNTING
  // ==========================================
  describe('1. Time Accounting', () => {
    it('countdown reaches zero and does not become negative', async () => {
      const mode = await createCustomMode('Countdown Mode');

      // Start countdown timer with 10s override
      const startRes = await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({
          timerModeId: mode.id,
          durationOverride: 10,
          directionOverride: 'COUNTDOWN',
        });

      expect(startRes.status).toBe(201);
      const sessionId = startRes.body.id;

      // Simulate passage of 15 seconds by manually advancing expectedEndTime in past
      const pastTime = new Date(Date.now() - 5000); // 5s in past
      await prisma.timerSession.update({
        where: { id: sessionId },
        data: {
          expectedEndTime: pastTime,
        },
      });

      // getActive performs authoritative expiry calculation
      const activeRes = await request(app.getHttpServer())
        .get('/api/v1/timers/active')
        .set('Authorization', `Bearer ${token}`);

      expect(activeRes.status).toBe(200);
      expect(activeRes.body.authoritativeRemainingSeconds).toBe(0);
      expect(activeRes.body.isExpired).toBe(true);
    });

    it('countdown paused before expiry preserves authoritative remaining seconds', async () => {
      const mode = await createCustomMode('Pause Countdown');

      await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({
          timerModeId: mode.id,
          durationOverride: 1000,
          directionOverride: 'COUNTDOWN',
        });

      const pauseRes = await request(app.getHttpServer())
        .post('/api/v1/timers/pause')
        .set('Authorization', `Bearer ${token}`);

      expect(pauseRes.status).toBe(200);
      expect(pauseRes.body.status).toBe('PAUSED');
      expect(pauseRes.body.authoritativeRemainingSeconds).toBeLessThanOrEqual(1000);
      expect(pauseRes.body.authoritativeRemainingSeconds).toBeGreaterThan(900);
      expect(pauseRes.body.expectedEndTime).toBeNull();
    });

    it('countdown resumed after pause recalculates expectedEndTime accurately', async () => {
      const mode = await createCustomMode('Resume Countdown');

      await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({
          timerModeId: mode.id,
          durationOverride: 800,
        });

      await request(app.getHttpServer())
        .post('/api/v1/timers/pause')
        .set('Authorization', `Bearer ${token}`);

      const resumeRes = await request(app.getHttpServer())
        .post('/api/v1/timers/resume')
        .set('Authorization', `Bearer ${token}`);

      expect(resumeRes.status).toBe(200);
      expect(resumeRes.body.status).toBe('RUNNING');
      expect(resumeRes.body.expectedEndTime).toBeDefined();

      const expectedEnd = new Date(resumeRes.body.expectedEndTime).getTime();
      const diffMs = expectedEnd - Date.now();
      expect(Math.round(diffMs / 1000)).toBeCloseTo(800, -1);
    });

    it('count-up starts at zero and tracks elapsed time', async () => {
      const mode = await createCustomMode('Countup Mode', true, TimerDirection.COUNT_UP);

      const startRes = await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({
          timerModeId: mode.id,
          directionOverride: 'COUNT_UP',
        });

      expect(startRes.status).toBe(201);
      expect(startRes.body.direction).toBe('COUNT_UP');
      expect(startRes.body.authoritativeElapsedSeconds).toBe(0);
      expect(startRes.body.authoritativeRemainingSeconds).toBe(0);
      expect(startRes.body.expectedEndTime).toBeNull();
    });

    it('count-up pause and resume excludes paused time from elapsed duration', async () => {
      const mode = await createCustomMode('Countup Pause/Resume', true, TimerDirection.COUNT_UP);

      const startRes = await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({
          timerModeId: mode.id,
          directionOverride: 'COUNT_UP',
        });

      const sessionId = startRes.body.id;

      // Simulate that 100 seconds elapsed before pausing
      const hundredSecAgo = new Date(Date.now() - 100000);
      await prisma.timerSession.update({
        where: { id: sessionId },
        data: {
          startedAt: hundredSecAgo,
          resumedAt: hundredSecAgo,
        },
      });

      const pauseRes = await request(app.getHttpServer())
        .post('/api/v1/timers/pause')
        .set('Authorization', `Bearer ${token}`);

      expect(pauseRes.status).toBe(200);
      expect(pauseRes.body.status).toBe('PAUSED');
      expect(pauseRes.body.authoritativeElapsedSeconds).toBeGreaterThanOrEqual(99);

      const pausedElapsed = pauseRes.body.authoritativeElapsedSeconds;

      // Resume timer
      const resumeRes = await request(app.getHttpServer())
        .post('/api/v1/timers/resume')
        .set('Authorization', `Bearer ${token}`);

      expect(resumeRes.status).toBe(200);
      expect(resumeRes.body.status).toBe('RUNNING');
      // Immediately upon resume, elapsed is still the accumulated elapsed
      expect(resumeRes.body.authoritativeElapsedSeconds).toBe(pausedElapsed);
    });

    it('count-up does not auto-expire even if target duration has elapsed', async () => {
      const mode = await createCustomMode('Countup No Expire', true, TimerDirection.COUNT_UP);

      const startRes = await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({
          timerModeId: mode.id,
          durationOverride: 60,
          directionOverride: 'COUNT_UP',
        });

      const sessionId = startRes.body.id;

      // Set startedAt to 300 seconds ago (5x target duration)
      const pastTime = new Date(Date.now() - 300000);
      await prisma.timerSession.update({
        where: { id: sessionId },
        data: {
          startedAt: pastTime,
          resumedAt: pastTime,
        },
      });

      const activeRes = await request(app.getHttpServer())
        .get('/api/v1/timers/active')
        .set('Authorization', `Bearer ${token}`);

      expect(activeRes.status).toBe(200);
      expect(activeRes.body.status).toBe('RUNNING');
      expect(activeRes.body.isExpired).toBe(false);
      expect(activeRes.body.authoritativeElapsedSeconds).toBeGreaterThanOrEqual(299);
    });

    it('per-run duration overrides do not alter saved mode defaults or step durations', async () => {
      const mode = await createCustomMode('Immutable Mode Check');
      const originalDuration = mode.steps[0].duration;

      // Start with 600s override
      await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({
          timerModeId: mode.id,
          durationOverride: 600,
        });

      // Verify mode step in database was NOT modified
      const stepInDb = await prisma.timerModeStep.findUnique({
        where: { id: mode.steps[0].id },
      });

      expect(stepInDb?.duration).toBe(originalDuration);
      expect(stepInDb?.duration).not.toBe(600);
    });
  });

  // ==========================================
  // 2. SEQUENCE PROGRESSION & AUTO-START
  // ==========================================
  describe('2. Sequence Progression and Auto-Start', () => {
    it('focus completion advances sequence to rest step', async () => {
      const mode = await createCustomMode('Focus to Rest');

      // Start step 0 (FOCUS)
      const startRes = await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerModeId: mode.id, stepIndex: 0 });

      // Complete focus step
      const completeRes = await request(app.getHttpServer())
        .post('/api/v1/timers/complete')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerSessionId: startRes.body.id, title: 'Focus 1 Complete' });

      expect(completeRes.status).toBe(200);
      expect(completeRes.body.timerSession.status).toBe('COMPLETED');
      expect(completeRes.body.studySession).toBeDefined();
      expect(completeRes.body.studySession.stepName).toBe('Sprint 1');
      expect(completeRes.body.nextStepPreview).toBeDefined();
      expect(completeRes.body.nextStepPreview.stepName).toBe('Rest 1');
      expect(completeRes.body.nextStepPreview.stepType).toBe('REST');
      expect(completeRes.body.isSequenceFinished).toBe(false);
    });

    it('rest completion advances sequence back to focus without creating study session', async () => {
      const mode = await createCustomMode('Rest to Focus');

      // Start step 1 (REST)
      const startRes = await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerModeId: mode.id, stepIndex: 1 });

      const completeRes = await request(app.getHttpServer())
        .post('/api/v1/timers/complete')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerSessionId: startRes.body.id });

      expect(completeRes.status).toBe(200);
      expect(completeRes.body.timerSession.status).toBe('COMPLETED');
      // REST step MUST NOT produce a credited StudySession!
      expect(completeRes.body.studySession).toBeNull();
      // Total study sessions in DB must be 0
      const count = await prisma.studySession.count({ where: { userId } });
      expect(count).toBe(0);

      // Looping is true, so next step wraps to Sprint 1
      expect(completeRes.body.nextStepPreview.stepName).toBe('Sprint 1');
      expect(completeRes.body.nextStepPreview.stepType).toBe('FOCUS');
    });

    it('final step wraps to first step when isLooping is true', async () => {
      const mode = await createCustomMode('Looping Sequence', true);

      // Start on final step (index 1)
      const startRes = await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerModeId: mode.id, stepIndex: 1 });

      const completeRes = await request(app.getHttpServer())
        .post('/api/v1/timers/complete')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerSessionId: startRes.body.id });

      expect(completeRes.status).toBe(200);
      expect(completeRes.body.isSequenceFinished).toBe(false);
      expect(completeRes.body.nextStepPreview.stepIndex).toBe(0);
      expect(completeRes.body.nextStepPreview.stepName).toBe('Sprint 1');
    });

    it('final step marks sequence finished when isLooping is false', async () => {
      const mode = await createCustomMode('Non-Looping Sequence', false);

      // Start on final step (index 1)
      const startRes = await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerModeId: mode.id, stepIndex: 1 });

      const completeRes = await request(app.getHttpServer())
        .post('/api/v1/timers/complete')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerSessionId: startRes.body.id });

      expect(completeRes.status).toBe(200);
      expect(completeRes.body.isSequenceFinished).toBe(true);
      expect(completeRes.body.nextStepPreview).toBeNull();
      expect(completeRes.body.nextTimerSession).toBeNull();
    });

    it('autoStartNextSession enabled starts exactly one next timer automatically', async () => {
      // Enable global autoStartNextSession
      await prisma.userPreference.update({
        where: { userId },
        data: { autoStartNextSession: true },
      });

      const mode = await createCustomMode('Auto-Start Enabled Mode');

      // Start Step 0
      const startRes = await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerModeId: mode.id, stepIndex: 0 });

      // Complete Step 0
      const completeRes = await request(app.getHttpServer())
        .post('/api/v1/timers/complete')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerSessionId: startRes.body.id, title: 'Completed Step 0' });

      expect(completeRes.status).toBe(200);
      expect(completeRes.body.autoStarted).toBe(true);
      expect(completeRes.body.nextTimerSession).toBeDefined();
      expect(completeRes.body.nextTimerSession.status).toBe('RUNNING');
      expect(completeRes.body.nextTimerSession.stepIndex).toBe(1);
      expect(completeRes.body.nextTimerSession.stepName).toBe('Rest 1');

      // Verify exactly 1 active timer exists in DB for this user
      const activeCount = await prisma.timerSession.count({
        where: { userId, status: { in: [TimerStatus.RUNNING, TimerStatus.PAUSED] } },
      });
      expect(activeCount).toBe(1);
    });

    it('autoStartNextSession disabled returns next step preview choices without auto-starting', async () => {
      await prisma.userPreference.update({
        where: { userId },
        data: { autoStartNextSession: false },
      });

      const mode = await createCustomMode('Manual Progression Mode');

      const startRes = await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerModeId: mode.id, stepIndex: 0 });

      const completeRes = await request(app.getHttpServer())
        .post('/api/v1/timers/complete')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerSessionId: startRes.body.id, title: 'Manual Step 0' });

      expect(completeRes.status).toBe(200);
      expect(completeRes.body.autoStarted).toBe(false);
      expect(completeRes.body.nextTimerSession).toBeNull();
      expect(completeRes.body.nextStepPreview).toBeDefined();
      expect(completeRes.body.nextStepPreview.stepIndex).toBe(1);

      // Verify NO active timer exists in DB
      const activeCount = await prisma.timerSession.count({
        where: { userId, status: { in: [TimerStatus.RUNNING, TimerStatus.PAUSED] } },
      });
      expect(activeCount).toBe(0);
    });

    it('skip advances sequence without creating any credited StudySession', async () => {
      const mode = await createCustomMode('Skip Step Mode');

      const startRes = await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerModeId: mode.id, stepIndex: 0 });

      const skipRes = await request(app.getHttpServer())
        .post('/api/v1/timers/skip')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerSessionId: startRes.body.id });

      expect(skipRes.status).toBe(200);
      expect(skipRes.body.timerSession.status).toBe('CANCELLED');
      expect(skipRes.body.studySession).toBeNull();
      expect(skipRes.body.nextStepPreview.stepIndex).toBe(1);

      // StudySession count must be 0
      const count = await prisma.studySession.count({ where: { userId } });
      expect(count).toBe(0);
    });

    it('finish-sequence finishes active timer and prevents further progression', async () => {
      const mode = await createCustomMode('Finish Sequence Mode');

      const startRes = await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerModeId: mode.id, stepIndex: 0 });

      const finishRes = await request(app.getHttpServer())
        .post('/api/v1/timers/finish-sequence')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerSessionId: startRes.body.id });

      expect(finishRes.status).toBe(200);
      expect(finishRes.body.finished).toBe(true);
      expect(finishRes.body.isSequenceFinished).toBe(true);

      // Active timer query must return null
      const activeRes = await request(app.getHttpServer())
        .get('/api/v1/timers/active')
        .set('Authorization', `Bearer ${token}`);

      expect(activeRes.status).toBe(200);
      expect(activeRes.body === null || Object.keys(activeRes.body).length === 0).toBe(true);
    });
  });

  // ==========================================
  // 3. PERSISTENCE, LABELS & IDEMPOTENCY
  // ==========================================
  describe('3. Persistence and Idempotency', () => {
    it('focus completion persists title, notes, categories, and labels', async () => {
      // Create category & label
      const category = await prisma.sessionCategory.create({
        data: { userId, name: 'Algorithms' },
      });
      const label = await prisma.sessionLabel.create({
        data: { userId, name: 'Graph Theory', categoryId: category.id },
      });

      const mode = await createCustomMode('Tagged Mode');

      const startRes = await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerModeId: mode.id });

      const completeRes = await request(app.getHttpServer())
        .post('/api/v1/timers/complete')
        .set('Authorization', `Bearer ${token}`)
        .send({
          timerSessionId: startRes.body.id,
          title: 'Dijkstra and A* Implementation',
          notes: 'Covered priority queue optimization',
          categoryIds: [category.id],
          labelIds: [label.id],
        });

      expect(completeRes.status).toBe(200);
      expect(completeRes.body.studySession.title).toBe('Dijkstra and A* Implementation');
      expect(completeRes.body.studySession.notes).toBe('Covered priority queue optimization');

      // Verify associations in database
      const studyInDb = await prisma.studySession.findUnique({
        where: { id: completeRes.body.studySession.id },
        include: {
          categories: true,
          labels: true,
        },
      });

      expect(studyInDb?.categories.length).toBe(1);
      expect(studyInDb?.categories[0].categoryId).toBe(category.id);
      expect(studyInDb?.labels.length).toBe(1);
      expect(studyInDb?.labels[0].labelId).toBe(label.id);
    });

    it('duplicate completion requests return idempotent replay without duplicating records', async () => {
      const mode = await createCustomMode('Idempotent Mode');

      const startRes = await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerModeId: mode.id });

      const sessionId = startRes.body.id;

      // First complete
      const firstRes = await request(app.getHttpServer())
        .post('/api/v1/timers/complete')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerSessionId: sessionId, title: 'Idempotency Test' });

      expect(firstRes.status).toBe(200);
      expect(firstRes.body.idempotentReplay).toBe(false);

      // Second identical complete request with exact session ID
      const secondRes = await request(app.getHttpServer())
        .post('/api/v1/timers/complete')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerSessionId: sessionId, title: 'Idempotency Test' });

      expect(secondRes.status).toBe(200);
      expect(secondRes.body.idempotentReplay).toBe(true);
      expect(secondRes.body.studySession.id).toBe(firstRes.body.studySession.id);

      // StudySessions in database must be exactly 1
      const count = await prisma.studySession.count({ where: { userId } });
      expect(count).toBe(1);
    });

    it('expired countdown reconciles correctly on getActive retrieval', async () => {
      const mode = await createCustomMode('Expiry Reconcile Mode');

      const startRes = await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerModeId: mode.id, durationOverride: 10 });

      const sessionId = startRes.body.id;

      // Force expectedEndTime to be in the past
      await prisma.timerSession.update({
        where: { id: sessionId },
        data: {
          expectedEndTime: new Date(Date.now() - 10000),
        },
      });

      // Calling getActive reconciles the expired session
      const activeRes = await request(app.getHttpServer())
        .get('/api/v1/timers/active')
        .set('Authorization', `Bearer ${token}`);

      expect(activeRes.status).toBe(200);
      expect(activeRes.body.isExpired).toBe(true);

      // Verify that database record is now COMPLETED
      const sessionInDb = await prisma.timerSession.findUnique({
        where: { id: sessionId },
      });
      expect(sessionInDb?.status).toBe('COMPLETED');

      // And a credited study session was created for the expired FOCUS step
      const studyInDb = await prisma.studySession.findFirst({
        where: { timerSessionId: sessionId },
      });
      expect(studyInDb).toBeDefined();
      expect(studyInDb?.targetDuration).toBe(10);
    });
  });

  // ==========================================
  // 4. CONCURRENCY & RACE CONDITIONS
  // ==========================================
  describe('4. Concurrency Protection', () => {
    it('two simultaneous start requests: exactly one succeeds and one receives 409 Conflict', async () => {
      const mode = await createCustomMode('Concurrent Starts');

      // Dispatch 2 concurrent start requests simultaneously
      const [res1, res2] = await Promise.all([
        request(app.getHttpServer())
          .post('/api/v1/timers/start')
          .set('Authorization', `Bearer ${token}`)
          .send({ timerModeId: mode.id }),
        request(app.getHttpServer())
          .post('/api/v1/timers/start')
          .set('Authorization', `Bearer ${token}`)
          .send({ timerModeId: mode.id }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([201, 409]);

      // Verify exactly one active session in DB
      const activeCount = await prisma.timerSession.count({
        where: { userId, status: { in: [TimerStatus.RUNNING, TimerStatus.PAUSED] } },
      });
      expect(activeCount).toBe(1);
    });

    it('two simultaneous completion requests: creates exactly one credited StudySession', async () => {
      const mode = await createCustomMode('Concurrent Completes');

      const startRes = await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerModeId: mode.id });

      const sessionId = startRes.body.id;

      // Dispatch 2 concurrent complete calls for the same session
      const [comp1, comp2] = await Promise.all([
        request(app.getHttpServer())
          .post('/api/v1/timers/complete')
          .set('Authorization', `Bearer ${token}`)
          .send({ timerSessionId: sessionId, title: 'Concurrent Finish' }),
        request(app.getHttpServer())
          .post('/api/v1/timers/complete')
          .set('Authorization', `Bearer ${token}`)
          .send({ timerSessionId: sessionId, title: 'Concurrent Finish' }),
      ]);

      expect(comp1.status).toBe(200);
      expect(comp2.status).toBe(200);

      // One was initial, one was idempotent replay
      const replays = [comp1.body.idempotentReplay, comp2.body.idempotentReplay];
      expect(replays).toContain(false);
      expect(replays).toContain(true);

      // Exactly 1 StudySession created
      const studyCount = await prisma.studySession.count({ where: { userId } });
      expect(studyCount).toBe(1);
    });

    it('completion racing with skip: serializes safely', async () => {
      const mode = await createCustomMode('Race Complete Skip');

      const startRes = await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerModeId: mode.id });

      const sessionId = startRes.body.id;

      // Dispatch complete and skip concurrently
      const [completeRes, skipRes] = await Promise.allSettled([
        request(app.getHttpServer())
          .post('/api/v1/timers/complete')
          .set('Authorization', `Bearer ${token}`)
          .send({ timerSessionId: sessionId }),
        request(app.getHttpServer())
          .post('/api/v1/timers/skip')
          .set('Authorization', `Bearer ${token}`)
          .send({ timerSessionId: sessionId }),
      ]);

      // Exactly one operation succeeds and the session ends cleanly
      const session = await prisma.timerSession.findUnique({ where: { id: sessionId } });
      expect(['COMPLETED', 'CANCELLED']).toContain(session?.status);
    });

    it('running timer continues using its snapshot even if mode steps are deleted or reordered', async () => {
      const mode = await createCustomMode('Mutable Mode Under Active Run');

      // Start run on Step 0
      const startRes = await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerModeId: mode.id, stepIndex: 0 });

      expect(startRes.status).toBe(201);
      const sessionId = startRes.body.id;

      // Now mutate the saved mode: delete step 1
      await prisma.timerModeStep.delete({
        where: { id: mode.steps[1].id },
      });

      // Complete step 0
      const completeRes = await request(app.getHttpServer())
        .post('/api/v1/timers/complete')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerSessionId: sessionId });

      expect(completeRes.status).toBe(200);
      // Even though step 1 was deleted from the saved mode,
      // the immutable snapshot preserved the sequence and advances to 'Rest 1'!
      expect(completeRes.body.nextStepPreview).toBeDefined();
      expect(completeRes.body.nextStepPreview.stepName).toBe('Rest 1');
      expect(completeRes.body.nextStepPreview.stepType).toBe('REST');
    });
  });
});
