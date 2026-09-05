import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '../auth.service.js';
import { SESSION_COOKIE_NAME } from '../auth.controller.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const rawToken = request.cookies?.[SESSION_COOKIE_NAME];

    if (!rawToken) {
      throw new UnauthorizedException('Authentication required');
    }

    const user = await this.authService.validateSession(rawToken);

    if (!user) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    // Attach user to request object
    (request as any).user = user;

    return true;
  }
}
