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
import { CreateStudySessionDto } from './dto/create-study-session.dto';
import { QueryStudySessionsDto } from './dto/query-study-sessions.dto';
import { UpdateStudySessionDto } from './dto/update-study-session.dto';
import { StudySessionsService } from './study-sessions.service';

@ApiTags('Study Sessions')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('study-sessions')
export class StudySessionsController {
  constructor(private readonly studySessionsService: StudySessionsService) {}

  @Post()
  @ApiOperation({ summary: 'Manually log a study session' })
  @ApiResponse({ status: 201, description: 'Study session created' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateStudySessionDto,
  ) {
    return this.studySessionsService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Query paginated study session history' })
  @ApiResponse({ status: 200, description: 'Paginated list of study sessions' })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryStudySessionsDto,
  ) {
    return this.studySessionsService.findAll(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get study session details' })
  @ApiResponse({ status: 200, description: 'Study session details' })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.studySessionsService.findOne(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update study session metadata (title, notes, categories, labels)' })
  @ApiResponse({ status: 200, description: 'Study session updated' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStudySessionDto,
  ) {
    return this.studySessionsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a study session record' })
  @ApiResponse({ status: 200, description: 'Study session deleted' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.studySessionsService.remove(user.id, id);
  }
}
