import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { cleanDatabase, createDevToken, createTestApp } from './test-helper';
import { PrismaService } from '../src/database/prisma.service';

describe('4. Rooms and Cryptographic Invitations', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const ownerId = '55555555-5555-4555-8555-555555555555';
  const member1Id = '66666666-6666-4666-8666-666666666666';
  const member2Id = '77777777-7777-4777-8777-777777777777';
  const outsiderId = '88888888-8888-4888-8888-888888888888';

  let ownerToken: string;
  let member1Token: string;
  let member2Token: string;
  let outsiderToken: string;

  beforeAll(async () => {
    const testSetup = await createTestApp();
    app = testSetup.app;
    prisma = testSetup.prisma;
    ownerToken = createDevToken(ownerId, 'owner@example.com', 'room_owner');
    member1Token = createDevToken(member1Id, 'member1@example.com', 'member_one');
    member2Token = createDevToken(member2Id, 'member2@example.com', 'member_two');
    outsiderToken = createDevToken(outsiderId, 'outsider@example.com', 'outsider');
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  let smallRoomId: string;
  let privateRoomId: string;

  it('enforces room capacity in public rooms', async () => {
    // Create room with maxParticipants: 2
    const roomRes = await request(app.getHttpServer())
      .post('/api/v1/rooms')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Small Pair Room',
        maxParticipants: 2,
        isPrivate: false,
      });

    expect(roomRes.status).toBe(201);
    smallRoomId = roomRes.body.id;

    // Member 1 joins (now at capacity: owner + member1 = 2)
    const join1 = await request(app.getHttpServer())
      .post(`/api/v1/rooms/${smallRoomId}/join`)
      .set('Authorization', `Bearer ${member1Token}`);
    expect(join1.status).toBe(200);

    // Member 2 tries to join (should exceed capacity)
    const join2 = await request(app.getHttpServer())
      .post(`/api/v1/rooms/${smallRoomId}/join`)
      .set('Authorization', `Bearer ${member2Token}`);
    expect(join2.status).toBe(409);
    expect(join2.body.message).toContain('maximum capacity');
  });

  it('denies access to private room for non-members', async () => {
    const roomRes = await request(app.getHttpServer())
      .post('/api/v1/rooms')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Private Alpha Study',
        isPrivate: true,
      });

    expect(roomRes.status).toBe(201);
    privateRoomId = roomRes.body.id;

    // Outsider tries to access private room details
    const getRes = await request(app.getHttpServer())
      .get(`/api/v1/rooms/${privateRoomId}`)
      .set('Authorization', `Bearer ${outsiderToken}`);

    expect(getRes.status).toBe(403);
  });

  it('generates cryptographic invitation and allows joining private room', async () => {
    // Owner creates invitation with maxUses: 1
    const inviteRes = await request(app.getHttpServer())
      .post(`/api/v1/rooms/${privateRoomId}/invites`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        maxUses: 1,
        expiresInHours: 24,
      });

    expect(inviteRes.status).toBe(201);
    const rawToken = inviteRes.body.token;
    expect(rawToken).toHaveLength(64); // 256-bit hex

    // Verify token hash is stored in database, not raw token
    const dbInvite = await prisma.roomInvite.findUnique({
      where: { id: inviteRes.body.id },
    });
    expect(dbInvite?.tokenHash).toBeDefined();
    expect(dbInvite?.tokenHash).not.toBe(rawToken);

    // Outsider accepts valid invitation
    const acceptRes = await request(app.getHttpServer())
      .post('/api/v1/invites/accept')
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ token: rawToken });

    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.alreadyMember).toBe(false);

    // Outsider can now access private room
    const getRes = await request(app.getHttpServer())
      .get(`/api/v1/rooms/${privateRoomId}`)
      .set('Authorization', `Bearer ${outsiderToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.isMember).toBe(true);

    // Member 1 attempts to use the same single-use token (should fail max uses)
    const reuseRes = await request(app.getHttpServer())
      .post('/api/v1/invites/accept')
      .set('Authorization', `Bearer ${member1Token}`)
      .send({ token: rawToken });

    expect(reuseRes.status).toBe(400);
    expect(reuseRes.body.message).toContain('maximum usage limit');
  });

  it('rejects revoked invitations', async () => {
    const inviteRes = await request(app.getHttpServer())
      .post(`/api/v1/rooms/${privateRoomId}/invites`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ maxUses: 5 });

    const rawToken = inviteRes.body.token;
    const inviteId = inviteRes.body.id;

    // Revoke invite
    await request(app.getHttpServer())
      .delete(`/api/v1/rooms/${privateRoomId}/invites/${inviteId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    // Try to accept revoked invite
    const acceptRes = await request(app.getHttpServer())
      .post('/api/v1/invites/accept')
      .set('Authorization', `Bearer ${member1Token}`)
      .send({ token: rawToken });

    expect(acceptRes.status).toBe(400);
    expect(acceptRes.body.message).toContain('revoked');
  });
});
