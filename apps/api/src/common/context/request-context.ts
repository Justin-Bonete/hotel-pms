import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { AccessContext } from '../access/access-context';

/** Filled by JwtAuthGuard on the request object; copied into the context by the interceptor. */
export interface AuthContext {
  userId: string;
  organizationId: string;
  /** Login family of the access token (one per device sign-in). */
  familyId: string;
}

export type AuthenticatedRequest = Request & { auth?: AuthContext; access?: AccessContext };

/** Per-request state available anywhere on the server without passing it around. */
export interface RequestContext {
  requestId: string;
  organizationId?: string;
  propertyId?: string | 'ALL';
  userId?: string;
  familyId?: string;
  /** What the user may do. Set by PermissionsGuard on routes that declare a permission. */
  access?: AccessContext;
  ip?: string;
  userAgent?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export const RequestContextStore = {
  run<T>(ctx: RequestContext, fn: () => T): T {
    return storage.run(ctx, fn);
  },
  get(): RequestContext | undefined {
    return storage.getStore();
  },
};

const REQUEST_ID = /^[\w-]{8,64}$/;

/**
 * Only tags the request with an id (response header). The AsyncLocalStorage context is created later by
 * RequestContextInterceptor, because body parsers can drop async context that was opened this early.
 */
export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('x-request-id');
  res.setHeader('x-request-id', incoming && REQUEST_ID.test(incoming) ? incoming : randomUUID());
  next();
}
