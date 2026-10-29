import { Module } from '@nestjs/common';
import { TimerModesController } from './timer-modes.controller';
import { TimerModesService } from './timer-modes.service';

@Module({
  controllers: [TimerModesController],
  providers: [TimerModesService],
  exports: [TimerModesService],
})
export class TimerModesModule {}
