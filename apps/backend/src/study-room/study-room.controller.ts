import { Controller, Post, Get, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { StudyRoomService } from './study-room.service.js';
import { CreateStudyRoomDto } from './dto/create-study-room.dto.js';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { User } from '@prisma/client';

@UseGuards(AuthGuard)
@Controller('study-rooms')
export class StudyRoomController {
  constructor(private readonly studyRoomService: StudyRoomService) {}

  @Post()
  createRoom(@CurrentUser() user: User, @Body() dto: CreateStudyRoomDto) {
    return this.studyRoomService.createRoom(user.id, dto);
  }

  @Get()
  listPublicRooms() {
    return this.studyRoomService.listPublicRooms();
  }

  @Get(':roomId')
  getRoom(@CurrentUser() user: User, @Param('roomId') roomId: string) {
    return this.studyRoomService.getRoom(user.id, roomId);
  }

  @Post(':roomId/join')
  joinRoom(@CurrentUser() user: User, @Param('roomId') roomId: string) {
    return this.studyRoomService.joinRoom(user.id, roomId);
  }

  @Delete(':roomId/membership')
  leaveRoom(@CurrentUser() user: User, @Param('roomId') roomId: string) {
    return this.studyRoomService.leaveRoom(user.id, roomId);
  }
}
