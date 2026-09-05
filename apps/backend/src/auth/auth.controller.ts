import { Controller, Post, Body, Get, Req, Res, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import type { Request, Response } from 'express';
import { AuthGuard } from './guards/auth.guard.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import type { User } from '@prisma/client';

export const SESSION_COOKIE_NAME = 'studysync_session';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private setSessionCookie(res: Response, rawToken: string, expiresAt: Date) {
    res.cookie(SESSION_COOKIE_NAME, rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    });
  }

  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.authService.register(dto);
    return user;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { rawToken, expiresAt, user } = await this.authService.login(dto);
    this.setSessionCookie(res, rawToken, expiresAt);
    return user;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawToken = req.cookies?.[SESSION_COOKIE_NAME];
    if (rawToken) {
      await this.authService.logout(rawToken);
    }
    res.clearCookie(SESSION_COOKIE_NAME, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
    return { success: true };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  getMe(@CurrentUser() user: User) {
    const { passwordHash, ...safeUser } = user as any; // fallback if passwordHash somehow attached
    return safeUser;
  }
}
