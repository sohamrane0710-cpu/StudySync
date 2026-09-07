import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import cookieParser from 'cookie-parser';

describe('TimerController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cookie1: string;
  let userId1: string;
  let cookie2: string;
  let userId2: string;

  let timerModeId1: string;
  let timerSessionId1: string;

  let focusCatId1: string;
  let restCatId1: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);

    // Clean up from previous runs safely
    const existingUsers = await prisma.user.findMany({
      where: { email: { in: ['user1_timer@example.com', 'user2_timer@example.com'] } }
    });
    const userIdsToClean = existingUsers.map(u => u.id);
    if (userIdsToClean.length > 0) {
      await prisma.studySession.deleteMany({ where: { userId: { in: userIdsToClean } } });
      await prisma.timerSession.deleteMany({ where: { userId: { in: userIdsToClean } } });
      await prisma.timerMode.deleteMany({ where: { userId: { in: userIdsToClean } } });
      await prisma.user.deleteMany({ where: { id: { in: userIdsToClean } } });
    }

    // Create user 1
    const user1Register = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'user1_timer@example.com', username: 'user1_timer', password: 'password123' });
    const user1Login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: 'user1_timer@example.com', password: 'password123' });
    cookie1 = user1Login.headers['set-cookie'][0];
    userId1 = user1Register.body.id;

    // Create user 2
    const user2Register = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'user2_timer@example.com', username: 'user2_timer', password: 'password123' });
    const user2Login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: 'user2_timer@example.com', password: 'password123' });
    cookie2 = user2Login.headers['set-cookie'][0];
    userId2 = user2Register.body.id;

    // Get categories for User 1
    const categoriesResponse = await request(app.getHttpServer())
      .get('/timer-categories')
      .set('Cookie', cookie1);
    
    focusCatId1 = categoriesResponse.body.find((c: any) => c.name === 'Focus').id;
    restCatId1 = categoriesResponse.body.find((c: any) => c.name === 'Rest').id;
  });

  afterAll(async () => {
    const userIdsToClean = [userId1, userId2].filter(Boolean);
    if (userIdsToClean.length > 0) {
      await prisma.studySession.deleteMany({ where: { userId: { in: userIdsToClean } } });
      await prisma.timerSession.deleteMany({ where: { userId: { in: userIdsToClean } } });
      await prisma.timerMode.deleteMany({ where: { userId: { in: userIdsToClean } } });
      await prisma.user.deleteMany({ where: { id: { in: userIdsToClean } } });
    }
    await app.close();
  });

  describe('/timer-modes (POST)', () => {
    it('should reject unauthenticated request', () => {
      return request(app.getHttpServer())
        .post('/timer-modes')
        .send({ name: 'My Mode', loop: false, stagesConfig: [{ categoryId: focusCatId1, durationSeconds: 1500 }] })
        .expect(401);
    });

    it('should reject invalid stages config', () => {
      return request(app.getHttpServer())
        .post('/timer-modes')
        .set('Cookie', cookie1)
        .send({ name: 'My Mode', loop: false, stagesConfig: [] })
        .expect(400);
    });

    it('should create a timer mode', async () => {
      const response = await request(app.getHttpServer())
        .post('/timer-modes')
        .set('Cookie', cookie1)
        .send({
          name: 'Classic Pomodoro',
          loop: true,
          stagesConfig: [
            { categoryId: focusCatId1, durationSeconds: 1500 },
            { categoryId: restCatId1, durationSeconds: 300 }
          ]
        });

      expect(response.status).toBe(201);

      expect(response.body.id).toBeDefined();
      expect(response.body.userId).toBe(userId1);
      expect(response.body.name).toBe('Classic Pomodoro');
      timerModeId1 = response.body.id;
    });
  });

  describe('/timer-modes (GET)', () => {
    it('should return modes for user 1', async () => {
      const response = await request(app.getHttpServer())
        .get('/timer-modes')
        .set('Cookie', cookie1)
        .expect(200);
      
      expect(response.body.length).toBe(1);
      expect(response.body[0].id).toBe(timerModeId1);
    });

    it('should return empty for user 2', async () => {
      const response = await request(app.getHttpServer())
        .get('/timer-modes')
        .set('Cookie', cookie2)
        .expect(200);
      
      expect(response.body.length).toBe(0);
    });
  });

  describe('/timer-modes/:id (GET)', () => {
    it('should allow owner to get their mode', () => {
      return request(app.getHttpServer())
        .get(`/timer-modes/${timerModeId1}`)
        .set('Cookie', cookie1)
        .expect(200);
    });

    it('should prevent other users from getting the mode', () => {
      return request(app.getHttpServer())
        .get(`/timer-modes/${timerModeId1}`)
        .set('Cookie', cookie2)
        .expect(403);
    });
  });

  describe('/timer-modes/:id (PATCH)', () => {
    let activeTimerSessionId: string;

    beforeAll(async () => {
      const response = await request(app.getHttpServer())
        .post('/timer-sessions')
        .set('Cookie', cookie1)
        .send({ timerModeId: timerModeId1 });
      activeTimerSessionId = response.body.id;
    });

    it('should prevent other users from editing', () => {
      return request(app.getHttpServer())
        .patch(`/timer-modes/${timerModeId1}`)
        .set('Cookie', cookie2)
        .send({ name: 'Hacked Name' })
        .expect(403);
    });

    it('should return 409 Conflict if mode is in use by active session', async () => {
      await request(app.getHttpServer())
        .patch(`/timer-modes/${timerModeId1}`)
        .set('Cookie', cookie1)
        .send({ name: 'Updated Name' })
        .expect(409);
    });

    it('should allow editing if no active sessions exist', async () => {
      // Start then complete the active session
      await request(app.getHttpServer())
        .post(`/timer-sessions/${activeTimerSessionId}/start`)
        .set('Cookie', cookie1)
        .expect(201);
        
      await request(app.getHttpServer())
        .post(`/timer-sessions/${activeTimerSessionId}/complete`)
        .set('Cookie', cookie1)
        .expect(201);

      // Now edit should succeed
      const response = await request(app.getHttpServer())
        .patch(`/timer-modes/${timerModeId1}`)
        .set('Cookie', cookie1)
        .send({ name: 'Updated Pomodoro' })
        .expect(200);

      expect(response.body.name).toBe('Updated Pomodoro');
    });
  });

  describe('/timer-modes/:id (DELETE)', () => {
    it('should prevent other users from deleting', () => {
      return request(app.getHttpServer())
        .delete(`/timer-modes/${timerModeId1}`)
        .set('Cookie', cookie2)
        .expect(403);
    });

    it('should return 409 Conflict if mode has historical sessions', async () => {
      // timerModeId1 has a completed session from the PATCH test
      await request(app.getHttpServer())
        .delete(`/timer-modes/${timerModeId1}`)
        .set('Cookie', cookie1)
        .expect(409);
    });

    it('should allow deleting if no sessions exist', async () => {
      // Create a fresh mode
      const createResponse = await request(app.getHttpServer())
        .post('/timer-modes')
        .set('Cookie', cookie1)
        .send({
          name: 'To Be Deleted',
          loop: false,
          stagesConfig: [{ categoryId: focusCatId1, durationSeconds: 60 }]
        });
      
      const newModeId = createResponse.body.id;

      // Delete it
      await request(app.getHttpServer())
        .delete(`/timer-modes/${newModeId}`)
        .set('Cookie', cookie1)
        .expect(200);

      // Verify it is gone
      await request(app.getHttpServer())
        .get(`/timer-modes/${newModeId}`)
        .set('Cookie', cookie1)
        .expect(404);
    });
  });

  describe('/timer-sessions (POST)', () => {
    it('should prevent creating session for another users mode', () => {
      return request(app.getHttpServer())
        .post('/timer-sessions')
        .set('Cookie', cookie2)
        .send({ timerModeId: timerModeId1 })
        .expect(403);
    });

    it('should create a personal timer session', async () => {
      const response = await request(app.getHttpServer())
        .post('/timer-sessions')
        .set('Cookie', cookie1)
        .send({ timerModeId: timerModeId1 });
      
      expect(response.status).toBe(201);

      expect(response.body.id).toBeDefined();
      expect(response.body.userId).toBe(userId1);
      expect(response.body.roomId).toBeNull();
      expect(response.body.status).toBe('PENDING');
      expect(response.body.currentStageIndex).toBe(0);
      expect(response.body.startedAt).toBeNull();
      timerSessionId1 = response.body.id;
    });
  });

  describe('/timer-sessions/:id/start (POST)', () => {
    it('should prevent other users from starting', () => {
      return request(app.getHttpServer())
        .post(`/timer-sessions/${timerSessionId1}/start`)
        .set('Cookie', cookie2)
        .expect(403);
    });

    it('should start the timer session', async () => {
      const response = await request(app.getHttpServer())
        .post(`/timer-sessions/${timerSessionId1}/start`)
        .set('Cookie', cookie1)
        .expect(201); // Nest POST default is 201

      expect(response.body.status).toBe('RUNNING');
      expect(response.body.startedAt).not.toBeNull();
      expect(response.body.targetEndTime).not.toBeNull();
    });

    it('should reject starting an already running timer', () => {
      return request(app.getHttpServer())
        .post(`/timer-sessions/${timerSessionId1}/start`)
        .set('Cookie', cookie1)
        .expect(409);
    });
  });

  describe('/timer-sessions/:id/pause (POST)', () => {
    it('should prevent other users from pausing', () => {
      return request(app.getHttpServer())
        .post(`/timer-sessions/${timerSessionId1}/pause`)
        .set('Cookie', cookie2)
        .expect(403);
    });

    it('should pause the timer session', async () => {
      const response = await request(app.getHttpServer())
        .post(`/timer-sessions/${timerSessionId1}/pause`)
        .set('Cookie', cookie1)
        .expect(201);

      expect(response.body.status).toBe('PAUSED');
      expect(response.body.pausedAt).not.toBeNull();
    });

    it('should reject pausing an already paused timer', () => {
      return request(app.getHttpServer())
        .post(`/timer-sessions/${timerSessionId1}/pause`)
        .set('Cookie', cookie1)
        .expect(409);
    });
  });

  describe('Resume timer (POST /start)', () => {
    it('should resume a paused timer', async () => {
      const response = await request(app.getHttpServer())
        .post(`/timer-sessions/${timerSessionId1}/start`)
        .set('Cookie', cookie1)
        .expect(201);

      expect(response.body.status).toBe('RUNNING');
      expect(response.body.pausedAt).toBeNull();
      expect(response.body.startedAt).not.toBeNull(); // Should retain original startedAt
    });
  });

  describe('/timer-sessions/:id/complete (POST)', () => {
    it('should prevent other users from completing', () => {
      return request(app.getHttpServer())
        .post(`/timer-sessions/${timerSessionId1}/complete`)
        .set('Cookie', cookie2)
        .expect(403);
    });

    it('should complete the timer and create StudySession', async () => {
      const response = await request(app.getHttpServer())
        .post(`/timer-sessions/${timerSessionId1}/complete`)
        .set('Cookie', cookie1)
        .expect(201);

      expect(response.body.status).toBe('COMPLETED');
      expect(response.body.completedAt).not.toBeNull();

      // Verify study session was created
      const studySessions = await prisma.studySession.findMany({
        where: { timerSessionId: timerSessionId1 },
      });

      expect(studySessions.length).toBe(1);
      expect(studySessions[0].userId).toBe(userId1);
      expect(studySessions[0].durationSeconds).toBeGreaterThanOrEqual(0); // Should be 0 since it completed instantly
    });

    it('should be idempotent on repeated completes', () => {
      return request(app.getHttpServer())
        .post(`/timer-sessions/${timerSessionId1}/complete`)
        .set('Cookie', cookie1)
        .expect(201); // Returns existing completed session without error
    });
  });

  describe('/timer-sessions/active (GET)', () => {
    let activeSessionId: string;
    let completedSessionId: string;

    beforeAll(async () => {
      // Create a completed session
      const createResponse1 = await request(app.getHttpServer())
        .post('/timer-sessions')
        .set('Cookie', cookie1)
        .send({ timerModeId: timerModeId1 });
      completedSessionId = createResponse1.body.id;
      
      await request(app.getHttpServer())
        .post(`/timer-sessions/${completedSessionId}/start`)
        .set('Cookie', cookie1);
        
      await request(app.getHttpServer())
        .post(`/timer-sessions/${completedSessionId}/complete`)
        .set('Cookie', cookie1);

      // Create an active (running) session
      const createResponse2 = await request(app.getHttpServer())
        .post('/timer-sessions')
        .set('Cookie', cookie1)
        .send({ timerModeId: timerModeId1 });
      activeSessionId = createResponse2.body.id;

      await request(app.getHttpServer())
        .post(`/timer-sessions/${activeSessionId}/start`)
        .set('Cookie', cookie1);
    });

    it('should return the active timer session for user 1', async () => {
      const response = await request(app.getHttpServer())
        .get('/timer-sessions/active')
        .set('Cookie', cookie1)
        .expect(200);

      expect(response.body.id).toBe(activeSessionId);
      expect(response.body.status).toBe('RUNNING');
      expect(response.body.timerMode).toBeDefined();
      expect(response.body.timerMode.id).toBe(timerModeId1);
    });

    it('should not return completed sessions', async () => {
      const response = await request(app.getHttpServer())
        .get('/timer-sessions/active')
        .set('Cookie', cookie1)
        .expect(200);

      expect(response.body.id).not.toBe(completedSessionId);
    });

    it('should return 404 for user 2 with no active session', () => {
      return request(app.getHttpServer())
        .get('/timer-sessions/active')
        .set('Cookie', cookie2)
        .expect(404);
    });
    
    afterAll(async () => {
       await request(app.getHttpServer())
        .post(`/timer-sessions/${activeSessionId}/complete`)
        .set('Cookie', cookie1);
    });
  });

  describe('Deterministic Timer Duration (Largest Remainder Method)', () => {
    let testTimerModeId: string;
    let sessionId: string;
    let customCatId1: string;

    beforeAll(async () => {
      // Create a third category for testing
      const createCatResponse = await request(app.getHttpServer())
        .post('/timer-categories')
        .set('Cookie', cookie1)
        .send({ name: 'Custom' });
      customCatId1 = createCatResponse.body.id;
    });

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(async () => {
      vi.useRealTimers();
    });

    it('Test A — Rounding drift', async () => {
      // Create mode with 2 categories
      const modeResponse = await request(app.getHttpServer())
        .post('/timer-modes')
        .set('Cookie', cookie1)
        .send({
          name: 'Test A Mode',
          loop: false,
          stagesConfig: [
            { categoryId: focusCatId1, durationSeconds: 1 },
            { categoryId: restCatId1, durationSeconds: 1 }
          ]
        });
      testTimerModeId = modeResponse.body.id;

      // Manually inject fractional durationSeconds bypassing DTO validation
      await prisma.timerMode.update({
        where: { id: testTimerModeId },
        data: {
          stagesConfig: [
            { categoryId: focusCatId1, durationSeconds: 1.5 },
            { categoryId: restCatId1, durationSeconds: 1.5 }
          ]
        }
      });

      const createResponse = await request(app.getHttpServer())
        .post('/timer-sessions')
        .set('Cookie', cookie1)
        .send({ timerModeId: testTimerModeId });
      sessionId = createResponse.body.id;

      // Start
      vi.setSystemTime(new Date('2026-09-07T10:00:00.000Z'));
      await request(app.getHttpServer()).post(`/timer-sessions/${sessionId}/start`).set('Cookie', cookie1).expect(201);

      // Advance by 1500ms (1.5s)
      vi.setSystemTime(new Date('2026-09-07T10:00:01.500Z'));
      
      // Next stage
      await request(app.getHttpServer()).post(`/timer-sessions/${sessionId}/next-stage`).set('Cookie', cookie1).expect(201);

      // Advance by 1500ms (1.5s)
      vi.setSystemTime(new Date('2026-09-07T10:00:03.000Z'));
      
      // Complete
      await request(app.getHttpServer()).post(`/timer-sessions/${sessionId}/complete`).set('Cookie', cookie1).expect(201);

      const studySessions = await prisma.studySession.findMany({
        where: { timerSessionId: sessionId },
        include: { studySessionCategories: true }
      });

      expect(studySessions.length).toBe(1);
      const session = studySessions[0];
      expect(session.durationSeconds).toBe(3);

      const sumCategoryDurations = session.studySessionCategories.reduce((acc, cat) => acc + cat.durationSeconds, 0);
      expect(sumCategoryDurations).toBe(3); // Prove invariant holds!
    });

    it('Test B — Multiple categories', async () => {
      // Create mode with 3 categories
      const modeResponse = await request(app.getHttpServer())
        .post('/timer-modes')
        .set('Cookie', cookie1)
        .send({
          name: 'Test B Mode',
          loop: false,
          stagesConfig: [
            { categoryId: focusCatId1, durationSeconds: 1 },
            { categoryId: restCatId1, durationSeconds: 1 },
            { categoryId: customCatId1, durationSeconds: 1 }
          ]
        });
      testTimerModeId = modeResponse.body.id;

      await prisma.timerMode.update({
        where: { id: testTimerModeId },
        data: {
          stagesConfig: [
            { categoryId: focusCatId1, durationSeconds: 1.4 },
            { categoryId: restCatId1, durationSeconds: 1.4 },
            { categoryId: customCatId1, durationSeconds: 1.4 }
          ]
        }
      });

      const createResponse = await request(app.getHttpServer())
        .post('/timer-sessions')
        .set('Cookie', cookie1)
        .send({ timerModeId: testTimerModeId });
      sessionId = createResponse.body.id;

      // Start
      vi.setSystemTime(new Date('2026-09-07T10:00:00.000Z'));
      await request(app.getHttpServer()).post(`/timer-sessions/${sessionId}/start`).set('Cookie', cookie1).expect(201);

      // Focus -> 1400ms
      vi.setSystemTime(new Date('2026-09-07T10:00:01.400Z'));
      await request(app.getHttpServer()).post(`/timer-sessions/${sessionId}/next-stage`).set('Cookie', cookie1).expect(201);

      // Rest -> 1400ms
      vi.setSystemTime(new Date('2026-09-07T10:00:02.800Z'));
      await request(app.getHttpServer()).post(`/timer-sessions/${sessionId}/next-stage`).set('Cookie', cookie1).expect(201);

      // Custom -> 1400ms
      vi.setSystemTime(new Date('2026-09-07T10:00:04.200Z'));
      await request(app.getHttpServer()).post(`/timer-sessions/${sessionId}/complete`).set('Cookie', cookie1).expect(201);

      const studySessions = await prisma.studySession.findMany({
        where: { timerSessionId: sessionId },
        include: { studySessionCategories: true }
      });

      expect(studySessions.length).toBe(1);
      const session = studySessions[0];
      // Total elapsed = 4200ms -> 4 seconds
      expect(session.durationSeconds).toBe(4);

      const sumCategoryDurations = session.studySessionCategories.reduce((acc, cat) => acc + cat.durationSeconds, 0);
      expect(sumCategoryDurations).toBe(4); // Prove invariant holds!
    });

    it('Test C — Existing real timer lifecycle', async () => {
      // Realistic multi-stage timer
      const modeResponse = await request(app.getHttpServer())
        .post('/timer-modes')
        .set('Cookie', cookie1)
        .send({
          name: 'Test C Mode',
          loop: true,
          stagesConfig: [
            { categoryId: focusCatId1, durationSeconds: 60 },
            { categoryId: restCatId1, durationSeconds: 30 }
          ]
        });
      testTimerModeId = modeResponse.body.id;

      const createResponse = await request(app.getHttpServer())
        .post('/timer-sessions')
        .set('Cookie', cookie1)
        .send({ timerModeId: testTimerModeId });
      sessionId = createResponse.body.id;

      // 1. Start at 10:00:00
      vi.setSystemTime(new Date('2026-09-07T10:00:00.000Z'));
      await request(app.getHttpServer()).post(`/timer-sessions/${sessionId}/start`).set('Cookie', cookie1).expect(201);

      // 2. Complete Focus stage at 10:01:00 (exact)
      vi.setSystemTime(new Date('2026-09-07T10:01:00.000Z'));
      await request(app.getHttpServer()).post(`/timer-sessions/${sessionId}/next-stage`).set('Cookie', cookie1).expect(201);

      // 3. Complete Rest stage at 10:01:30 (exact)
      vi.setSystemTime(new Date('2026-09-07T10:01:30.000Z'));
      await request(app.getHttpServer()).post(`/timer-sessions/${sessionId}/next-stage`).set('Cookie', cookie1).expect(201);

      // 4. Wrap around to Focus stage, complete partially at 10:02:15.500 (75.5 seconds)
      vi.setSystemTime(new Date('2026-09-07T10:02:15.500Z'));
      await request(app.getHttpServer()).post(`/timer-sessions/${sessionId}/complete`).set('Cookie', cookie1).expect(201);

      const studySessions = await prisma.studySession.findMany({
        where: { timerSessionId: sessionId },
        include: { studySessionCategories: true }
      });

      expect(studySessions.length).toBe(1);
      const session = studySessions[0];
      // total = 60s + 30s + 45.5s = 135.5s -> Math.round = 136s
      expect(session.durationSeconds).toBe(136);

      const focusDuration = session.studySessionCategories.find(c => c.categoryId === focusCatId1)?.durationSeconds;
      const restDuration = session.studySessionCategories.find(c => c.categoryId === restCatId1)?.durationSeconds;

      // Focus = 60s + 45.5s = 105.5s
      // Rest = 30s
      // Total floored = 105 (Focus) + 30 (Rest) = 135.
      // Remaining = 136 - 135 = 1.
      // Focus remainder = 0.5, Rest remainder = 0. Focus gets +1.
      // Final: Focus = 106, Rest = 30.
      expect(focusDuration).toBe(106);
      expect(restDuration).toBe(30);

      const sumCategoryDurations = session.studySessionCategories.reduce((acc, cat) => acc + cat.durationSeconds, 0);
      expect(sumCategoryDurations).toBe(136); // Invariant holds
    });

    it('Test D — Paused lifecycle', async () => {
      const modeResponse = await request(app.getHttpServer())
        .post('/timer-modes')
        .set('Cookie', cookie1)
        .send({
          name: 'Test D Mode',
          loop: false,
          stagesConfig: [
            { categoryId: focusCatId1, durationSeconds: 60 }
          ]
        });
      testTimerModeId = modeResponse.body.id;

      const createResponse = await request(app.getHttpServer())
        .post('/timer-sessions')
        .set('Cookie', cookie1)
        .send({ timerModeId: testTimerModeId });
      sessionId = createResponse.body.id;

      // Start at 10:00:00
      vi.setSystemTime(new Date('2026-09-07T10:00:00.000Z'));
      await request(app.getHttpServer()).post(`/timer-sessions/${sessionId}/start`).set('Cookie', cookie1).expect(201);

      // Run for 15.3 seconds -> pause at 10:00:15.300
      vi.setSystemTime(new Date('2026-09-07T10:00:15.300Z'));
      await request(app.getHttpServer()).post(`/timer-sessions/${sessionId}/pause`).set('Cookie', cookie1).expect(201);

      // Pause for 1 hour -> resume at 11:00:15.300
      vi.setSystemTime(new Date('2026-09-07T11:00:15.300Z'));
      await request(app.getHttpServer()).post(`/timer-sessions/${sessionId}/start`).set('Cookie', cookie1).expect(201);

      // Run for 15.3 seconds -> complete at 11:00:30.600
      vi.setSystemTime(new Date('2026-09-07T11:00:30.600Z'));
      await request(app.getHttpServer()).post(`/timer-sessions/${sessionId}/complete`).set('Cookie', cookie1).expect(201);

      const studySessions = await prisma.studySession.findMany({
        where: { timerSessionId: sessionId },
        include: { studySessionCategories: true }
      });

      expect(studySessions.length).toBe(1);
      const session = studySessions[0];
      // Total active time = 15.3s + 15.3s = 30.6s -> Math.round = 31s
      expect(session.durationSeconds).toBe(31);

      const sumCategoryDurations = session.studySessionCategories.reduce((acc, cat) => acc + cat.durationSeconds, 0);
      expect(sumCategoryDurations).toBe(31); // Paused time excluded, invariant holds
    });
  });
});
