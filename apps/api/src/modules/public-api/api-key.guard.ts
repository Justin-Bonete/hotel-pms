import { CanActivate, ExecutionContext, HttpStatus, Injectable, createParamDecorator } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppException } from '../../common/http/app-exception';
import { ApiKeyAuth, ApiKeysService } from '../api-keys/api-keys.service';
import { PublicRateLimiter } from './public-rate-limiter';

export type ApiKeyRequest = Request & { apiKey?: ApiKeyAuth };

/** The key can arrive as "X-API-Key: pmsk_live_..." or "Authorization: Bearer pmsk_live_...". */
export function extractKey(req: Request): string | null {
  const direct = req.header('x-api-key');
  if (direct) return direct.trim();
  const auth = req.header('authorization');
  const match = auth ? /^Bearer\s+(\S+)$/i.exec(auth) : null;
  return match?.[1] ?? null;
}

/**
 * Authenticates the public booking API. Used with @Public() (so the staff-login guards stand aside) on routes
 * under /public. Every failure gives the same answer, so a guesser learns nothing about which part was wrong.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly keys: ApiKeysService,
    private readonly limiter: PublicRateLimiter,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const req = http.getRequest<ApiKeyRequest>();
    const res = http.getResponse<Response>();
    const ip = req.ip ?? 'unknown';

    if (await this.limiter.tooManyFailures(ip)) {
      res.setHeader('Retry-After', '600');
      throw new AppException('RATE_LIMITED', 'Too many invalid API keys from this address. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }
    const raw = extractKey(req);
    const auth = raw ? await this.keys.authenticate(raw) : null;
    if (!auth) {
      await this.limiter.recordFailure(ip);
      throw new AppException('INVALID_API_KEY', 'The API key is missing, wrong, expired or revoked.', HttpStatus.UNAUTHORIZED);
    }

    const hit = await this.limiter.hit('key', auth.id, 120, 60);
    res.setHeader('X-RateLimit-Limit', String(hit.limit));
    res.setHeader('X-RateLimit-Remaining', String(hit.remaining));
    if (!hit.allowed) {
      res.setHeader('Retry-After', String(hit.retryAfterSeconds));
      throw new AppException('RATE_LIMITED', 'Too many requests. Slow down and try again shortly.', HttpStatus.TOO_MANY_REQUESTS);
    }
    req.apiKey = auth;
    return true;
  }
}

export const ApiKey = createParamDecorator((_data: unknown, ctx: ExecutionContext): ApiKeyAuth => ctx.switchToHttp().getRequest<ApiKeyRequest>().apiKey as ApiKeyAuth);
