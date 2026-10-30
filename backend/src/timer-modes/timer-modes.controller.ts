import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { CreateTimerModeDto } from './dto/create-timer-mode.dto';
import { CreateTimerModeStepDto } from './dto/create-timer-mode-step.dto';
import { ReorderStepsDto } from './dto/reorder-steps.dto';
import { UpdateTimerModeDto } from './dto/update-timer-mode.dto';
import { UpdateTimerModeStepDto } from './dto/update-timer-mode-step.dto';
import { TimerModesService } from './timer-modes.service';

@ApiTags('Timer Modes')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('timer-modes')
export class TimerModesController {
  constructor(private readonly timerModesService: TimerModesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new custom timer mode with sequence steps' })
  @ApiResponse({ status: 201, description: 'Timer mode created' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTimerModeDto,
  ) {
    return this.timerModesService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all accessible timer modes with ordered steps' })
  @ApiResponse({ status: 200, description: 'List of timer modes' })
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.timerModesService.findAll(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve specific timer mode by ID with ordered steps' })
  @ApiResponse({ status: 200, description: 'Timer mode details' })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.timerModesService.findOne(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user-owned timer mode and optionally its steps' })
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
  @ApiOperation({ summary: 'Duplicate an existing timer mode and its steps into a user-owned mode' })
  @ApiResponse({ status: 201, description: 'Timer mode duplicated' })
  async duplicate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.timerModesService.duplicate(user.id, id);
  }

  // --- Step-Level Endpoints ---

  @Post(':id/steps')
  @ApiOperation({ summary: 'Add a new step to a timer mode sequence' })
  @ApiResponse({ status: 201, description: 'Step added to timer mode' })
  async addStep(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTimerModeStepDto,
  ) {
    return this.timerModesService.addStep(user.id, id, dto);
  }

  @Patch(':id/steps/:stepId')
  @ApiOperation({ summary: 'Update an individual step in a timer mode sequence' })
  @ApiResponse({ status: 200, description: 'Step updated' })
  async updateStep(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('stepId', ParseUUIDPipe) stepId: string,
    @Body() dto: UpdateTimerModeStepDto,
  ) {
    return this.timerModesService.updateStep(user.id, id, stepId, dto);
  }

  @Delete(':id/steps/:stepId')
  @ApiOperation({ summary: 'Delete a step from a timer mode sequence' })
  @ApiResponse({ status: 200, description: 'Step deleted and remaining steps re-compacted' })
  async deleteStep(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('stepId', ParseUUIDPipe) stepId: string,
  ) {
    return this.timerModesService.deleteStep(user.id, id, stepId);
  }

  @Post(':id/steps/:stepId/duplicate')
  @ApiOperation({ summary: 'Duplicate an individual step in a timer mode sequence' })
  @ApiResponse({ status: 201, description: 'Step duplicated' })
  async duplicateStep(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('stepId', ParseUUIDPipe) stepId: string,
  ) {
    return this.timerModesService.duplicateStep(user.id, id, stepId);
  }

  @Put(':id/steps/reorder')
  @ApiOperation({ summary: 'Reorder steps in a timer mode sequence' })
  @ApiResponse({ status: 200, description: 'Steps reordered' })
  async reorderSteps(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReorderStepsDto,
  ) {
    return this.timerModesService.reorderSteps(user.id, id, dto);
  }
}
