import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { CreateTimerModeDto } from './dto/create-timer-mode.dto';
import { UpdateTimerModeDto } from './dto/update-timer-mode.dto';
import { TimerModesService } from './timer-modes.service';

@ApiTags('Timer Modes')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('timer-modes')
export class TimerModesController {
  constructor(private readonly timerModesService: TimerModesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new custom timer mode' })
  @ApiResponse({ status: 201, description: 'Timer mode created' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTimerModeDto,
  ) {
    return this.timerModesService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all accessible timer modes (system and user custom)' })
  @ApiResponse({ status: 200, description: 'List of timer modes' })
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.timerModesService.findAll(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve specific timer mode by ID' })
  @ApiResponse({ status: 200, description: 'Timer mode details' })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.timerModesService.findOne(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user-owned timer mode' })
  @ApiResponse({ status: 200, description: 'Timer mode updated' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTimerModeDto,
  ) {
    return this.timerModesService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Archive/delete a user-owned timer mode' })
  @ApiResponse({ status: 200, description: 'Timer mode archived' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.timerModesService.remove(user.id, id);
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Duplicate an existing timer mode into a user-owned custom mode' })
  @ApiResponse({ status: 201, description: 'Timer mode duplicated' })
  async duplicate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.timerModesService.duplicate(user.id, id);
  }
}
