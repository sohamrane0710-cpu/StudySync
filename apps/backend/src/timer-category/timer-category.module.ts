import { Module } from '@nestjs/common';
import { TimerCategoryService } from './timer-category.service.js';
import { TimerCategoryController } from './timer-category.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [TimerCategoryController],
  providers: [TimerCategoryService],
  exports: [TimerCategoryService],
})
export class TimerCategoryModule {}
