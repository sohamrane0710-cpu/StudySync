import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, any>;
        message = resp.message || exception.message;
        error = resp.error || exception.name;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      this.logger.error(
        `Prisma database error [${exception.code}] on ${request.method} ${request.url}: ${exception.message}`,
        exception.stack,
      );

      switch (exception.code) {
        case 'P2002': {
          status = HttpStatus.CONFLICT;
          error = 'Conflict';
          const target = exception.meta?.target;
          const fields = Array.isArray(target) ? target.join(', ') : target ? String(target) : 'field';
          message = `Unique constraint violation: resource with this ${fields} already exists`;
          break;
        }
        case 'P2025': {
          status = HttpStatus.NOT_FOUND;
          error = 'Not Found';
          message = 'The requested resource was not found or has been removed';
          break;
        }
        case 'P2003': {
          status = HttpStatus.CONFLICT;
          error = 'Conflict';
          message = 'Database relational constraint prevented this operation';
          break;
        }
        case 'P2000': {
          status = HttpStatus.BAD_REQUEST;
          error = 'Bad Request';
          message = 'Supplied value exceeds maximum allowed field length';
          break;
        }
        case 'P2014': {
          status = HttpStatus.CONFLICT;
          error = 'Conflict';
          message = 'The required relation constraint was violated';
          break;
        }
        default: {
          status = HttpStatus.INTERNAL_SERVER_ERROR;
          error = 'Internal Server Error';
          message =
            process.env.NODE_ENV !== 'production'
              ? `Database operation failed [${exception.code}]`
              : 'Database operation failed';
          break;
        }
      }
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      this.logger.error(
        `Prisma validation error on ${request.method} ${request.url}: ${exception.message}`,
      );
      status = HttpStatus.BAD_REQUEST;
      error = 'Bad Request';
      message = 'Invalid request parameters or payload structure';
    } else if (exception instanceof Error) {
      this.logger.error(
        `Unhandled Error on ${request.method} ${request.url}: ${exception.message}`,
        exception.stack,
      );

      // In development or test, provide the error message for debugging; in production hide details
      if (process.env.NODE_ENV !== 'production') {
        message = exception.message;
      }
    }

    response.status(status).json({
      statusCode: status,
      error,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
