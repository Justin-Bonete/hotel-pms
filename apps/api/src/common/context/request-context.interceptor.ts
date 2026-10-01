import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Observable } from 'rxjs';
import type { Response } from 'express';
import { AuthenticatedRequest, RequestContext, RequestContextStore } from './request-context';

/**
 * Runs after guards, so the authenticated user is known. Everything downstream (services, repositories,
 * PrismaService.forTenant, audit) reads the tenant from here. Register it FIRST so it wraps the others.
 */
@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<AuthenticatedRequest>();
    const res = http.getResponse<Response>();

    const ctx: RequestContext = {
      requestId: String(res.getHeader('x-request-id') ?? randomUUID()),
      ip: req.ip,
      userAgent: req.get('user-agent')?.slice(0, 255),
      userId: req.auth?.userId,
      organizationId: req.auth?.organizationId,
      familyId: req.auth?.familyId,
    };

    // The handler runs on subscribe, so subscribe INSIDE the context.
    return new Observable((subscriber) => RequestContextStore.run(ctx, () => next.handle().subscribe(subscriber)));
  }
}
