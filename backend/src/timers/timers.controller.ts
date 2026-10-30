import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { CancelTimerDto } from './dto/cancel-timer.dto';
import { CompleteTimerDto } from './dto/complete-timer.dto';
import { FinishSequenceDto } from './dto/finish-sequence.dto';
import { PauseTimerDto } from './dto/pause-timer.dto';
import { ResumeTimerDto } from './dto/resume-timer.dto';
import { SkipTimerDto } from './dto/skip-timer.dto';
import { StartTimerDto } from './dto/start-timer.dto';
import { TimersService } from './timers.service';

@ApiTags('Timers')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('timers')
export class TimersController {
  constructor(private readonly timersService: TimersService) {}

  @Get('active')
  @ApiOperation({ summary: 'Retrieve currently active or paused personal timer state' })
  @ApiResponse({ status: 200, description: 'Active timer state or null' })
  async getActive(@CurrentUser() user: AuthenticatedUser) {
    return this.timersService.getActive(user.id);
  }

  @Post('start')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Start a new personal timer session' })
  @ApiResponse({ status: 201, description: 'Timer started' })
  @ApiResponse({ status: 409, description: 'An active timer is already running' })
  async start(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: StartTimerDto,
  ) {
    return this.timersService.start(user.id, dto);
  }

  @Post('pause')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pause the currently running timer' })
  @ApiResponse({ status: 200, description: 'Timer paused' })
  async pause(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PauseTimerDto = {},
  ) {
    return this.timersService.pause(user.id, dto);
  }

  @Post('resume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resume a paused timer session' })
  @ApiResponse({ status: 200, description: 'Timer resumed' })
  async resume(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ResumeTimerDto = {},
  ) {
    return this.timersService.resume(user.id, dto);
  }

  @Post('complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete active timer and commit credited study record (idempotent)' })
  @ApiResponse({ status: 200, description: 'Timer completed and study session recorded' })
  async complete(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CompleteTimerDto,
  ) {
    return this.timersService.complete(user.id, dto);
  }

  @Post('skip')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Skip the current timer step and advance sequence without study session credit' })
  @ApiResponse({ status: 200, description: 'Step skipped and sequence progressed' })
  async skip(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SkipTimerDto,
  ) {
    return this.timersService.skip(user.id, dto);
  }

  @Post('finish-sequence')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Finish current sequence without starting next timer' })
  @ApiResponse({ status: 200, description: 'Sequence finished' })
  async finishSequence(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: FinishSequenceDto = {},
  ) {
    return this.timersService.finishSequence(user.id, dto);
  }

  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel active timer session' })
  @ApiResponse({ status: 200, description: 'Timer cancelled' })
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CancelTimerDto = {},
  ) {
    return this.timersService.cancel(user.id, dto);
  }
}
