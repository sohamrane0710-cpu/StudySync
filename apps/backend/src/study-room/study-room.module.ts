import { Module } from '@nestjs/common';
import { StudyRoomController } from './study-room.controller.js';
import { StudyRoomService } from './study-room.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [StudyRoomController],
  providers: [StudyRoomService],
})
export class StudyRoomModule {}
