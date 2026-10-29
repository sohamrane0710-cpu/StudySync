import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { cleanDatabase, createDevToken, createTestApp } from './test-helper';
import { PrismaService } from '../src/database/prisma.service';

describe('5. Persistent Room Chat and Authorization', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const ownerId = '99999999-9999-4999-8999-999999999999';
  const memberId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const nonMemberId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  let ownerToken: string;
  let memberToken: string;
  let nonMemberToken: string;
  let roomId: string;

  beforeAll(async () => {
    const testSetup = await createTestApp();
    app = testSetup.app;
    prisma = testSetup.prisma;
    ownerToken = createDevToken(ownerId, 'owner@example.com', 'chat_owner');
    memberToken = createDevToken(memberId, 'member@example.com', 'chat_member');
    nonMemberToken = createDevToken(nonMemberId, 'nonmember@example.com', 'chat_nonmember');

    // Create room
    const roomRes = await request(app.getHttpServer())
      .post('/api/v1/rooms')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Chat Test Room' });
    roomId = roomRes.body.id;

    // Join member
    await request(app.getHttpServer())
      .post(`/api/v1/rooms/${roomId}/join`)
      .set('Authorization', `Bearer ${memberToken}`);
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  let messageId: string;

  it('allows member to post message and prevents non-member', async () => {
    // Non-member attempt
    const failRes = await request(app.getHttpServer())
      .post(`/api/v1/rooms/${roomId}/messages`)
      .set('Authorization', `Bearer ${nonMemberToken}`)
      .send({ content: 'I should not be able to post' });
    expect(failRes.status).toBe(403);

    // Member post
    const successRes = await request(app.getHttpServer())
      .post(`/api/v1/rooms/${roomId}/messages`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ content: 'Hello StudySync room!' });

    expect(successRes.status).toBe(201);
    expect(successRes.body.content).toBe('Hello StudySync room!');
    messageId = successRes.body.id;
  });

  it('restricts message editing to the original author', async () => {
    // Owner tries to edit member's message (forbidden)
    const editOther = await request(app.getHttpServer())
      .patch(`/api/v1/rooms/${roomId}/messages/${messageId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ content: 'Owner modifying your words' });
    expect(editOther.status).toBe(403);

    // Author edits message
    const editAuthor = await request(app.getHttpServer())
      .patch(`/api/v1/rooms/${roomId}/messages/${messageId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ content: 'Hello StudySync room! (edited)' });

    expect(editAuthor.status).toBe(200);
    expect(editAuthor.body.content).toBe('Hello StudySync room! (edited)');
    expect(editAuthor.body.isEdited).toBe(true);
  });

  it('allows author or room owner to delete message', async () => {
    // Create second message by member
    const msg2 = await request(app.getHttpServer())
      .post(`/api/v1/rooms/${roomId}/messages`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ content: 'Temporary message' });

    // Room owner can delete member's message
    const deleteByOwner = await request(app.getHttpServer())
      .delete(`/api/v1/rooms/${roomId}/messages/${msg2.body.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(deleteByOwner.status).toBe(200);

    // Verify soft delete in DB
    const dbMsg = await prisma.message.findUnique({
      where: { id: msg2.body.id },
    });
    expect(dbMsg?.deletedAt).not.toBeNull();
  });
});
