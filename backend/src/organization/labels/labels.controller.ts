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
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { CreateLabelDto } from './dto/create-label.dto';
import { UpdateLabelDto } from './dto/update-label.dto';
import { LabelsService } from './labels.service';

@ApiTags('Labels')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('labels')
export class LabelsController {
  constructor(private readonly labelsService: LabelsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new study label' })
  @ApiResponse({ status: 201, description: 'Label created' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLabelDto,
  ) {
    return this.labelsService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all active labels for current user' })
  @ApiQuery({ name: 'categoryId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'List of labels' })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.labelsService.findAll(user.id, categoryId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get label by ID' })
  @ApiResponse({ status: 200, description: 'Label details' })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.labelsService.findOne(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a label' })
  @ApiResponse({ status: 200, description: 'Label updated' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLabelDto,
  ) {
    return this.labelsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Archive a label' })
  @ApiResponse({ status: 200, description: 'Label archived' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.labelsService.remove(user.id, id);
  }
}
