import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import cookieParser from 'cookie-parser';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { describe, beforeAll, afterAll, it, expect } from 'vitest';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sessionCookie: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    
    // Clean up test users
    await prisma.user.deleteMany({
      where: { email: { in: ['test@example.com', 'test2@example.com'] } },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: ['test@example.com', 'test2@example.com'] } },
    });
    await app.close();
  });

  describe('/auth/register (POST)', () => {
    it('should register a new user successfully', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
        })
        .expect(201);

      expect(res.body.email).toBe('test@example.com');
      expect(res.body.username).toBeNull();
      expect(res.body.onboardingCompleted).toBe(false);
      expect(res.body.passwordHash).toBeUndefined();
    });

    it('should reject duplicate email', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
        })
        .expect(409);
    });

    it('should normalize email on register', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: ' TEST2@EXAMPLE.COM ',
          password: 'password123',
        })
        .expect(201);

      expect(res.body.email).toBe('test2@example.com');
    });
  });

  describe('/auth/login (POST)', () => {
    it('should fail with invalid password', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
        })
        .expect(401);
    });

    it('should fail with nonexistent email', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'doesnotexist@example.com',
          password: 'password123',
        })
        .expect(401);
    });

    it('should login successfully and set cookie', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        })
        .expect(200);

      expect(res.body.email).toBe('test@example.com');
      expect(res.body.passwordHash).toBeUndefined();

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain('studysync_session=');

      sessionCookie = cookies[0].split(';')[0];
    });
  });

  describe('/auth/me (GET)', () => {
    it('should fail without session cookie', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .expect(401);
    });

    it('should succeed with valid session cookie', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', sessionCookie)
        .expect(200);

      expect(res.body.email).toBe('test@example.com');
      expect(res.body.passwordHash).toBeUndefined();
    });
  });

  describe('/auth/logout (POST)', () => {
    it('should logout and clear cookie', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', sessionCookie)
        .expect(200);

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain('studysync_session=;'); // Cleared cookie

      // Verify session is invalidated
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', sessionCookie)
        .expect(401);
    });

    it('should safely handle repeated logout', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .expect(200);
    });
  });
});
