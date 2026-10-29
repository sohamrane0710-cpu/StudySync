import { plainToInstance } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, validateSync } from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

enum AuthMode {
  Supabase = 'supabase',
  Dev = 'dev',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  PORT: number = 3000;

  @IsString()
  @IsOptional()
  API_PREFIX: string = 'api/v1';

  @IsString()
  @IsOptional()
  CORS_ORIGIN: string = 'http://localhost:5173';

  @IsString()
  DATABASE_URL: string;

  @IsEnum(AuthMode)
  @IsOptional()
  AUTH_MODE: AuthMode = AuthMode.Dev;

  @IsString()
  @IsOptional()
  SUPABASE_URL?: string;

  @IsString()
  @IsOptional()
  SUPABASE_JWT_SECRET?: string;

  @IsString()
  @IsOptional()
  DEV_AUTH_SECRET?: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(`Environment validation failed: ${errors.toString()}`);
  }

  // Security guardrail: fail closed if dev auth is enabled in production
  if (
    validatedConfig.NODE_ENV === Environment.Production &&
    validatedConfig.AUTH_MODE === AuthMode.Dev
  ) {
    throw new Error(
      'CRITICAL SECURITY ERROR: AUTH_MODE cannot be set to "dev" in production environment. Configure Supabase authentication.',
    );
  }

  return validatedConfig;
}
