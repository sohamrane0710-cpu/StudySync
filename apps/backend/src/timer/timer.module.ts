import { Module } from '@nestjs/common';
import { TimerController } from './timer.controller.js';
import { TimerService } from './timer.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [TimerController],
  providers: [TimerService]
})
export class TimerModule {}
