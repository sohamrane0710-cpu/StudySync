import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { TimerCategoryService } from './timer-category.service.js';
import { CreateTimerCategoryDto, UpdateTimerCategoryDto } from './dto.js';
import { AuthGuard } from '../auth/guards/auth.guard.js';

@Controller('timer-categories')
@UseGuards(AuthGuard)
export class TimerCategoryController {
  constructor(private readonly timerCategoryService: TimerCategoryService) {}

  @Post()
  create(@Req() req: any, @Body() dto: CreateTimerCategoryDto) {
    return this.timerCategoryService.create(req.user.id, dto);
  }

  @Get()
  findAll(@Req() req: any) {
    return this.timerCategoryService.findAll(req.user.id);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.timerCategoryService.findOne(req.user.id, id);
  }

  @Patch(':id')
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateTimerCategoryDto,
  ) {
    return this.timerCategoryService.update(req.user.id, id, dto);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.timerCategoryService.remove(req.user.id, id);
  }
}
