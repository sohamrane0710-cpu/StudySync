import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { ChatService } from './chat.service';
import { EditMessageDto } from './dto/edit-message.dto';
import { QueryMessagesDto } from './dto/query-messages.dto';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('rooms/:roomId/messages')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get()
  @ApiOperation({ summary: 'List room messages with cursor-based pagination' })
  @ApiResponse({ status: 200, description: 'Paginated messages' })
  async getMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Query() query: QueryMessagesDto,
  ) {
    return this.chatService.getMessages(user.id, roomId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Send a message in the room chat' })
  @ApiResponse({ status: 201, description: 'Message sent' })
  async sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(user.id, roomId, dto);
  }

  @Patch(':messageId')
  @ApiOperation({ summary: 'Edit a message (author only)' })
  @ApiResponse({ status: 200, description: 'Message updated' })
  async editMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body() dto: EditMessageDto,
  ) {
    return this.chatService.editMessage(user.id, roomId, messageId, dto);
  }

  @Delete(':messageId')
  @ApiOperation({ summary: 'Soft-delete a message (author or room moderator/owner)' })
  @ApiResponse({ status: 200, description: 'Message deleted' })
  async deleteMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ) {
    return this.chatService.deleteMessage(user.id, roomId, messageId);
  }
}
