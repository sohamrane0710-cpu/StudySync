import {
  Body,
  Controller,
  Delete,
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
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { CreateInviteDto } from './dto/create-invite.dto';
import { InvitationsService } from './invitations.service';

@ApiTags('Invitations')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller()
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post('rooms/:roomId/invites')
  @ApiOperation({ summary: 'Create an invitation link for a study room (requires OWNER or MODERATOR)' })
  @ApiResponse({ status: 201, description: 'Invitation created (raw token returned once)' })
  async createInvite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() dto: CreateInviteDto,
  ) {
    return this.invitationsService.createInvite(user.id, roomId, dto);
  }

  @Get('rooms/:roomId/invites')
  @ApiOperation({ summary: 'List active invitations for a study room' })
  @ApiResponse({ status: 200, description: 'List of invitations' })
  async listInvites(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId', ParseUUIDPipe) roomId: string,
  ) {
    return this.invitationsService.listInvites(user.id, roomId);
  }

  @Delete('rooms/:roomId/invites/:inviteId')
  @ApiOperation({ summary: 'Revoke an invitation link' })
  @ApiResponse({ status: 200, description: 'Invitation revoked' })
  async revokeInvite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Param('inviteId', ParseUUIDPipe) inviteId: string,
  ) {
    return this.invitationsService.revokeInvite(user.id, roomId, inviteId);
  }

  @Post('invites/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept an invitation token to join a private room' })
  @ApiResponse({ status: 200, description: 'Joined room via invitation' })
  async acceptInvite(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AcceptInviteDto,
  ) {
    return this.invitationsService.acceptInvite(user.id, dto);
  }
}
