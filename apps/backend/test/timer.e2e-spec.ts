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
        .send({ name: 'My Mode', loop: false, stagesConfig: [{ type: 'FOCUS', durationSeconds: 1500 }] })
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
            { type: 'FOCUS', durationSeconds: 1500 },
            { type: 'SHORT_BREAK', durationSeconds: 300 }
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

  describe('Deterministic Timer Duration (Fake Timers)', () => {
    let testTimerModeId: string;
    let testTimerSessionId: string;

    beforeAll(async () => {
      const modeResponse = await request(app.getHttpServer())
        .post('/timer-modes')
        .set('Cookie', cookie1)
        .send({
          name: 'Fake Timer Mode',
          loop: false,
          stagesConfig: [{ type: 'FOCUS', durationSeconds: 1500 }]
        });
      testTimerModeId = modeResponse.body.id;
    });

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('Test A — one pause', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/timer-sessions')
        .set('Cookie', cookie1)
        .send({ timerModeId: testTimerModeId });
      testTimerSessionId = createResponse.body.id;

      // 10:00 start
      vi.setSystemTime(new Date('2026-09-07T10:00:00Z'));
      await request(app.getHttpServer()).post(`/timer-sessions/${testTimerSessionId}/start`).set('Cookie', cookie1).expect(201);

      // 10:10 pause
      vi.setSystemTime(new Date('2026-09-07T10:10:00Z'));
      await request(app.getHttpServer()).post(`/timer-sessions/${testTimerSessionId}/pause`).set('Cookie', cookie1).expect(201);

      // 10:30 resume
      vi.setSystemTime(new Date('2026-09-07T10:30:00Z'));
      await request(app.getHttpServer()).post(`/timer-sessions/${testTimerSessionId}/start`).set('Cookie', cookie1).expect(201);

      // 10:40 complete
      vi.setSystemTime(new Date('2026-09-07T10:40:00Z'));
      await request(app.getHttpServer()).post(`/timer-sessions/${testTimerSessionId}/complete`).set('Cookie', cookie1).expect(201);

      const studySessions = await prisma.studySession.findMany({
        where: { timerSessionId: testTimerSessionId }
      });
      expect(studySessions.length).toBe(1);
      expect(studySessions[0].durationSeconds).toBe(1200); // 20 minutes
    });

    it('Test B — multiple pauses', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/timer-sessions')
        .set('Cookie', cookie1)
        .send({ timerModeId: testTimerModeId });
      const sessionId = createResponse.body.id;

      // 10:00 start
      vi.setSystemTime(new Date('2026-09-07T10:00:00Z'));
      await request(app.getHttpServer()).post(`/timer-sessions/${sessionId}/start`).set('Cookie', cookie1);

      // 10:05 pause
      vi.setSystemTime(new Date('2026-09-07T10:05:00Z'));
      await request(app.getHttpServer()).post(`/timer-sessions/${sessionId}/pause`).set('Cookie', cookie1);

      // 10:15 resume
      vi.setSystemTime(new Date('2026-09-07T10:15:00Z'));
      await request(app.getHttpServer()).post(`/timer-sessions/${sessionId}/start`).set('Cookie', cookie1);

      // 10:20 pause
      vi.setSystemTime(new Date('2026-09-07T10:20:00Z'));
      await request(app.getHttpServer()).post(`/timer-sessions/${sessionId}/pause`).set('Cookie', cookie1);

      // 10:40 resume
      vi.setSystemTime(new Date('2026-09-07T10:40:00Z'));
      await request(app.getHttpServer()).post(`/timer-sessions/${sessionId}/start`).set('Cookie', cookie1);

      // 10:50 complete
      vi.setSystemTime(new Date('2026-09-07T10:50:00Z'));
      await request(app.getHttpServer()).post(`/timer-sessions/${sessionId}/complete`).set('Cookie', cookie1);

      const studySessions = await prisma.studySession.findMany({
        where: { timerSessionId: sessionId }
      });
      expect(studySessions.length).toBe(1);
      expect(studySessions[0].durationSeconds).toBe(1200); // 5 + 5 + 10 = 20 minutes
    });
  });
});
