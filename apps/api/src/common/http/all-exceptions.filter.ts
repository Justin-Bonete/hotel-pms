import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { AppException } from './app-exception';

interface ErrorBody {
  code: string;
  message: string;
  details?: unknown[];
}

const STATUS_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE',
  429: 'RATE_LIMITED',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const res = http.getResponse<Response>();
    const req = http.getRequest<Request>();
    const requestId = res.getHeader('x-request-id') as string | undefined;

    const { status, body } = this.translate(exception, requestId);

    if (status >= 500) {
      const err = exception instanceof Error ? exception : new Error(String(exception));
      this.logger.error(`[${requestId}] ${req.method} ${req.url}: ${err.message}`, err.stack);
    }

    res.status(status).json({ error: { ...body, requestId } });
  }

  private translate(exception: unknown, requestId?: string): { status: number; body: ErrorBody } {
    if (exception instanceof AppException) {
      return {
        status: exception.getStatus(),
        body: { code: exception.code, message: exception.message, details: exception.details },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const raw = typeof response === 'string' ? response : (response as { message?: string | string[] }).message;
      const message = Array.isArray(raw) ? raw.join('; ') : (raw ?? exception.message);
      return { status, body: { code: STATUS_CODES[status] ?? 'HTTP_ERROR', message } };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          return {
            status: HttpStatus.CONFLICT,
            body: { code: 'ALREADY_EXISTS', message: 'A record with these values already exists.' },
          };
        case 'P2025':
          return {
            status: HttpStatus.NOT_FOUND,
            body: { code: 'NOT_FOUND', message: 'The requested record was not found.' },
          };
        case 'P2003':
          return {
            status: HttpStatus.CONFLICT,
            body: { code: 'REFERENCE_CONFLICT', message: 'This record is linked to other data and cannot be changed this way.' },
          };
      }
    }

    // Unknown failure: never leak internals, always give a reference the user can quote.
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        code: 'INTERNAL_ERROR',
        message: `Something went wrong on our side. Please try again. If it keeps happening, contact support and quote reference ${requestId ?? 'unavailable'}.`,
      },
    };
  }
}
