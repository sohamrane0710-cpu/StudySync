import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import { AuthService } from '../src/auth/auth.service';
import { SupabaseAuthGuard } from '../src/common/guards/supabase-auth.guard';
import { PrismaService } from '../src/database/prisma.service';
import { createDevToken, getDevSecret } from './test-helper';

describe('Authentication and Identity Derivation (Unit & Guard Tests)', () => {
  let authService: AuthService;
  let authGuard: SupabaseAuthGuard;
  let mockPrisma: any;
  let configService: ConfigService;

  const validUserId = '11111111-1111-4111-8111-111111111111';
  const existingUserId = '22222222-2222-4222-8222-222222222222';

  beforeEach(async () => {
    mockPrisma = {
      profile: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === existingUserId) {
            return Promise.resolve({
              id: existingUserId,
              username: 'existing_user',
              displayName: 'Existing User',
            });
          }
          return Promise.resolve(null);
        }),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
      },
      userPreference: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(mockPrisma);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        SupabaseAuthGuard,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'authMode') return 'dev';
              if (key === 'nodeEnv') return 'development';
              if (key === 'devAuthSecret') return getDevSecret();
              return undefined;
            }),
          },
        },
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    authGuard = module.get<SupabaseAuthGuard>(SupabaseAuthGuard);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('SupabaseAuthGuard', () => {
    function createMockContext(headers: Record<string, string>): { context: ExecutionContext; request: any } {
      const request: any = { headers };
      const context = {
        switchToHttp: () => ({
          getRequest: () => request,
        }),
      } as unknown as ExecutionContext;
      return { context, request };
    }

    it('rejects requests with missing Authorization header with 401', async () => {
      const { context } = createMockContext({});
      await expect(authGuard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Missing Authorization header'),
      );
    });

    it('rejects malformed authorization header scheme (e.g. Basic instead of Bearer)', async () => {
      const { context } = createMockContext({ authorization: 'Basic some-base64-credentials' });
      await expect(authGuard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Invalid Authorization header format. Expected "Bearer <token>"'),
      );
    });

    it('rejects malformed authorization header with missing token', async () => {
      const { context } = createMockContext({ authorization: 'Bearer' });
      await expect(authGuard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Invalid Authorization header format. Expected "Bearer <token>"'),
      );
    });

    it('rejects malformed authorization header with multiple space-delimited parts', async () => {
      const { context } = createMockContext({ authorization: 'Bearer token1 token2' });
      await expect(authGuard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Invalid Authorization header format. Expected "Bearer <token>"'),
      );
    });

    it('attaches verified user to request object and returns true for valid token', async () => {
      const token = createDevToken(existingUserId, 'existing@example.com', 'existing_user');
      const { context, request } = createMockContext({ authorization: `Bearer ${token}` });

      const result = await authGuard.canActivate(context);
      expect(result).toBe(true);
      expect(request.user).toBeDefined();
      expect(request.user.id).toBe(existingUserId);
      expect(request.user.username).toBe('existing_user');
    });
  });

  describe('AuthService Token Verification & Consistency', () => {
    it('authenticates valid development token generated with matching secret', async () => {
      const token = createDevToken(validUserId, 'alice@example.com', 'alice_dev');
      const user = await authService.verifyToken(token);

      expect(user).toBeDefined();
      expect(user.id).toBe(validUserId);
      expect(user.email).toBe('alice@example.com');
    });

    it('confirms the test helper and AuthService use the exact same configured secret', () => {
      const helperSecret = getDevSecret();
      const authServiceSecret = authService.getDevSecret();

      expect(helperSecret).toBe(authServiceSecret);
    });

    it('rejects tokens signed with the wrong secret with 401', async () => {
      const wrongSecretToken = createDevToken(validUserId, 'hacker@example.com', 'hacker', {
        secret: 'completely-wrong-unauthorized-secret-32ch',
      });

      await expect(authService.verifyToken(wrongSecretToken)).rejects.toThrow(
        new UnauthorizedException('Invalid or expired authentication token'),
      );
    });

    it('rejects expired tokens with 401', async () => {
      const expiredToken = jwt.sign(
        { sub: validUserId, email: 'expired@example.com' },
        getDevSecret(),
        { expiresIn: '-1s' },
      );

      await expect(authService.verifyToken(expiredToken)).rejects.toThrow(
        new UnauthorizedException('Invalid or expired authentication token'),
      );
    });

    it('rejects tokens missing the sub claim with 401', async () => {
      const noSubToken = jwt.sign({ email: 'nosub@example.com' }, getDevSecret(), {
        expiresIn: '1h',
      });

      await expect(authService.verifyToken(noSubToken)).rejects.toThrow(
        new UnauthorizedException('Token missing valid UUID subject identifier'),
      );
    });

    it('rejects tokens with non-UUID sub claim with 401', async () => {
      const invalidSubToken = jwt.sign({ sub: 'not-a-valid-uuid' }, getDevSecret(), {
        expiresIn: '1h',
      });

      await expect(authService.verifyToken(invalidSubToken)).rejects.toThrow(
        new UnauthorizedException('Token missing valid UUID subject identifier'),
      );
    });

    it('strictly forbids development authentication in production mode', async () => {
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'nodeEnv') return 'production';
        if (key === 'authMode') return 'dev';
        return undefined;
      });

      const token = createDevToken(validUserId);
      await expect(authService.verifyToken(token)).rejects.toThrow(
        new UnauthorizedException('Insecure auth mode disabled in production'),
      );

      expect(() => authService.generateDevToken({ id: validUserId, email: 'test@example.com' })).toThrow(
        'generateDevToken is forbidden in production environment',
      );
    });

    it('provisions a new profile and default preferences on first authenticated request', async () => {
      const token = createDevToken(validUserId, 'newuser@example.com', 'new_user');
      const user = await authService.verifyToken(token);

      expect(user.id).toBe(validUserId);
      expect(mockPrisma.profile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            id: validUserId,
          }),
        }),
      );
      expect(mockPrisma.userPreference.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: validUserId,
            theme: 'dark-glass',
          }),
        }),
      );
    });
  });
});
