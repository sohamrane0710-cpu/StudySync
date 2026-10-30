export interface AppConfig {
  port: number;
  nodeEnv: string;
  apiPrefix: string;
  corsOrigin: string;
  databaseUrl: string;
  authMode: 'supabase' | 'dev';
  supabaseUrl?: string;
  supabaseJwtSecret?: string;
  devAuthSecret?: string;
}

export default (): AppConfig => ({
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiPrefix: process.env.API_PREFIX || 'api/v1',
  corsOrigin: process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173,http://localhost:5174'),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/studysync?schema=public',
  authMode: (process.env.AUTH_MODE as 'supabase' | 'dev') || 'dev',
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseJwtSecret: process.env.SUPABASE_JWT_SECRET,
  devAuthSecret: process.env.DEV_AUTH_SECRET || 'local-studysync-dev-jwt-secret-do-not-use-in-prod-32c',
});
