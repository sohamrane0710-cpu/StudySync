import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import cookieParser from 'cookie-parser';

describe('StudyRoomController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cookie: string;
  let ownerId: string;
  let memberId: string;
  let memberCookie: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    
    // Clear relevant tables
    await prisma.roomMember.deleteMany();
    await prisma.studyRoom.deleteMany();

    // Create an owner user and log them in
    const ownerRegister = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'owner_room@example.com',
        username: 'owner_room',
        password: 'password123',
      });
    
    const ownerLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        identifier: 'owner_room@example.com',
        password: 'password123',
      });
    cookie = ownerLogin.headers['set-cookie'][0];
    ownerId = ownerRegister.body.id;

    // Create another user and log them in
    const memberRegister = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'member_room@example.com',
        username: 'member_room',
        password: 'password123',
      });
      
    const memberLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        identifier: 'member_room@example.com',
        password: 'password123',
      });
    memberCookie = memberLogin.headers['set-cookie'][0];
    memberId = memberRegister.body.id;
  });

  afterAll(async () => {
    await prisma.roomMember.deleteMany();
    await prisma.studyRoom.deleteMany();
    await app.close();
  });

  describe('/study-rooms (POST)', () => {
    it('should reject unauthenticated request', () => {
      return request(app.getHttpServer())
        .post('/study-rooms')
        .send({ name: 'My Room' })
        .expect(401);
    });

    it('should reject empty room name', () => {
      return request(app.getHttpServer())
        .post('/study-rooms')
        .set('Cookie', cookie)
        .send({ name: '   ' })
        .expect(400);
    });

    it('should create a public room by default', async () => {
      const response = await request(app.getHttpServer())
        .post('/study-rooms')
        .set('Cookie', cookie)
        .send({ name: 'Public Room', description: 'Test room' })
        .expect(201);

      expect(response.body.id).toBeDefined();
      expect(response.body.name).toBe('Public Room');
      expect(response.body.visibility).toBe('PUBLIC');
      expect(response.body._count.roomMembers).toBe(1);
    });
    
    it('should create a private room', async () => {
      const response = await request(app.getHttpServer())
        .post('/study-rooms')
        .set('Cookie', cookie)
        .send({ name: 'Private Room', visibility: 'PRIVATE' })
        .expect(201);

      expect(response.body.visibility).toBe('PRIVATE');
    });
  });

  describe('/study-rooms (GET)', () => {
    it('should list only public rooms', async () => {
      const response = await request(app.getHttpServer())
        .get('/study-rooms')
        .set('Cookie', memberCookie)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(1);
      response.body.forEach((room: any) => {
        expect(room.visibility).toBe('PUBLIC');
      });
    });
  });

  describe('/study-rooms/:roomId (GET)', () => {
    let publicRoomId: string;
    let privateRoomId: string;

    beforeAll(async () => {
      const pubRes = await request(app.getHttpServer())
        .post('/study-rooms')
        .set('Cookie', cookie)
        .send({ name: 'Pub', visibility: 'PUBLIC' });
      publicRoomId = pubRes.body.id;

      const privRes = await request(app.getHttpServer())
        .post('/study-rooms')
        .set('Cookie', cookie)
        .send({ name: 'Priv', visibility: 'PRIVATE' });
      privateRoomId = privRes.body.id;
    });

    it('should allow access to a public room', () => {
      return request(app.getHttpServer())
        .get(`/study-rooms/${publicRoomId}`)
        .set('Cookie', memberCookie)
        .expect(200);
    });

    it('should restrict access to a private room for non-members', () => {
      return request(app.getHttpServer())
        .get(`/study-rooms/${privateRoomId}`)
        .set('Cookie', memberCookie)
        .expect(403);
    });

    it('should allow owner access to a private room', () => {
      return request(app.getHttpServer())
        .get(`/study-rooms/${privateRoomId}`)
        .set('Cookie', cookie)
        .expect(200);
    });

    it('should return 404 for nonexistent room', () => {
      return request(app.getHttpServer())
        .get(`/study-rooms/00000000-0000-0000-0000-000000000000`)
        .set('Cookie', cookie)
        .expect(404);
    });
  });

  describe('/study-rooms/:roomId/join (POST)', () => {
    let joinRoomId: string;
    let privJoinRoomId: string;

    beforeAll(async () => {
      const pubRes = await request(app.getHttpServer())
        .post('/study-rooms')
        .set('Cookie', cookie)
        .send({ name: 'Joinable', visibility: 'PUBLIC' });
      joinRoomId = pubRes.body.id;

      const privRes = await request(app.getHttpServer())
        .post('/study-rooms')
        .set('Cookie', cookie)
        .send({ name: 'Unjoinable', visibility: 'PRIVATE' });
      privJoinRoomId = privRes.body.id;
    });

    it('should not allow joining a private room', () => {
      return request(app.getHttpServer())
        .post(`/study-rooms/${privJoinRoomId}/join`)
        .set('Cookie', memberCookie)
        .expect(403);
    });

    it('should allow joining a public room', () => {
      return request(app.getHttpServer())
        .post(`/study-rooms/${joinRoomId}/join`)
        .set('Cookie', memberCookie)
        .expect(201);
    });

    it('should prevent duplicate joining', () => {
      return request(app.getHttpServer())
        .post(`/study-rooms/${joinRoomId}/join`)
        .set('Cookie', memberCookie)
        .expect(409);
    });

    it('should prevent owner from joining their own room (since they are already a member)', () => {
      return request(app.getHttpServer())
        .post(`/study-rooms/${joinRoomId}/join`)
        .set('Cookie', cookie)
        .expect(409);
    });
  });

  describe('/study-rooms/:roomId/membership (DELETE)', () => {
    let leaveRoomId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/study-rooms')
        .set('Cookie', cookie)
        .send({ name: 'Leaveable', visibility: 'PUBLIC' });
      leaveRoomId = res.body.id;

      await request(app.getHttpServer())
        .post(`/study-rooms/${leaveRoomId}/join`)
        .set('Cookie', memberCookie);
    });

    it('should prevent owner from leaving', () => {
      return request(app.getHttpServer())
        .delete(`/study-rooms/${leaveRoomId}/membership`)
        .set('Cookie', cookie)
        .expect(403);
    });

    it('should allow a member to leave', () => {
      return request(app.getHttpServer())
        .delete(`/study-rooms/${leaveRoomId}/membership`)
        .set('Cookie', memberCookie)
        .expect(200);
    });

    it('should return 404 if not a member', () => {
      return request(app.getHttpServer())
        .delete(`/study-rooms/${leaveRoomId}/membership`)
        .set('Cookie', memberCookie)
        .expect(404);
    });
  });
});
