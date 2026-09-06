import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { TimerService } from './timer.service.js';
import { CreateTimerModeDto } from './dto/create-timer-mode.dto.js';
import { CreateTimerSessionDto } from './dto/create-timer-session.dto.js';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { User } from '@prisma/client';

@Controller()
@UseGuards(AuthGuard)
export class TimerController {
  constructor(private readonly timerService: TimerService) {}

  @Post('timer-modes')
  createTimerMode(@CurrentUser() user: any, @Body() dto: CreateTimerModeDto) {
    return this.timerService.createTimerMode(user.id, dto);
  }

  @Get('timer-modes')
  getTimerModes(@CurrentUser() user: any) {
    return this.timerService.getTimerModes(user.id);
  }

  @Get('timer-modes/:id')
  getTimerMode(@CurrentUser() user: any, @Param('id') id: string) {
    return this.timerService.getTimerMode(user.id, id);
  }

  @Post('timer-sessions')
  createTimerSession(@CurrentUser() user: any, @Body() dto: CreateTimerSessionDto) {
    return this.timerService.createTimerSession(user.id, dto);
  }

  @Post('timer-sessions/:id/start')
  startTimerSession(@CurrentUser() user: any, @Param('id') id: string) {
    return this.timerService.startTimerSession(user.id, id);
  }

  @Post('timer-sessions/:id/pause')
  pauseTimerSession(@CurrentUser() user: any, @Param('id') id: string) {
    return this.timerService.pauseTimerSession(user.id, id);
  }

  @Post('timer-sessions/:id/complete')
  completeTimerSession(@CurrentUser() user: any, @Param('id') id: string) {
    return this.timerService.completeTimerSession(user.id, id);
  }
}
