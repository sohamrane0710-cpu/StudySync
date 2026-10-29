import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { cleanDatabase, createDevToken, createTestApp } from './test-helper';
import { PrismaService } from '../src/database/prisma.service';

describe('1. Authentication and Identity Derivation', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const testSetup = await createTestApp();
    app = testSetup.app;
    prisma = testSetup.prisma;
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  it('rejects unauthenticated requests to protected endpoints with 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/users/me');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('rejects requests with malformed or forged tokens with 401', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', 'Bearer forged.invalid.token');
    expect(res.status).toBe(401);
  });

  it('derives identity from verified token subject and auto-provisions profile', async () => {
    const userId = '11111111-1111-4111-8111-111111111111';
    const token = createDevToken(userId, 'alice@example.com', 'alice_study');

    const res = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(userId);
    expect(res.body.username).toContain('alice');
    expect(res.body.preferences).toBeDefined();
    expect(res.body.preferences.theme).toBe('dark-glass');
  });
});
