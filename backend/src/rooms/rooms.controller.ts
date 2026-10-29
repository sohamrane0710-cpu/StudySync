import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { RoomsService } from './rooms.service';

@ApiTags('Rooms')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new study room' })
  @ApiResponse({ status: 201, description: 'Room created' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRoomDto,
  ) {
    return this.roomsService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List public rooms and rooms where user is a member' })
  @ApiResponse({ status: 200, description: 'List of rooms' })
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.roomsService.findAll(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve study room details and active participants' })
  @ApiResponse({ status: 200, description: 'Room details' })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.roomsService.findOne(user.id, id);
  }

  @Post(':id/join')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Join an eligible public study room' })
  @ApiResponse({ status: 200, description: 'Joined room successfully' })
  async join(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.roomsService.join(user.id, id);
  }

  @Post(':id/leave')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Leave a study room' })
  @ApiResponse({ status: 200, description: 'Left room successfully' })
  async leave(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.roomsService.leave(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update room settings (requires OWNER or MODERATOR)' })
  @ApiResponse({ status: 200, description: 'Room updated' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoomDto,
  ) {
    return this.roomsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a study room (requires OWNER)' })
  @ApiResponse({ status: 200, description: 'Room deleted' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.roomsService.remove(user.id, id);
  }
}
