import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { UserService } from './user.service.js';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto.js';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { User } from '@prisma/client';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('check-username')
  async checkUsername(@Query('username') username: string) {
    const available = await this.userService.checkUsernameAvailability(username);
    return { username, available };
  }

  @Post('onboarding')
  @UseGuards(AuthGuard)
  async completeOnboarding(
    @CurrentUser() user: User,
    @Body() dto: CompleteOnboardingDto,
  ) {
    return this.userService.completeOnboarding(user.id, dto);
  }
}
