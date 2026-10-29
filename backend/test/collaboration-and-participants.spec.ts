import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { cleanDatabase, createDevToken, createTestApp } from './test-helper';
import { PrismaService } from '../src/database/prisma.service';

describe('6. Shared Room Timer & Independent Participant Tracking', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const ownerId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const lateParticipantId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

  let ownerToken: string;
  let lateToken: string;
  let roomId: string;

  beforeAll(async () => {
    const testSetup = await createTestApp();
    app = testSetup.app;
    prisma = testSetup.prisma;
    ownerToken = createDevToken(ownerId, 'collab_owner@example.com', 'collab_owner');
    lateToken = createDevToken(lateParticipantId, 'late_user@example.com', 'late_user');

    // Create room
    const roomRes = await request(app.getHttpServer())
      .post('/api/v1/rooms')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Collaborative Sprint Room' });
    roomId = roomRes.body.id;

    // Join late participant to room
    await request(app.getHttpServer())
      .post(`/api/v1/rooms/${roomId}/join`)
      .set('Authorization', `Bearer ${lateToken}`);
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  it('starts room timer and registers owner as initial participant', async () => {
    const startRes = await request(app.getHttpServer())
      .post(`/api/v1/rooms/${roomId}/timer/start`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        phase: 'FOCUS',
        durationOverride: 1800,
      });

    expect(startRes.status).toBe(201);
    expect(startRes.body.status).toBe('RUNNING');
    expect(startRes.body.targetDuration).toBe(1800);

    // Verify participant tracking
    const roomTimer = await request(app.getHttpServer())
      .get(`/api/v1/rooms/${roomId}/timer`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(roomTimer.status).toBe(200);
    expect(roomTimer.body.activeParticipantCount).toBe(1);
    expect(roomTimer.body.participants[0].userId).toBe(ownerId);
  });

  it('allows second participant to join shared session in progress', async () => {
    const joinRes = await request(app.getHttpServer())
      .post(`/api/v1/rooms/${roomId}/timer/join`)
      .set('Authorization', `Bearer ${lateToken}`);

    expect(joinRes.status).toBe(200);
    expect(joinRes.body.userId).toBe(lateParticipantId);
    expect(joinRes.body.leftAt).toBeNull();

    const roomTimer = await request(app.getHttpServer())
      .get(`/api/v1/rooms/${roomId}/timer`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(roomTimer.body.activeParticipantCount).toBe(2);
  });

  it('tracks early leave and credits participant independently', async () => {
    // Late participant leaves early
    const leaveRes = await request(app.getHttpServer())
      .post(`/api/v1/rooms/${roomId}/timer/leave`)
      .set('Authorization', `Bearer ${lateToken}`);

    expect(leaveRes.status).toBe(200);
    expect(leaveRes.body.leftAt).toBeDefined();

    // Verify room now has 1 active participant remaining
    const roomTimer = await request(app.getHttpServer())
      .get(`/api/v1/rooms/${roomId}/timer`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(roomTimer.body.activeParticipantCount).toBe(1);
  });

  it('completes room timer and finalizes remaining participants', async () => {
    const completeRes = await request(app.getHttpServer())
      .post(`/api/v1/rooms/${roomId}/timer/complete`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(completeRes.status).toBe(200);
    expect(completeRes.body.roomSession.status).toBe('COMPLETED');

    // Verify room timer is now null / no active timer
    const roomTimer = await request(app.getHttpServer())
      .get(`/api/v1/rooms/${roomId}/timer`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(roomTimer.status).toBe(200);
    expect(Object.keys(roomTimer.body).length).toBe(0);
  });
});
