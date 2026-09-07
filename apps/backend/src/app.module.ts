import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UserModule } from './user/user.module.js';
import { StudyRoomModule } from './study-room/study-room.module.js';
import { TimerModule } from './timer/timer.module.js';
import { TimerCategoryModule } from './timer-category/timer-category.module.js';

@Module({
  imports: [PrismaModule, AuthModule, UserModule, StudyRoomModule, TimerModule, TimerCategoryModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
