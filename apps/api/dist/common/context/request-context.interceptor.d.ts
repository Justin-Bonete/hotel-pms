import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
/**
 * Runs after guards, so the authenticated user is known. Everything downstream (services, repositories,
 * PrismaService.forTenant, audit) reads the tenant from here. Register it FIRST so it wraps the others.
 */
export declare class RequestContextInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown>;
}
