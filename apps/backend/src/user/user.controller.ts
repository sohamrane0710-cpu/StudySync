import { Controller, Get, Post, Patch, Body, Query, UseGuards } from '@nestjs/common';
import { UserService } from './user.service.js';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
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

  @Get('profile')
  @UseGuards(AuthGuard)
  async getProfile(@CurrentUser() user: User) {
    return this.userService.getProfile(user.id);
  }

  @Patch('profile')
  @UseGuards(AuthGuard)
  async updateProfile(
    @CurrentUser() user: User,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.userService.updateProfile(user.id, dto);
  }
}
