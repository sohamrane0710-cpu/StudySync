import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import cookieParser from 'cookie-parser';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { describe, beforeAll, afterAll, it, expect } from 'vitest';
import { AuthService } from '../src/auth/auth.service.js';

describe('UserController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authService: AuthService;
  let sessionCookie: string;
  let onboardedSessionCookie: string;
  let unauthSessionCookie: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    authService = app.get(AuthService);

    // Clean up
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ['onboard1@example.com', 'onboard2@example.com', 'taken@example.com'],
        },
      },
    });

    // Create a taken user
    await authService.register({ email: 'taken@example.com', password: 'password123' });
    const takenRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'taken@example.com', password: 'password123' });
    const takenCookie = takenRes.headers['set-cookie'][0].split(';')[0];
    await request(app.getHttpServer())
      .post('/users/onboarding')
      .set('Cookie', takenCookie)
      .send({ username: 'taken_user' });

    // Create users for onboarding tests
    await authService.register({ email: 'onboard1@example.com', password: 'password123' });
    await authService.register({ email: 'onboard2@example.com', password: 'password123' });

    const loginRes1 = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'onboard1@example.com', password: 'password123' });
    sessionCookie = loginRes1.headers['set-cookie'][0].split(';')[0];

    const loginRes2 = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'onboard2@example.com', password: 'password123' });
    onboardedSessionCookie = loginRes2.headers['set-cookie'][0].split(';')[0];
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ['onboard1@example.com', 'onboard2@example.com', 'taken@example.com'],
        },
      },
    });
    await app.close();
  });

  describe('GET /users/check-username', () => {
    it('should return available for a valid new username', async () => {
      const res = await request(app.getHttpServer())
        .get('/users/check-username?username=new_valid_user')
        .expect(200);

      expect(res.body.available).toBe(true);
    });

    it('should return not available for a taken username', async () => {
      const res = await request(app.getHttpServer())
        .get('/users/check-username?username=taken_user')
        .expect(200);

      expect(res.body.available).toBe(false);
    });

    it('should return not available for a case-insensitive conflict', async () => {
      const res = await request(app.getHttpServer())
        .get('/users/check-username?username=TAKEN_user')
        .expect(200);

      expect(res.body.available).toBe(false);
    });

    it('should throw 400 for invalid username length (too short)', async () => {
      await request(app.getHttpServer())
        .get('/users/check-username?username=ab')
        .expect(400);
    });

    it('should throw 400 for invalid username length (too long)', async () => {
      await request(app.getHttpServer())
        .get('/users/check-username?username=this_is_way_too_long_for_a_username')
        .expect(400);
    });

    it('should throw 400 for invalid characters', async () => {
      await request(app.getHttpServer())
        .get('/users/check-username?username=invalid name!')
        .expect(400);
    });
  });

  describe('POST /users/onboarding', () => {
    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .post('/users/onboarding')
        .send({ username: 'good_user' })
        .expect(401);
    });

    it('should fail with an invalid username format', async () => {
      await request(app.getHttpServer())
        .post('/users/onboarding')
        .set('Cookie', sessionCookie)
        .send({ username: 'bad user!' })
        .expect(400);
    });

    it('should fail with an already taken username', async () => {
      await request(app.getHttpServer())
        .post('/users/onboarding')
        .set('Cookie', sessionCookie)
        .send({ username: 'taken_user' })
        .expect(409);
    });

    it('should succeed with a valid available username', async () => {
      const res = await request(app.getHttpServer())
        .post('/users/onboarding')
        .set('Cookie', sessionCookie)
        .send({ username: 'success_user' })
        .expect(201);

      expect(res.body.username).toBe('success_user');
      expect(res.body.onboardingCompleted).toBe(true);
    });

    it('should fail if trying to onboard again', async () => {
      await request(app.getHttpServer())
        .post('/users/onboarding')
        .set('Cookie', sessionCookie)
        .send({ username: 'another_user' })
        .expect(409);
    });
  });
});
