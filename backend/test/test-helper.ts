import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/database/prisma.service';

export const DEV_SECRET = 'local-studysync-dev-jwt-secret-do-not-use-in-prod-32c';

export function createDevToken(userId: string, email: string = `${userId}@example.com`, username?: string): string {
  return jwt.sign(
    {
      sub: userId,
      email,
      user_metadata: {
        username: username || `user_${userId.slice(0, 8)}`,
      },
    },
    DEV_SECRET,
    { expiresIn: '1d' },
  );
}

export async function createTestApp(): Promise<{ app: INestApplication; prisma: PrismaService }> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.init();
  const prisma = app.get(PrismaService);
  return { app, prisma };
}

export async function cleanDatabase(prisma: PrismaService) {
  // Clean tables in reverse dependency order
  await prisma.roomStudySessionParticipant.deleteMany();
  await prisma.roomStudySession.deleteMany();
  await prisma.message.deleteMany();
  await prisma.roomInvite.deleteMany();
  await prisma.roomMember.deleteMany();
  await prisma.room.deleteMany();
  await prisma.studySessionCategory.deleteMany();
  await prisma.studySessionLabel.deleteMany();
  await prisma.studySession.deleteMany();
  await prisma.timerSession.deleteMany();
  await prisma.sessionLabel.deleteMany();
  await prisma.sessionCategory.deleteMany();
  await prisma.userPreference.deleteMany();
  await prisma.timerMode.deleteMany({ where: { userId: { not: null } } });
  await prisma.profile.deleteMany();
}
