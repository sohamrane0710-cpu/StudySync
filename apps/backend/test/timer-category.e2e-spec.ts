import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import cookieParser from 'cookie-parser';

describe('TimerCategoryController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cookie1: string;
  let userId1: string;
  let cookie2: string;
  let userId2: string;

  let customCatId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);

    // Clean up from previous runs
    const existingUsers = await prisma.user.findMany({
      where: { email: { in: ['cat_user1@example.com', 'cat_user2@example.com'] } }
    });
    const userIdsToClean = existingUsers.map(u => u.id);
    if (userIdsToClean.length > 0) {
      await prisma.studySessionCategory.deleteMany({ where: { category: { userId: { in: userIdsToClean } } } });
      await prisma.studySession.deleteMany({ where: { userId: { in: userIdsToClean } } });
      await prisma.timerSession.deleteMany({ where: { userId: { in: userIdsToClean } } });
      await prisma.timerMode.deleteMany({ where: { userId: { in: userIdsToClean } } });
      await prisma.timerCategory.deleteMany({ where: { userId: { in: userIdsToClean } } });
      await prisma.user.deleteMany({ where: { id: { in: userIdsToClean } } });
    }

    // Register User 1
    const user1Register = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'cat_user1@example.com', username: 'cat_user1', password: 'password123' });
    const user1Login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: 'cat_user1@example.com', password: 'password123' });
    cookie1 = user1Login.headers['set-cookie'][0];
    userId1 = user1Register.body.id;

    // Register User 2
    const user2Register = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'cat_user2@example.com', username: 'cat_user2', password: 'password123' });
    const user2Login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: 'cat_user2@example.com', password: 'password123' });
    cookie2 = user2Login.headers['set-cookie'][0];
    userId2 = user2Register.body.id;
  });

  afterAll(async () => {
    const userIdsToClean = [userId1, userId2].filter(Boolean);
    if (userIdsToClean.length > 0) {
      await prisma.studySessionCategory.deleteMany({ where: { category: { userId: { in: userIdsToClean } } } });
      await prisma.studySession.deleteMany({ where: { userId: { in: userIdsToClean } } });
      await prisma.timerSession.deleteMany({ where: { userId: { in: userIdsToClean } } });
      await prisma.timerMode.deleteMany({ where: { userId: { in: userIdsToClean } } });
      await prisma.timerCategory.deleteMany({ where: { userId: { in: userIdsToClean } } });
      await prisma.user.deleteMany({ where: { id: { in: userIdsToClean } } });
    }
    await app.close();
  });

  describe('Default Categories', () => {
    it('User 1 should have Focus and Rest by default', async () => {
      const response = await request(app.getHttpServer())
        .get('/timer-categories')
        .set('Cookie', cookie1)
        .expect(200);
      
      expect(response.body.length).toBe(2);
      expect(response.body.map((c: any) => c.name).sort()).toEqual(['Focus', 'Rest']);
    });
  });

  describe('CRUD Operations', () => {
    it('should create a custom category', async () => {
      const response = await request(app.getHttpServer())
        .post('/timer-categories')
        .set('Cookie', cookie1)
        .send({ name: 'Revision' })
        .expect(201);
      
      expect(response.body.name).toBe('Revision');
      expect(response.body.userId).toBe(userId1);
      customCatId = response.body.id;
    });

    it('should prevent case-insensitive duplicates', () => {
      return request(app.getHttpServer())
        .post('/timer-categories')
        .set('Cookie', cookie1)
        .send({ name: 'reViSioN' })
        .expect(409);
    });

    it('should get the custom category by ID', async () => {
      const response = await request(app.getHttpServer())
        .get(`/timer-categories/${customCatId}`)
        .set('Cookie', cookie1)
        .expect(200);
      
      expect(response.body.name).toBe('Revision');
    });

    it('should prevent user 2 from accessing user 1s category', () => {
      return request(app.getHttpServer())
        .get(`/timer-categories/${customCatId}`)
        .set('Cookie', cookie2)
        .expect(404);
    });

    it('should update the category', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/timer-categories/${customCatId}`)
        .set('Cookie', cookie1)
        .send({ name: 'Exam Prep' })
        .expect(200);
      
      expect(response.body.name).toBe('Exam Prep');
    });

    it('should delete an unused category', async () => {
      await request(app.getHttpServer())
        .delete(`/timer-categories/${customCatId}`)
        .set('Cookie', cookie1)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/timer-categories/${customCatId}`)
        .set('Cookie', cookie1)
        .expect(404);
    });
  });

  describe('Deletion Protection (Modes & Historical Sessions)', () => {
    let focusCatId: string;
    let modeId: string;
    let sessionId: string;

    beforeAll(async () => {
      const cats = await request(app.getHttpServer()).get('/timer-categories').set('Cookie', cookie1);
      focusCatId = cats.body.find((c: any) => c.name === 'Focus').id;

      const modeRes = await request(app.getHttpServer())
        .post('/timer-modes')
        .set('Cookie', cookie1)
        .send({
          name: 'Focus Only',
          loop: false,
          stagesConfig: [{ categoryId: focusCatId, durationSeconds: 60 }]
        });
      modeId = modeRes.body.id;
    });

    it('should prevent deleting a category used in a TimerMode', () => {
      return request(app.getHttpServer())
        .delete(`/timer-categories/${focusCatId}`)
        .set('Cookie', cookie1)
        .expect(409);
    });

    it('should prevent deleting a category with historical study sessions (even if removed from mode)', async () => {
      // 1. Run and complete a timer session to create historical StudySessionCategory
      const sessionRes = await request(app.getHttpServer())
        .post('/timer-sessions')
        .set('Cookie', cookie1)
        .send({ timerModeId: modeId });
      sessionId = sessionRes.body.id;

      await request(app.getHttpServer()).post(`/timer-sessions/${sessionId}/start`).set('Cookie', cookie1);
      await request(app.getHttpServer()).post(`/timer-sessions/${sessionId}/complete`).set('Cookie', cookie1);

      // Verify StudySessionCategory was created
      const studySessions = await prisma.studySession.findMany({ where: { timerSessionId: sessionId } });
      const studySessionCats = await prisma.studySessionCategory.findMany({ where: { studySessionId: studySessions[0].id } });
      expect(studySessionCats.length).toBe(1);
      expect(studySessionCats[0].categoryId).toBe(focusCatId);

      // 2. Remove the category from the mode by deleting the mode
      await request(app.getHttpServer()).delete(`/timer-modes/${modeId}`).set('Cookie', cookie1);

      // 3. Try to delete the category
      // Even though it is no longer in ANY timer mode, it is locked by historical StudySessionCategory (Restrict FK)
      await request(app.getHttpServer())
        .delete(`/timer-categories/${focusCatId}`)
        .set('Cookie', cookie1)
        .expect(409);
    });
  });
});
