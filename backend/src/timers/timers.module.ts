import { Module } from '@nestjs/common';
import { StudySessionsModule } from '../study-sessions/study-sessions.module';
import { TimersController } from './timers.controller';
import { TimersService } from './timers.service';

@Module({
  imports: [StudySessionsModule],
  controllers: [TimersController],
  providers: [TimersService],
  exports: [TimersService],
})
export class TimersModule {}
