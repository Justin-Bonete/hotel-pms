import { CanActivate, ExecutionContext, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { AppException } from '../../../common/http/app-exception';
import { RedisService } from '../../../database/redis/redis.service';
import { RATE_LIMIT, RateLimitOptions } from '../decorators/rate-limit.decorator';

/** Fixed-window limiter in Redis, per bucket name + client IP. Fails OPEN if Redis is unreachable. */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(RATE_LIMIT, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!options) return true;

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const key = `rl:${options.name}:${req.ip ?? 'unknown'}`;

    let count = 0;
    let ttl = options.windowSeconds;
    try {
      const results = await this.redis.client.multi().incr(key).expire(key, options.windowSeconds, 'NX').ttl(key).exec();
      count = Number(results?.[0]?.[1] ?? 0);
      ttl = Number(results?.[2]?.[1] ?? options.windowSeconds);
    } catch (err) {
      this.logger.warn(`Rate limiter unavailable, allowing request: ${(err as Error).message}`);
      return true;
    }

    if (count > options.limit) {
      res.setHeader('Retry-After', String(Math.max(ttl, 1)));
      throw new AppException(
        'RATE_LIMITED',
        `Too many attempts. Please try again in ${Math.max(Math.ceil(ttl / 60), 1)} minute(s).`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
