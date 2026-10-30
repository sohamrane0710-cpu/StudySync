import {
  assertSafeTestDatabaseUrl,
  cleanDatabase,
  createTestApp,
  isSafeTestDatabase,
  validateTestDatabaseUrl,
} from './test-helper';
import { PrismaService } from '../src/database/prisma.service';

describe('Test Database Safety Isolation Guard (Unit & Adversarial Tests)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Clone process.env to isolate tests
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Adversarial URL Rejection (Remote & Spoofed Hosts)', () => {
    it('rejects a real-looking remote Supabase transaction pooler URL', () => {
      const supabasePoolerUrl =
        'postgresql://postgres.myprojectref:supersecretpassword123@aws-0-us-east-1.pooler.supabase.com:6543/studysync_test';
      const result = validateTestDatabaseUrl(supabasePoolerUrl);

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('is not an approved local test host');
      expect(result.reason).not.toContain('supersecretpassword123');
      expect(isSafeTestDatabase(supabasePoolerUrl)).toBe(false);
      expect(() => assertSafeTestDatabaseUrl(supabasePoolerUrl)).toThrow(
        /is not an approved local test host/,
      );
    });

    it('rejects a real-looking direct Supabase cloud URL', () => {
      const supabaseDirectUrl =
        'postgresql://postgres:dbsecretpass999@db.abcdefghijklmno.supabase.co:5432/studysync_test';
      const result = validateTestDatabaseUrl(supabaseDirectUrl);

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('is not an approved local test host');
      expect(result.reason).not.toContain('dbsecretpass999');
      expect(isSafeTestDatabase(supabaseDirectUrl)).toBe(false);
    });

    it('rejects an arbitrary remote cloud PostgreSQL database', () => {
      const cloudUrl =
        'postgresql://admin:prodsecret@rds.us-west-2.amazonaws.com:5432/studysync_test';
      const result = validateTestDatabaseUrl(cloudUrl);

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('is not an approved local test host');
      expect(result.reason).not.toContain('prodsecret');
    });

    it('rejects hostnames containing "localhost" as a substring (subdomain spoofing)', () => {
      const spoofedUrls = [
        'postgresql://postgres:pass@localhost.attacker.com:5432/studysync_test',
        'postgresql://postgres:pass@evil-localhost.net:5432/studysync_test',
        'postgresql://postgres:pass@fake-localhost:5432/studysync_test',
        'postgresql://postgres:pass@my-localhost-domain.io:5432/studysync_test',
        'postgresql://postgres:pass@attacker.com/localhost/studysync_test',
      ];

      for (const url of spoofedUrls) {
        const result = validateTestDatabaseUrl(url);
        expect(result.isValid).toBe(false);
        expect(isSafeTestDatabase(url)).toBe(false);
        expect(() => assertSafeTestDatabaseUrl(url)).toThrow(
          /is not an approved local test host/,
        );
      }
    });

    it('rejects hostnames containing "127.0.0.1" as a substring', () => {
      const spoofedIps = [
        'postgresql://postgres:pass@127.0.0.1.attacker.com:5432/studysync_test',
        'postgresql://postgres:pass@attacker127.0.0.1.com:5432/studysync_test',
        'postgresql://postgres:pass@127.0.0.1.nip.io:5432/studysync_test',
        'postgresql://postgres:pass@subdomain.127.0.0.1.sslip.io:5432/studysync_test',
      ];

      for (const url of spoofedIps) {
        const result = validateTestDatabaseUrl(url);
        expect(result.isValid).toBe(false);
        expect(isSafeTestDatabase(url)).toBe(false);
        expect(() => assertSafeTestDatabaseUrl(url)).toThrow(
          /is not an approved local test host/,
        );
      }
    });
  });

  describe('Malformed URLs, Empty Values, and Unsupported Protocols', () => {
    it('rejects undefined, null, empty string, or whitespace-only inputs', () => {
      expect(validateTestDatabaseUrl(undefined).isValid).toBe(false);
      expect(validateTestDatabaseUrl('').isValid).toBe(false);
      expect(validateTestDatabaseUrl('   ').isValid).toBe(false);
      expect(isSafeTestDatabase(undefined)).toBe(false);
      expect(isSafeTestDatabase('')).toBe(false);

      expect(() => assertSafeTestDatabaseUrl(undefined)).toThrow(
        /missing or empty/,
      );
      expect(() => assertSafeTestDatabaseUrl('')).toThrow(/missing or empty/);
    });

    it('rejects malformed URLs that cannot be parsed', () => {
      const malformedUrls = ['not-a-valid-url', '://missing-scheme', 'postgre:/broken', 'http:///'];

      for (const url of malformedUrls) {
        const result = validateTestDatabaseUrl(url);
        expect(result.isValid).toBe(false);
        expect(isSafeTestDatabase(url)).toBe(false);
      }
    });

    it('rejects unsupported protocols (e.g. http, https, ftp, mysql)', () => {
      const invalidProtocols = [
        'http://localhost:5432/studysync_test',
        'https://localhost:5432/studysync_test',
        'ftp://localhost:5432/studysync_test',
        'mysql://localhost:3306/studysync_test',
      ];

      for (const url of invalidProtocols) {
        const result = validateTestDatabaseUrl(url);
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('Unsupported protocol');
        expect(isSafeTestDatabase(url)).toBe(false);
      }
    });

    it('rejects URLs missing a database name', () => {
      const noDbUrls = [
        'postgresql://postgres:pass@localhost:5432',
        'postgresql://postgres:pass@localhost:5432/',
        'postgresql://postgres:pass@localhost:5432/?schema=public',
      ];

      for (const url of noDbUrls) {
        const result = validateTestDatabaseUrl(url);
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('Database name is missing');
      }
    });
  });

  describe('Local Development Database Policy Enforcement (_test Suffix)', () => {
    it('rejects local development database "studysync" because it lacks "_test" suffix', () => {
      const devDbUrl =
        'postgresql://postgres:postgres@localhost:5432/studysync?schema=public';
      const result = validateTestDatabaseUrl(devDbUrl);

      expect(result.isValid).toBe(false);
      expect(result.databaseName).toBe('studysync');
      expect(result.reason).toContain('does not meet safety policy');
      expect(result.reason).toContain('must end with "_test"');
      expect(isSafeTestDatabase(devDbUrl)).toBe(false);
      expect(() => assertSafeTestDatabaseUrl(devDbUrl)).toThrow(
        /must end with "_test"/,
      );
    });

    it('rejects default postgres database "postgres" on local host', () => {
      const postgresDbUrl = 'postgresql://postgres:postgres@127.0.0.1:5432/postgres';
      const result = validateTestDatabaseUrl(postgresDbUrl);

      expect(result.isValid).toBe(false);
      expect(result.databaseName).toBe('postgres');
      expect(result.reason).toContain('must end with "_test"');
    });

    it('rejects arbitrary non-test database names even on localhost', () => {
      const nonTestDbs = [
        'postgresql://postgres:pass@localhost:5432/production',
        'postgresql://postgres:pass@localhost:5432/studysync_dev',
        'postgresql://postgres:pass@localhost:5432/studysync_staging',
        'postgresql://postgres:pass@localhost:5432/testing_studysync', // prefix does not satisfy suffix rule
      ];

      for (const url of nonTestDbs) {
        const result = validateTestDatabaseUrl(url);
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('must end with "_test"');
      }
    });
  });

  describe('Approved Local Test Hosts (Positive Cases)', () => {
    it('accepts localhost with database ending in _test', () => {
      const validUrl =
        'postgresql://postgres:postgres@localhost:5432/studysync_test?schema=public';
      const result = validateTestDatabaseUrl(validUrl);

      expect(result.isValid).toBe(true);
      expect(result.sanitizedHost).toBe('localhost');
      expect(result.databaseName).toBe('studysync_test');
      expect(isSafeTestDatabase(validUrl)).toBe(true);
      expect(() => assertSafeTestDatabaseUrl(validUrl)).not.toThrow();
    });

    it('accepts 127.0.0.1 with database ending in _test', () => {
      const validUrl =
        'postgres://custom_user:custom_pass@127.0.0.1:5432/studysync_test';
      const result = validateTestDatabaseUrl(validUrl);

      expect(result.isValid).toBe(true);
      expect(result.sanitizedHost).toBe('127.0.0.1');
      expect(result.databaseName).toBe('studysync_test');
      expect(isSafeTestDatabase(validUrl)).toBe(true);
    });

    it('accepts IPv6 [::1] with database ending in _test', () => {
      const validIpv6Url =
        'postgresql://postgres:postgres@[::1]:5432/studysync_test';
      const result = validateTestDatabaseUrl(validIpv6Url);

      expect(result.isValid).toBe(true);
      expect(result.databaseName).toBe('studysync_test');
      expect(isSafeTestDatabase(validIpv6Url)).toBe(true);
    });

    it('manages Docker hostname "postgres" strictly through explicit opt-in', () => {
      const dockerUrl =
        'postgresql://postgres:postgres@postgres:5432/studysync_test';

      // 1. Without opt-in, it must be rejected
      delete process.env.TEST_ALLOW_DOCKER_HOST;
      const rejectedResult = validateTestDatabaseUrl(dockerUrl);
      expect(rejectedResult.isValid).toBe(false);
      expect(rejectedResult.reason).toContain('TEST_ALLOW_DOCKER_HOST=true');

      // 2. With opt-in via options parameter, it is approved
      const approvedViaOption = validateTestDatabaseUrl(dockerUrl, {
        allowDockerHost: true,
      });
      expect(approvedViaOption.isValid).toBe(true);
      expect(approvedViaOption.sanitizedHost).toBe('postgres');

      // 3. With opt-in via environment variable, it is approved
      process.env.TEST_ALLOW_DOCKER_HOST = 'true';
      const approvedViaEnv = validateTestDatabaseUrl(dockerUrl);
      expect(approvedViaEnv.isValid).toBe(true);
    });
  });

  describe('Pre-Connection Safety Guards (Fail Closed Before Prisma/App Initialisation)', () => {
    it('createTestApp() throws immediately when TEST_DATABASE_URL is not set', async () => {
      delete process.env.TEST_DATABASE_URL;
      // Even if DATABASE_URL is set (simulating local .env pointing to Supabase or dev)
      process.env.DATABASE_URL =
        'postgresql://postgres:pass@db.myproject.supabase.co:5432/postgres';

      await expect(createTestApp()).rejects.toThrow(
        /SAFETY GUARD: TEST_DATABASE_URL is not set/,
      );
    });

    it('createTestApp() throws immediately when TEST_DATABASE_URL is unsafe without connecting', async () => {
      // Unsafe remote Supabase URL
      process.env.TEST_DATABASE_URL =
        'postgresql://postgres:secret@db.project.supabase.co:5432/studysync_test';

      await expect(createTestApp()).rejects.toThrow(
        /is not an approved local test host/,
      );
    });

    it('createTestApp() throws immediately when TEST_DATABASE_URL points to dev database (not _test)', async () => {
      process.env.TEST_DATABASE_URL =
        'postgresql://postgres:postgres@localhost:5432/studysync';

      await expect(createTestApp()).rejects.toThrow(/must end with "_test"/);
    });

    it('cleanDatabase() throws immediately when TEST_DATABASE_URL is missing without running deletes', async () => {
      delete process.env.TEST_DATABASE_URL;

      const mockPrisma = {
        $queryRaw: jest.fn(),
        profile: { deleteMany: jest.fn() },
      } as unknown as PrismaService;

      await expect(cleanDatabase(mockPrisma)).rejects.toThrow(
        /CRITICAL SAFETY GUARD: TEST_DATABASE_URL is not set/,
      );
      expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('cleanDatabase() throws immediately when TEST_DATABASE_URL is unsafe without running deletes', async () => {
      process.env.TEST_DATABASE_URL =
        'postgresql://postgres:postgres@localhost.attacker.com:5432/studysync_test';

      const mockPrisma = {
        $queryRaw: jest.fn(),
        profile: { deleteMany: jest.fn() },
      } as unknown as PrismaService;

      await expect(cleanDatabase(mockPrisma)).rejects.toThrow(
        /is not an approved local test host/,
      );
      expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('cleanDatabase() aborts if runtime connected database does not end with "_test"', async () => {
      process.env.TEST_DATABASE_URL =
        'postgresql://postgres:postgres@localhost:5432/studysync_test';

      // Simulate a scenario where query returns non-test database name
      const mockPrisma = {
        $queryRaw: jest.fn().mockResolvedValue([{ current_database: 'studysync_production' }]),
        profile: { deleteMany: jest.fn() },
      } as unknown as PrismaService;

      await expect(cleanDatabase(mockPrisma)).rejects.toThrow(
        /CRITICAL SAFETY GUARD: Connected database name "studysync_production" does not end with "_test"/,
      );
      expect(mockPrisma.profile.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('Credential and Secret Redaction Verification', () => {
    it('never prints database passwords or full connection string in error messages', () => {
      const sensitivePassword = 'SuperSecretDbPasswordThatMustNeverBeLogged999';
      const url = `postgresql://postgres:${sensitivePassword}@db.myproject.supabase.co:5432/studysync_test`;

      try {
        assertSafeTestDatabaseUrl(url);
        fail('Should have thrown safety error');
      } catch (err: any) {
        expect(err.message).not.toContain(sensitivePassword);
        expect(err.message).not.toContain('postgres:');
        expect(err.message).toContain('is not an approved local test host');
      }

      // Also verify when URL contains special characters causing parse failure
      const specialPassUrl = 'postgresql://postgres:pass#with#hash@db.supabase.co:5432/studysync_test';
      try {
        assertSafeTestDatabaseUrl(specialPassUrl);
        fail('Should have thrown safety error');
      } catch (err: any) {
        expect(err.message).not.toContain('pass#with#hash');
        expect(err.message).toContain('Malformed or invalid database connection URL format');
      }
    });
  });
});
