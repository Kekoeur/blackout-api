import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiErrorResponse } from '../interfaces/api-error.interface';

/**
 * Global exception filter for standardized error responses.
 * Catches all HTTP exceptions and formats them consistently.
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Extract message from exception response
    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as any).message || exception.message;

    const errorResponse: ApiErrorResponse = {
      statusCode: status,
      message,
      error: exception.name,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // Log errors (but not authentication failures to avoid log spam)
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} - ${status} - ${message}`,
        exception.stack,
      );
    } else if (status !== HttpStatus.UNAUTHORIZED && status !== HttpStatus.FORBIDDEN) {
      this.logger.warn(
        `${request.method} ${request.url} - ${status} - ${message}`,
      );
    }

    response.status(status).json(errorResponse);
  }
}
