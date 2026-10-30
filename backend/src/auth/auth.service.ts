import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private jwksClient?: JwksClient;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const supabaseUrl = this.configService.get<string>('supabaseUrl');
    if (supabaseUrl) {
      this.jwksClient = new JwksClient({
        jwksUri: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
        cache: true,
        rateLimit: true,
      });
    }
  }

  getDevSecret(): string {
    return (
      this.configService.get<string>('devAuthSecret') ||
      this.configService.get<string>('supabaseJwtSecret') ||
      'local-studysync-dev-jwt-secret-do-not-use-in-prod-32c'
    );
  }

  async verifyToken(token: string): Promise<AuthenticatedUser> {
    const authMode = this.configService.get<string>('authMode') || 'dev';
    const nodeEnv = this.configService.get<string>('nodeEnv');

    // Prevent any dev bypass in production
    if (nodeEnv === 'production' && authMode === 'dev') {
      throw new UnauthorizedException('Insecure auth mode disabled in production');
    }

    let payload: any;

    try {
      if (authMode === 'supabase') {
        const secret = this.configService.get<string>('supabaseJwtSecret');
        if (secret) {
          payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
        } else if (this.jwksClient) {
          const decoded = jwt.decode(token, { complete: true });
          if (!decoded || !decoded.header?.kid) {
            throw new UnauthorizedException('Invalid JWT header');
          }
          const key = await this.jwksClient.getSigningKey(decoded.header.kid);
          const signingKey = key.getPublicKey();
          payload = jwt.verify(token, signingKey, { algorithms: ['RS256', 'ES256'] });
        } else {
          throw new UnauthorizedException('Supabase auth not properly configured');
        }
      } else {
        // Dev auth mode (supported only outside production)
        const secret = this.getDevSecret();
        payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
      }
    } catch (err: any) {
      this.logger.debug(`Token verification failed: ${err.message}`);
      throw new UnauthorizedException('Invalid or expired authentication token');
    }

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const userId = payload?.sub;
    if (!userId || typeof userId !== 'string' || !UUID_REGEX.test(userId)) {
      throw new UnauthorizedException('Token missing valid UUID subject identifier');
    }

    const email = payload.email || `${userId.slice(0, 8)}@studysync.local`;
    const username =
      payload.user_metadata?.user_name ||
      payload.user_metadata?.username ||
      `user_${userId.slice(0, 8)}`;
    const displayName =
      payload.user_metadata?.full_name ||
      payload.user_metadata?.name ||
      username;

    // Ensure profile and preferences records exist in the database
    const profile = await this.ensureProfile({
      id: userId,
      email,
      username,
      displayName,
    });

    return {
      id: profile.id,
      email,
      username: profile.username,
      displayName: profile.displayName,
    };
  }

  async ensureProfile(userData: {
    id: string;
    email: string;
    username: string;
    displayName: string;
  }) {
    const existing = await this.prisma.profile.findUnique({
      where: { id: userData.id },
    });

    if (existing) {
      return existing;
    }

    // Auto-provision profile and default user preferences atomically
    return this.prisma.$transaction(async (tx) => {
      // Avoid duplicate usernames by checking uniqueness
      let finalUsername = userData.username;
      const count = await tx.profile.count({
        where: { username: { equals: finalUsername, mode: 'insensitive' } },
      });
      if (count > 0) {
        finalUsername = `${userData.username}_${userData.id.slice(0, 4)}`;
      }

      const profile = await tx.profile.create({
        data: {
          id: userData.id,
          username: finalUsername,
          displayName: userData.displayName,
        },
      });

      await tx.userPreference.create({
        data: {
          userId: profile.id,
          theme: 'dark-glass',
          timerFace: 'ring',
          soundVolume: 0.7,
          soundEnabled: true,
          autoStartBreaks: false,
          autoStartPomodoros: false,
        },
      });

      return profile;
    });
  }

  generateDevToken(user: { id: string; email: string; username?: string }): string {
    const nodeEnv = this.configService.get<string>('nodeEnv');
    if (nodeEnv === 'production') {
      throw new Error('generateDevToken is forbidden in production environment');
    }

    const secret = this.getDevSecret();

    return jwt.sign(
      {
        sub: user.id,
        email: user.email,
        user_metadata: {
          username: user.username || `user_${user.id.slice(0, 8)}`,
        },
      },
      secret,
      { expiresIn: '7d', algorithm: 'HS256' },
    );
  }
}
