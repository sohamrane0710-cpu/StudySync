import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as dotenv from 'dotenv';
import * as jwt from 'jsonwebtoken';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/database/prisma.service';

// Load environment variables for test execution
dotenv.config();

/**
 * Approved local hostnames for test databases.
 */
const APPROVED_LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const DOCKER_TEST_HOST = 'postgres';

export interface SafeDatabaseValidationResult {
  isValid: boolean;
  reason?: string;
  sanitizedHost?: string;
  databaseName?: string;
}

export interface DatabaseValidationOptions {
  allowDockerHost?: boolean;
}

/**
 * Validates whether a database connection string meets strict isolation policies:
 * 1. Must be a valid postgresql:// or postgres:// URL.
 * 2. Hostname must strictly match an approved local host (localhost, 127.0.0.1, [::1]).
 *    Docker host 'postgres' is permitted only with explicit opt-in.
 * 3. Database name must explicitly end with '_test' (e.g. studysync_test) to prevent
 *    modifying or destroying development or production data.
 * 4. Never exposes credentials in return values or error diagnostics.
 */
export function validateTestDatabaseUrl(
  urlString?: string,
  options?: DatabaseValidationOptions,
): SafeDatabaseValidationResult {
  if (!urlString || typeof urlString !== 'string' || urlString.trim() === '') {
    return {
      isValid: false,
      reason: 'Database connection URL is missing or empty. Integration tests require an explicit TEST_DATABASE_URL.',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return {
      isValid: false,
      reason: 'Malformed or invalid database connection URL format.',
    };
  }

  // 1. Validate protocol
  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    return {
      isValid: false,
      reason: `Unsupported protocol "${parsed.protocol}". Expected "postgresql:" or "postgres:".`,
    };
  }

  // 2. Validate hostname strictly (exact match, no substring checks)
  const rawHost = parsed.hostname.toLowerCase();
  const normalizedHost = rawHost.replace(/^\[|\]$/g, '');

  const allowDocker =
    options?.allowDockerHost === true || process.env.TEST_ALLOW_DOCKER_HOST === 'true';

  let isHostApproved = APPROVED_LOCAL_HOSTS.has(rawHost) || APPROVED_LOCAL_HOSTS.has(normalizedHost);

  if (!isHostApproved) {
    if (rawHost === DOCKER_TEST_HOST) {
      if (allowDocker) {
        isHostApproved = true;
      } else {
        return {
          isValid: false,
          sanitizedHost: rawHost,
          reason: `Host "${rawHost}" is a Docker service name. It is only permitted when explicit opt-in is enabled via TEST_ALLOW_DOCKER_HOST=true.`,
        };
      }
    } else {
      return {
        isValid: false,
        sanitizedHost: rawHost,
        reason: `Host "${rawHost}" is not an approved local test host. Only localhost, 127.0.0.1, and [::1] are permitted. Remote or Supabase hosts are strictly forbidden.`,
      };
    }
  }

  // 3. Validate database name (must end with '_test')
  const pathSegment = parsed.pathname.replace(/^\/+/, '');
  const dbName = pathSegment.split('/')[0]?.split('?')[0];

  if (!dbName) {
    return {
      isValid: false,
      sanitizedHost: rawHost,
      reason: 'Database name is missing from the connection URL.',
    };
  }

  if (!dbName.endsWith('_test')) {
    return {
      isValid: false,
      sanitizedHost: rawHost,
      databaseName: dbName,
      reason: `Database name "${dbName}" does not meet safety policy. Test database name must end with "_test" (e.g., "studysync_test") to prevent destructive actions against development or production databases.`,
    };
  }

  return {
    isValid: true,
    sanitizedHost: rawHost,
    databaseName: dbName,
  };
}

/**
 * Returns true if the database URL passes strict isolation validation.
 */
export function isSafeTestDatabase(
  url?: string,
  options?: DatabaseValidationOptions,
): boolean {
  return validateTestDatabaseUrl(url, options).isValid;
}

/**
 * Asserts that a database URL is safe for integration testing, or throws a detailed
 * sanitized error without leaking credentials or sensitive connection parameters.
 */
export function assertSafeTestDatabaseUrl(
  url?: string,
  options?: DatabaseValidationOptions,
): { hostname: string; dbName: string } {
  const result = validateTestDatabaseUrl(url, options);
  if (!result.isValid) {
    throw new Error(`SAFETY GUARD: ${result.reason}`);
  }
  return {
    hostname: result.sanitizedHost!,
    dbName: result.databaseName!,
  };
}

/**
 * Returns the configured development JWT signing secret, matching the application's configuration hierarchy.
 */
export function getDevSecret(): string {
  return (
    process.env.DEV_AUTH_SECRET ||
    process.env.SUPABASE_JWT_SECRET ||
    'local-studysync-dev-jwt-secret-do-not-use-in-prod-32c'
  );
}

/**
 * Generates a signed development JWT for test requests.
 * Uses the configured secret by default, or an override if testing wrong-secret rejection.
 */
export function createDevToken(
  userId: string,
  email: string = `${userId}@example.com`,
  username?: string,
  options?: { secret?: string; expiresIn?: jwt.SignOptions['expiresIn'] },
): string {
  const secret = options?.secret || getDevSecret();
  return jwt.sign(
    {
      sub: userId,
      email,
      user_metadata: {
        username: username || `user_${userId.slice(0, 8)}`,
      },
    },
    secret,
    {
      expiresIn: options?.expiresIn || '1d',
      algorithm: 'HS256',
    },
  );
}

/**
 * Initializes a full NestJS test application with safety guards against remote or non-test databases.
 * Fails closed if TEST_DATABASE_URL is not explicitly configured or fails safety checks.
 */
export async function createTestApp(
  options?: DatabaseValidationOptions,
): Promise<{ app: INestApplication; prisma: PrismaService }> {
  const testUrl = process.env.TEST_DATABASE_URL;

  if (!testUrl) {
    throw new Error(
      'SAFETY GUARD: TEST_DATABASE_URL is not set. ' +
        'Integration tests strictly require TEST_DATABASE_URL to be set to an isolated test database ' +
        'with a name ending in "_test" on an approved local host ' +
        '(e.g., TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/studysync_test?schema=public). ' +
        'Silently falling back to DATABASE_URL is strictly forbidden to protect application data.',
    );
  }

  // Validate TEST_DATABASE_URL BEFORE constructing TestingModule or PrismaClient
  assertSafeTestDatabaseUrl(testUrl, options);

  // Set DATABASE_URL to TEST_DATABASE_URL for PrismaService and AppModule
  process.env.DATABASE_URL = testUrl;

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.init();
  const prisma = app.get(PrismaService);
  return { app, prisma };
}

/**
 * Cleans database tables in reverse dependency order.
 * Fails closed if TEST_DATABASE_URL is missing, unsafe, or if the runtime connected database does not end in '_test'.
 */
export async function cleanDatabase(
  prisma: PrismaService,
  options?: DatabaseValidationOptions,
) {
  const testUrl = process.env.TEST_DATABASE_URL;

  if (!testUrl) {
    throw new Error(
      'CRITICAL SAFETY GUARD: TEST_DATABASE_URL is not set. ' +
        'Destructive test cleanup is strictly prohibited without an explicit, validated TEST_DATABASE_URL.',
    );
  }

  assertSafeTestDatabaseUrl(testUrl, options);

  // Runtime database query verification as secondary defense-in-depth
  const result = await prisma.$queryRaw<Array<{ current_database: string }>>`SELECT current_database();`;
  const connectedDb = result[0]?.current_database;
  if (!connectedDb || !connectedDb.endsWith('_test')) {
    throw new Error(
      `CRITICAL SAFETY GUARD: Connected database name "${connectedDb}" does not end with "_test". ` +
        'Destructive cleanup aborted to prevent accidental data loss.',
    );
  }

  // Clean tables in reverse dependency order
  await prisma.roomStudySessionParticipant.deleteMany();
  await prisma.roomStudySession.deleteMany();
  await prisma.message.deleteMany();
  await prisma.roomInvite.deleteMany();
  await prisma.roomMember.deleteMany();
  await prisma.room.deleteMany();
  await prisma.studySessionCategory.deleteMany();
  await prisma.studySessionLabel.deleteMany();
  await prisma.studySession.deleteMany();
  await prisma.timerSession.deleteMany();
  await prisma.sessionLabel.deleteMany();
  await prisma.sessionCategory.deleteMany();
  await prisma.userPreference.deleteMany();
  await prisma.timerMode.deleteMany({ where: { userId: { not: null } } });
  await prisma.profile.deleteMany();
}
