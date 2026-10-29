import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { CollaborationService } from './collaboration.service';
import { StartRoomTimerDto } from './dto/start-room-timer.dto';

@ApiTags('Collaboration')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('rooms/:roomId/timer')
export class CollaborationController {
  constructor(private readonly collaborationService: CollaborationService) {}

  @Get()
  @ApiOperation({ summary: 'Get active room timer state and active participants' })
  @ApiResponse({ status: 200, description: 'Room timer state' })
  async getRoomTimer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId', ParseUUIDPipe) roomId: string,
  ) {
    return this.collaborationService.getRoomTimer(user.id, roomId);
  }

  @Post('start')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Start a room-wide study timer (requires OWNER or MODERATOR)' })
  @ApiResponse({ status: 201, description: 'Room timer started' })
  async startRoomTimer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() dto: StartRoomTimerDto,
  ) {
    return this.collaborationService.startRoomTimer(user.id, roomId, dto);
  }

  @Post('pause')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pause the room timer' })
  @ApiResponse({ status: 200, description: 'Room timer paused' })
  async pauseRoomTimer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId', ParseUUIDPipe) roomId: string,
  ) {
    return this.collaborationService.pauseRoomTimer(user.id, roomId);
  }

  @Post('resume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resume the room timer' })
  @ApiResponse({ status: 200, description: 'Room timer resumed' })
  async resumeRoomTimer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId', ParseUUIDPipe) roomId: string,
  ) {
    return this.collaborationService.resumeRoomTimer(user.id, roomId);
  }

  @Post('complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete room timer and commit participant credits' })
  @ApiResponse({ status: 200, description: 'Room timer completed' })
  async completeRoomTimer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId', ParseUUIDPipe) roomId: string,
  ) {
    return this.collaborationService.completeRoomTimer(user.id, roomId);
  }

  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel the room timer' })
  @ApiResponse({ status: 200, description: 'Room timer cancelled' })
  async cancelRoomTimer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId', ParseUUIDPipe) roomId: string,
  ) {
    return this.collaborationService.cancelRoomTimer(user.id, roomId);
  }

  @Post('join')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Join room timer as an active participant' })
  @ApiResponse({ status: 200, description: 'Joined room timer' })
  async joinRoomTimer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId', ParseUUIDPipe) roomId: string,
  ) {
    return this.collaborationService.joinRoomTimer(user.id, roomId);
  }

  @Post('leave')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Leave room timer and credit individual elapsed duration' })
  @ApiResponse({ status: 200, description: 'Left room timer with partial credit' })
  async leaveRoomTimer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId', ParseUUIDPipe) roomId: string,
  ) {
    return this.collaborationService.leaveRoomTimer(user.id, roomId);
  }
}
