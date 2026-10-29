import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

const SENSITIVE_KEYS = new Set([
  'authorization',
  'cookie',
  'token',
  'password',
  'secret',
  'key',
  'tokenhash',
  'token_hash',
  'supabase_jwt_secret',
  'dev_auth_secret',
]);

function redactSensitiveData(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(redactSensitiveData);
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      sanitized[key] = redactSensitiveData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    if (!req) {
      return next.handle();
    }

    const { method, url, ip } = req;
    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const res = ctx.getResponse();
          const statusCode = res?.statusCode || 200;
          const duration = Date.now() - now;
          this.logger.log(`${method} ${url} ${statusCode} - ${duration}ms [${ip}]`);
        },
        error: (err) => {
          const duration = Date.now() - now;
          const status = err?.status || err?.statusCode || 500;
          this.logger.warn(`${method} ${url} ${status} - ${duration}ms [${ip}] - ${err.message}`);
        },
      }),
    );
  }
}
