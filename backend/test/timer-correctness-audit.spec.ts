import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { cleanDatabase, createDevToken, createTestApp } from './test-helper';
import { PrismaService } from '../src/database/prisma.service';
import { TimerDirection, TimerPhase, TimerStatus, TimerStepType } from '@prisma/client';

describe('StudySync Phase 2.2 — Stage C Final Correctness Audit Suite', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const userId = '11111111-1111-4111-8111-111111111111';
  let token: string;

  beforeAll(async () => {
    const testSetup = await createTestApp();
    app = testSetup.app;
    prisma = testSetup.prisma;
    token = createDevToken(userId, 'audit_user@example.com', 'audit_user');

    await prisma.profile.create({
      data: {
        id: userId,
        username: 'audit_user',
        displayName: 'Audit User',
      },
    });

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

  // Helper to create a 3-step mode: Sprint 1 (FOCUS, 1500s), Rest 1 (REST, 300s), Sprint 2 (FOCUS, 1800s)
  async function createThreeStepMode(name: string, isLooping = true) {
    return prisma.timerMode.create({
      data: {
        userId,
        name,
        isLooping,
        defaultDirection: TimerDirection.COUNTDOWN,
        focusDuration: 1500,
        shortBreakDuration: 300,
        longBreakDuration: 900,
        longBreakInterval: 4,
        steps: {
          create: [
            { name: 'Sprint 1', type: TimerStepType.FOCUS, duration: 1500, order: 0 },
            { name: 'Rest 1', type: TimerStepType.REST, duration: 300, order: 1 },
            { name: 'Sprint 2', type: TimerStepType.FOCUS, duration: 1800, order: 2 },
          ],
        },
      },
      include: {
        steps: { orderBy: { order: 'asc' } },
      },
    });
  }

  // =========================================================================
  // 1. EXACT SESSION IDENTITY
  // =========================================================================
  describe('1. Exact Session Identity', () => {
    it('completion with missing session ID is rejected with 400 Bad Request', async () => {
      const mode = await createThreeStepMode('Missing ID Mode');

      await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerModeId: mode.id, stepIndex: 0 });

      const completeRes = await request(app.getHttpServer())
        .post('/api/v1/timers/complete')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Missing ID' }); // No timerSessionId

      expect(completeRes.status).toBe(400);
      expect(completeRes.body.message).toBeDefined();
    });

    it('skip with missing session ID is rejected with 400 Bad Request', async () => {
      const mode = await createThreeStepMode('Missing Skip ID Mode');

      await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerModeId: mode.id, stepIndex: 0 });

      const skipRes = await request(app.getHttpServer())
        .post('/api/v1/timers/skip')
        .set('Authorization', `Bearer ${token}`)
        .send({}); // No timerSessionId

      expect(skipRes.status).toBe(400);
    });

    it('completion with old session ID while a newer session is active returns idempotent replay of old session without affecting active timer', async () => {
      const mode = await createThreeStepMode('Stale Identity Mode');

      // Start Session 1
      const start1 = await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerModeId: mode.id, stepIndex: 0 });
      const session1Id = start1.body.id;

      // Complete Session 1
      const comp1 = await request(app.getHttpServer())
        .post('/api/v1/timers/complete')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerSessionId: session1Id, title: 'Session 1 Focus' });
      expect(comp1.status).toBe(200);
      expect(comp1.body.idempotentReplay).toBe(false);

      // Start Session 2 (Rest 1)
      const start2 = await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerModeId: mode.id, stepIndex: 1 });
      const session2Id = start2.body.id;

      // Delayed completion request for Session 1 arrives now while Session 2 is active!
      const delayedComp1 = await request(app.getHttpServer())
        .post('/api/v1/timers/complete')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerSessionId: session1Id, title: 'Late Session 1 Request' });

      // Must return idempotent replay of Session 1
      expect(delayedComp1.status).toBe(200);
      expect(delayedComp1.body.idempotentReplay).toBe(true);
      expect(delayedComp1.body.timerSession.id).toBe(session1Id);
      expect(delayedComp1.body.studySession.id).toBe(comp1.body.studySession.id);

      // Session 2 MUST STILL BE RUNNING and completely unaffected!
      const activeCheck = await request(app.getHttpServer())
        .get('/api/v1/timers/active')
        .set('Authorization', `Bearer ${token}`);
      expect(activeCheck.status).toBe(200);
      expect(activeCheck.body.id).toBe(session2Id);
      expect(activeCheck.body.status).toBe('RUNNING');
      expect(activeCheck.body.stepIndex).toBe(1);
    });

    it('skip with a stale session ID is rejected with 409 Conflict', async () => {
      const mode = await createThreeStepMode('Stale Skip Mode');

      // Start & complete Session 1
      const start1 = await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerModeId: mode.id, stepIndex: 0 });
      const session1Id = start1.body.id;

      await request(app.getHttpServer())
        .post('/api/v1/timers/complete')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerSessionId: session1Id });

      // Start Session 2
      await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerModeId: mode.id, stepIndex: 1 });

      // Attempting to skip Session 1 (which was already completed)
      const skipOldRes = await request(app.getHttpServer())
        .post('/api/v1/timers/skip')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerSessionId: session1Id });

      expect(skipOldRes.status).toBe(409);
      expect(skipOldRes.body.message).toContain('already completed');
    });

    it('lifecycle actions (pause, resume, cancel) reject mismatched session ID with 409 Conflict', async () => {
      const mode = await createThreeStepMode('Lifecycle Mismatch Mode');

      const start = await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerModeId: mode.id, stepIndex: 0 });
      const activeSessionId = start.body.id;
      const fakeSessionId = '99999999-9999-4999-8999-999999999999';

      // Pause with wrong ID
      const pauseRes = await request(app.getHttpServer())
        .post('/api/v1/timers/pause')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerSessionId: fakeSessionId });
      expect(pauseRes.status).toBe(409);

      // Cancel with wrong ID
      const cancelRes = await request(app.getHttpServer())
        .post('/api/v1/timers/cancel')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerSessionId: fakeSessionId });
      expect(cancelRes.status).toBe(409);

      // Valid pause
      const validPause = await request(app.getHttpServer())
        .post('/api/v1/timers/pause')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerSessionId: activeSessionId });
      expect(validPause.status).toBe(200);

      // Resume with wrong ID
      const resumeRes = await request(app.getHttpServer())
        .post('/api/v1/timers/resume')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerSessionId: fakeSessionId });
      expect(resumeRes.status).toBe(409);
    });
  });

  // =========================================================================
  // 2. FINISH SEQUENCE SEMANTICS
  // =========================================================================
  describe('2. Finish Sequence Semantics', () => {
    it('when timer is active, finish-sequence requires exact session ID and terminates active step as CANCELLED without study credit', async () => {
      const mode = await createThreeStepMode('Finish Active Mode');

      const start = await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerModeId: mode.id, stepIndex: 0 });
      const sessionId = start.body.id;

      // Finish sequence without session ID while timer is active -> rejected
      const noIdRes = await request(app.getHttpServer())
        .post('/api/v1/timers/finish-sequence')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(noIdRes.status).toBe(400);

      // Finish sequence with exact session ID -> terminates active step
      const finishRes = await request(app.getHttpServer())
        .post('/api/v1/timers/finish-sequence')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerSessionId: sessionId });

      expect(finishRes.status).toBe(200);
      expect(finishRes.body.finished).toBe(true);
      expect(finishRes.body.isSequenceFinished).toBe(true);

      // Verify active step was CANCELLED in DB
      const sessionInDb = await prisma.timerSession.findUnique({ where: { id: sessionId } });
      expect(sessionInDb?.status).toBe(TimerStatus.CANCELLED);

      // Verify NO StudySession was created (not credited)
      const studySessions = await prisma.studySession.findMany({ where: { userId } });
      expect(studySessions.length).toBe(0);

      // No active timer remains
      const activeCheck = await request(app.getHttpServer())
        .get('/api/v1/timers/active')
        .set('Authorization', `Bearer ${token}`);
      expect(activeCheck.status).toBe(200);
      expect(activeCheck.body === null || Object.keys(activeCheck.body).length === 0).toBe(true);
    });

    it('when step was already completed and user is idle viewing choices, finish-sequence marks sequence finished idempotently', async () => {
      const mode = await createThreeStepMode('Finish Idle Mode');

      // Complete step 0
      const start = await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerModeId: mode.id, stepIndex: 0 });

      await request(app.getHttpServer())
        .post('/api/v1/timers/complete')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerSessionId: start.body.id });

      // Database has 1 study session from step 0
      const initialStudyCount = await prisma.studySession.count({ where: { userId } });
      expect(initialStudyCount).toBe(1);

      // User chooses "Finish Sequence" instead of starting Rest 1
      const finishRes1 = await request(app.getHttpServer())
        .post('/api/v1/timers/finish-sequence')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(finishRes1.status).toBe(200);
      expect(finishRes1.body.finished).toBe(true);
      expect(finishRes1.body.isSequenceFinished).toBe(true);
      expect(finishRes1.body.nextTimerSession).toBeNull();

      // Idempotent retry of finish-sequence
      const finishRes2 = await request(app.getHttpServer())
        .post('/api/v1/timers/finish-sequence')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(finishRes2.status).toBe(200);
      expect(finishRes2.body.finished).toBe(true);

      // Study session count MUST NOT change (still 1)
      const afterCount = await prisma.studySession.count({ where: { userId } });
      expect(afterCount).toBe(1);
    });
  });

  // =========================================================================
  // 3. SKIP AND AUTO-START BOUNDARY CASES
  // =========================================================================
  describe('3. Skip and Auto-Start Boundary Combinations', () => {
    // 3-step mode: Step 0 (Sprint 1), Step 1 (Rest 1 - Middle), Step 2 (Sprint 2 - Last)

    it('Combination 1: Middle step, Looping Off/On, Auto-start Off -> Next step available, no active timer', async () => {
      await prisma.userPreference.update({ where: { userId }, data: { autoStartNextSession: false } });
      const mode = await createThreeStepMode('Comb 1 Mode', false);

      // Start on Step 1 (Middle step, REST)
      const start = await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerModeId: mode.id, stepIndex: 1 });

      const skipRes = await request(app.getHttpServer())
        .post('/api/v1/timers/skip')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerSessionId: start.body.id });

      expect(skipRes.status).toBe(200);
      expect(skipRes.body.autoStarted).toBe(false);
      expect(skipRes.body.nextTimerSession).toBeNull();
      expect(skipRes.body.isSequenceFinished).toBe(false);
      expect(skipRes.body.nextStepPreview).toBeDefined();
      expect(skipRes.body.nextStepPreview.stepIndex).toBe(2);
      expect(skipRes.body.nextStepPreview.stepName).toBe('Sprint 2');

      // No active timer in DB
      const activeCount = await prisma.timerSession.count({
        where: { userId, status: { in: [TimerStatus.RUNNING, TimerStatus.PAUSED] } },
      });
      expect(activeCount).toBe(0);
    });

    it('Combination 2: Middle step, Looping Off/On, Auto-start On -> Exactly one next timer starts', async () => {
      await prisma.userPreference.update({ where: { userId }, data: { autoStartNextSession: true } });
      const mode = await createThreeStepMode('Comb 2 Mode', false);

      // Start on Step 1 (Middle step, REST)
      const start = await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerModeId: mode.id, stepIndex: 1 });

      const skipRes = await request(app.getHttpServer())
        .post('/api/v1/timers/skip')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerSessionId: start.body.id });

      expect(skipRes.status).toBe(200);
      expect(skipRes.body.autoStarted).toBe(true);
      expect(skipRes.body.nextTimerSession).toBeDefined();
      expect(skipRes.body.nextTimerSession.stepIndex).toBe(2);
      expect(skipRes.body.nextTimerSession.stepName).toBe('Sprint 2');
      expect(skipRes.body.nextTimerSession.status).toBe('RUNNING');

      // Exactly 1 active timer in DB
      const activeCount = await prisma.timerSession.count({
        where: { userId, status: { in: [TimerStatus.RUNNING, TimerStatus.PAUSED] } },
      });
      expect(activeCount).toBe(1);
    });

    it('Combination 3: Last step, Looping Off, Auto-start Off -> Sequence finishes, no new timer', async () => {
      await prisma.userPreference.update({ where: { userId }, data: { autoStartNextSession: false } });
      const mode = await createThreeStepMode('Comb 3 Mode', false);

      // Start on Step 2 (Last step)
      const start = await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerModeId: mode.id, stepIndex: 2 });

      const skipRes = await request(app.getHttpServer())
        .post('/api/v1/timers/skip')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerSessionId: start.body.id });

      expect(skipRes.status).toBe(200);
      expect(skipRes.body.isSequenceFinished).toBe(true);
      expect(skipRes.body.nextStepPreview).toBeNull();
      expect(skipRes.body.nextTimerSession).toBeNull();

      const activeCount = await prisma.timerSession.count({
        where: { userId, status: { in: [TimerStatus.RUNNING, TimerStatus.PAUSED] } },
      });
      expect(activeCount).toBe(0);
    });

    it('Combination 4: Last step, Looping Off, Auto-start On -> Sequence finishes; no new timer', async () => {
      await prisma.userPreference.update({ where: { userId }, data: { autoStartNextSession: true } });
      const mode = await createThreeStepMode('Comb 4 Mode', false);

      // Start on Step 2 (Last step)
      const start = await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerModeId: mode.id, stepIndex: 2 });

      const skipRes = await request(app.getHttpServer())
        .post('/api/v1/timers/skip')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerSessionId: start.body.id });

      expect(skipRes.status).toBe(200);
      expect(skipRes.body.isSequenceFinished).toBe(true);
      expect(skipRes.body.nextTimerSession).toBeNull();

      const activeCount = await prisma.timerSession.count({
        where: { userId, status: { in: [TimerStatus.RUNNING, TimerStatus.PAUSED] } },
      });
      expect(activeCount).toBe(0);
    });

    it('Combination 5: Last step, Looping On, Auto-start Off -> First step available', async () => {
      await prisma.userPreference.update({ where: { userId }, data: { autoStartNextSession: false } });
      const mode = await createThreeStepMode('Comb 5 Mode', true);

      // Start on Step 2 (Last step)
      const start = await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerModeId: mode.id, stepIndex: 2 });

      const skipRes = await request(app.getHttpServer())
        .post('/api/v1/timers/skip')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerSessionId: start.body.id });

      expect(skipRes.status).toBe(200);
      expect(skipRes.body.isSequenceFinished).toBe(false);
      expect(skipRes.body.autoStarted).toBe(false);
      expect(skipRes.body.nextStepPreview).toBeDefined();
      expect(skipRes.body.nextStepPreview.stepIndex).toBe(0);
      expect(skipRes.body.nextStepPreview.stepName).toBe('Sprint 1');

      const activeCount = await prisma.timerSession.count({
        where: { userId, status: { in: [TimerStatus.RUNNING, TimerStatus.PAUSED] } },
      });
      expect(activeCount).toBe(0);
    });

    it('Combination 6: Last step, Looping On, Auto-start On -> Exactly one first-step timer starts', async () => {
      await prisma.userPreference.update({ where: { userId }, data: { autoStartNextSession: true } });
      const mode = await createThreeStepMode('Comb 6 Mode', true);

      // Start on Step 2 (Last step)
      const start = await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerModeId: mode.id, stepIndex: 2 });

      const skipRes = await request(app.getHttpServer())
        .post('/api/v1/timers/skip')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerSessionId: start.body.id });

      expect(skipRes.status).toBe(200);
      expect(skipRes.body.autoStarted).toBe(true);
      expect(skipRes.body.nextTimerSession).toBeDefined();
      expect(skipRes.body.nextTimerSession.stepIndex).toBe(0);
      expect(skipRes.body.nextTimerSession.stepName).toBe('Sprint 1');
      expect(skipRes.body.nextTimerSession.status).toBe('RUNNING');

      const activeCount = await prisma.timerSession.count({
        where: { userId, status: { in: [TimerStatus.RUNNING, TimerStatus.PAUSED] } },
      });
      expect(activeCount).toBe(1);
    });

    it('skipped FOCUS and REST steps never create credited StudySession records', async () => {
      const mode = await createThreeStepMode('No Credit Skip Mode');

      // Skip FOCUS step
      const startFocus = await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerModeId: mode.id, stepIndex: 0 });

      await request(app.getHttpServer())
        .post('/api/v1/timers/skip')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerSessionId: startFocus.body.id });

      // Skip REST step
      const startRest = await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerModeId: mode.id, stepIndex: 1 });

      await request(app.getHttpServer())
        .post('/api/v1/timers/skip')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerSessionId: startRest.body.id });

      const studySessionCount = await prisma.studySession.count({ where: { userId } });
      expect(studySessionCount).toBe(0);
    });
  });

  // =========================================================================
  // 4. DURATION OVERRIDE SEMANTICS
  // =========================================================================
  describe('4. Duration Override Semantics and Looping Policy', () => {
    it('override applies only to the initial step instance; subsequent loop wraps use captured configuredDuration', async () => {
      // 2-step mode: Sprint 1 (1500s), Rest 1 (300s)
      const mode = await prisma.timerMode.create({
        data: {
          userId,
          name: 'Override Policy Mode',
          isLooping: true,
          focusDuration: 1500,
          shortBreakDuration: 300,
          longBreakDuration: 900,
          longBreakInterval: 4,
          steps: {
            create: [
              { name: 'Sprint 1', type: TimerStepType.FOCUS, duration: 1500, order: 0 },
              { name: 'Rest 1', type: TimerStepType.REST, duration: 300, order: 1 },
            ],
          },
        },
        include: { steps: { orderBy: { order: 'asc' } } },
      });

      // Enable autoStartNextSession to observe complete loop progression automatically
      await prisma.userPreference.update({
        where: { userId },
        data: { autoStartNextSession: true },
      });

      // Start Step 0 with duration override: 600s instead of configured 1500s
      const startRes = await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({
          timerModeId: mode.id,
          stepIndex: 0,
          durationOverride: 600,
        });

      expect(startRes.status).toBe(201);
      expect(startRes.body.targetDuration).toBe(600);
      const session1Id = startRes.body.id;

      // 1. Saved TimerModeStep duration in DB remains unchanged (1500s)
      const step0InDb = await prisma.timerModeStep.findUnique({
        where: { id: mode.steps[0].id },
      });
      expect(step0InDb?.duration).toBe(1500);

      // Complete Step 0 (600s) -> auto-starts Step 1 (Rest 1)
      const comp1 = await request(app.getHttpServer())
        .post('/api/v1/timers/complete')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerSessionId: session1Id });

      expect(comp1.status).toBe(200);
      const session2 = comp1.body.nextTimerSession;
      expect(session2).toBeDefined();
      expect(session2.stepIndex).toBe(1);
      // 2. Subsequent step uses its configured duration (300s)
      expect(session2.targetDuration).toBe(300);

      // Complete Step 1 (300s) -> loops back to Step 0 (Sprint 1)
      const comp2 = await request(app.getHttpServer())
        .post('/api/v1/timers/complete')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerSessionId: session2.id });

      expect(comp2.status).toBe(200);
      const session3 = comp2.body.nextTimerSession;
      expect(session3).toBeDefined();
      expect(session3.stepIndex).toBe(0);
      // 3. Subsequent loop visit follows documented override policy:
      // Reverts to the mode's configuredDuration (1500s), NOT the initial 600s override!
      expect(session3.targetDuration).toBe(1500);
    });
  });

  // =========================================================================
  // 5. EXPIRY AND TIME-BOUNDARY TESTS
  // =========================================================================
  describe('5. Expiry and Time-Boundary Accounting', () => {
    it('countdown at exactly zero expires, while countdown above zero does not expire', async () => {
      const mode = await createThreeStepMode('Zero Boundary Mode');

      const start = await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerModeId: mode.id, stepIndex: 0, durationOverride: 100 });
      const sessionId = start.body.id;

      // Point expectedEndTime to 10 seconds in the future
      await prisma.timerSession.update({
        where: { id: sessionId },
        data: { expectedEndTime: new Date(Date.now() + 10000) },
      });

      let activeRes = await request(app.getHttpServer())
        .get('/api/v1/timers/active')
        .set('Authorization', `Bearer ${token}`);
      expect(activeRes.body.isExpired).toBe(false);
      expect(activeRes.body.authoritativeRemainingSeconds).toBeGreaterThan(0);

      // Now point expectedEndTime to exactly zero / in the past
      await prisma.timerSession.update({
        where: { id: sessionId },
        data: { expectedEndTime: new Date(Date.now() - 1000) },
      });

      activeRes = await request(app.getHttpServer())
        .get('/api/v1/timers/active')
        .set('Authorization', `Bearer ${token}`);
      expect(activeRes.body.isExpired).toBe(true);
      expect(activeRes.body.authoritativeRemainingSeconds).toBe(0);
    });

    it('paused countdown does not expire even when time passes', async () => {
      const mode = await createThreeStepMode('Paused Expiry Mode');

      const start = await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerModeId: mode.id, stepIndex: 0 });
      const sessionId = start.body.id;

      // Pause the timer
      const pauseRes = await request(app.getHttpServer())
        .post('/api/v1/timers/pause')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerSessionId: sessionId });
      expect(pauseRes.status).toBe(200);

      // Simulated time passing: pausedAt was 1 hour ago
      await prisma.timerSession.update({
        where: { id: sessionId },
        data: { pausedAt: new Date(Date.now() - 3600000) },
      });

      const activeRes = await request(app.getHttpServer())
        .get('/api/v1/timers/active')
        .set('Authorization', `Bearer ${token}`);

      expect(activeRes.body.status).toBe('PAUSED');
      expect(activeRes.body.isExpired).toBe(false);
      expect(activeRes.body.authoritativeRemainingSeconds).toBe(pauseRes.body.authoritativeRemainingSeconds);
    });

    it('COUNT_UP never auto-expires and excludes paused time', async () => {
      const mode = await createThreeStepMode('CountUp Boundary Mode');

      // Start COUNT_UP with target duration 100
      const start = await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({
          timerModeId: mode.id,
          stepIndex: 0,
          directionOverride: TimerDirection.COUNT_UP,
          durationOverride: 100,
        });
      const sessionId = start.body.id;

      // Simulate 500 seconds elapsed (well above targetDuration 100)
      await prisma.timerSession.update({
        where: { id: sessionId },
        data: {
          startedAt: new Date(Date.now() - 500000),
          resumedAt: new Date(Date.now() - 500000),
        },
      });

      const activeRes = await request(app.getHttpServer())
        .get('/api/v1/timers/active')
        .set('Authorization', `Bearer ${token}`);

      // Count up never expires automatically
      expect(activeRes.body.isExpired).toBe(false);
      expect(activeRes.body.authoritativeElapsedSeconds).toBeGreaterThanOrEqual(500);

      // Pause it
      await request(app.getHttpServer())
        .post('/api/v1/timers/pause')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerSessionId: sessionId });

      // Fast forward while paused: elapsed time MUST NOT increase
      const sessionAfterPause = await prisma.timerSession.findUnique({ where: { id: sessionId } });
      const elapsedFrozen = sessionAfterPause?.elapsedSeconds;

      await new Promise((r) => setTimeout(r, 200));

      const activeWhilePaused = await request(app.getHttpServer())
        .get('/api/v1/timers/active')
        .set('Authorization', `Bearer ${token}`);
      expect(activeWhilePaused.body.authoritativeElapsedSeconds).toBe(elapsedFrozen);
    });

    it('an expired countdown cannot be paused or resumed', async () => {
      const mode = await createThreeStepMode('Expired Pause Guard Mode');

      const start = await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerModeId: mode.id, stepIndex: 0 });
      const sessionId = start.body.id;

      // Make it expired
      await prisma.timerSession.update({
        where: { id: sessionId },
        data: { expectedEndTime: new Date(Date.now() - 5000) },
      });

      // Attempting to pause expired timer -> 400
      const pauseRes = await request(app.getHttpServer())
        .post('/api/v1/timers/pause')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerSessionId: sessionId });
      expect(pauseRes.status).toBe(400);
      expect(pauseRes.body.message).toContain('expired countdown');

      // Put it in PAUSED state with 0 remaining seconds
      await prisma.timerSession.update({
        where: { id: sessionId },
        data: { status: TimerStatus.PAUSED, remainingSeconds: 0, expectedEndTime: null },
      });

      // Attempting to resume expired timer -> 400
      const resumeRes = await request(app.getHttpServer())
        .post('/api/v1/timers/resume')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerSessionId: sessionId });
      expect(resumeRes.status).toBe(400);
      expect(resumeRes.body.message).toContain('expired countdown');
    });
  });

  // =========================================================================
  // 6. LEGACY PHASE COMPATIBILITY
  // =========================================================================
  describe('6. Legacy Phase Compatibility', () => {
    it('rejects starting a FOCUS step with a conflicting REST phase (400 Bad Request)', async () => {
      const mode = await createThreeStepMode('Phase Conflict Mode');

      // Step 0 is FOCUS, caller attempts to specify phase: SHORT_BREAK
      const res = await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({
          timerModeId: mode.id,
          stepIndex: 0,
          phase: TimerPhase.SHORT_BREAK,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('conflicts with sequence step');
    });

    it('rejects starting a REST step with a conflicting FOCUS phase (400 Bad Request)', async () => {
      const mode = await createThreeStepMode('Phase Conflict Mode 2');

      // Step 1 is REST, caller attempts to specify phase: FOCUS
      const res = await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({
          timerModeId: mode.id,
          stepIndex: 1,
          phase: TimerPhase.FOCUS,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('conflicts with sequence step');
    });

    it('starting without phase derives phase safely from sequence step type', async () => {
      const mode = await createThreeStepMode('Derived Phase Mode');

      // Start step 0 (FOCUS) without phase
      const start0 = await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerModeId: mode.id, stepIndex: 0 });
      expect(start0.status).toBe(201);
      expect(start0.body.phase).toBe(TimerPhase.FOCUS);

      // Cancel to start step 1
      await request(app.getHttpServer())
        .post('/api/v1/timers/cancel')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerSessionId: start0.body.id });

      // Start step 1 (REST) without phase
      const start1 = await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerModeId: mode.id, stepIndex: 1 });
      expect(start1.status).toBe(201);
      expect(start1.body.phase).toBe(TimerPhase.SHORT_BREAK);
    });
  });

  // =========================================================================
  // 7. SNAPSHOT PROGRESSION THROUGH COMPLETE LOOP
  // =========================================================================
  describe('7. Snapshot Progression Through Complete Loop', () => {
    it('progresses through all steps and wraps complete loop preserving snapshot integrity', async () => {
      const mode = await createThreeStepMode('Full Loop Mode', true);

      // 1. Start Step 0 (Sprint 1)
      const start0 = await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerModeId: mode.id, stepIndex: 0 });
      expect(start0.status).toBe(201);
      expect(start0.body.stepIndex).toBe(0);
      expect(start0.body.stepName).toBe('Sprint 1');

      // Complete Step 0
      const comp0 = await request(app.getHttpServer())
        .post('/api/v1/timers/complete')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerSessionId: start0.body.id });
      expect(comp0.status).toBe(200);
      expect(comp0.body.nextStepPreview.stepIndex).toBe(1);

      // 2. Start Step 1 (Rest 1)
      const start1 = await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerModeId: mode.id, stepIndex: 1 });
      expect(start1.status).toBe(201);
      expect(start1.body.stepIndex).toBe(1);
      expect(start1.body.stepName).toBe('Rest 1');

      // Complete Step 1
      const comp1 = await request(app.getHttpServer())
        .post('/api/v1/timers/complete')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerSessionId: start1.body.id });
      expect(comp1.status).toBe(200);
      expect(comp1.body.nextStepPreview.stepIndex).toBe(2);

      // 3. Start Step 2 (Sprint 2 - Last step)
      const start2 = await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerModeId: mode.id, stepIndex: 2 });
      expect(start2.status).toBe(201);
      expect(start2.body.stepIndex).toBe(2);
      expect(start2.body.stepName).toBe('Sprint 2');

      // Complete Step 2 -> Looping is ON, wraps to Step 0 (Sprint 1)
      const comp2 = await request(app.getHttpServer())
        .post('/api/v1/timers/complete')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerSessionId: start2.body.id });
      expect(comp2.status).toBe(200);
      expect(comp2.body.isSequenceFinished).toBe(false);
      expect(comp2.body.nextStepPreview.stepIndex).toBe(0);
      expect(comp2.body.nextStepPreview.stepName).toBe('Sprint 1');

      // Total study sessions created across loop: Step 0 (FOCUS) + Step 2 (FOCUS) = 2
      const studyCount = await prisma.studySession.count({ where: { userId } });
      expect(studyCount).toBe(2);
    });
  });

  // =========================================================================
  // 8. LOCKING AND CONCURRENCY AUDIT
  // =========================================================================
  describe('8. Locking and Transaction Integrity', () => {
    it('concurrent start requests: row lock guarantees exactly one succeeds with 201 and one receives 409 Conflict', async () => {
      const mode = await createThreeStepMode('Concurrent Start Mode');

      // Fire 2 genuinely overlapping concurrent start requests
      const [res1, res2] = await Promise.all([
        request(app.getHttpServer())
          .post('/api/v1/timers/start')
          .set('Authorization', `Bearer ${token}`)
          .send({ timerModeId: mode.id, stepIndex: 0 }),
        request(app.getHttpServer())
          .post('/api/v1/timers/start')
          .set('Authorization', `Bearer ${token}`)
          .send({ timerModeId: mode.id, stepIndex: 0 }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([201, 409]);

      // Exactly 1 active timer exists in database
      const activeCount = await prisma.timerSession.count({
        where: { userId, status: { in: [TimerStatus.RUNNING, TimerStatus.PAUSED] } },
      });
      expect(activeCount).toBe(1);
    });

    it('concurrent duplicate completion requests: row lock serializes cleanly without duplicate study credit', async () => {
      const mode = await createThreeStepMode('Concurrent Complete Mode');

      const start = await request(app.getHttpServer())
        .post('/api/v1/timers/start')
        .set('Authorization', `Bearer ${token}`)
        .send({ timerModeId: mode.id, stepIndex: 0 });
      const sessionId = start.body.id;

      // Fire 2 genuinely overlapping concurrent completion requests
      const [comp1, comp2] = await Promise.all([
        request(app.getHttpServer())
          .post('/api/v1/timers/complete')
          .set('Authorization', `Bearer ${token}`)
          .send({ timerSessionId: sessionId, title: 'Concurrency Finish' }),
        request(app.getHttpServer())
          .post('/api/v1/timers/complete')
          .set('Authorization', `Bearer ${token}`)
          .send({ timerSessionId: sessionId, title: 'Concurrency Finish' }),
      ]);

      expect(comp1.status).toBe(200);
      expect(comp2.status).toBe(200);

      const replays = [comp1.body.idempotentReplay, comp2.body.idempotentReplay];
      expect(replays).toContain(false);
      expect(replays).toContain(true);

      // Exactly 1 credited StudySession in DB
      const studySessions = await prisma.studySession.findMany({ where: { userId } });
      expect(studySessions.length).toBe(1);
    });
  });
});
