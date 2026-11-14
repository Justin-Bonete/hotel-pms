import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisService } from '../../../database/redis/redis.service';
/** Fixed-window limiter in Redis, per bucket name + client IP. Fails OPEN if Redis is unreachable. */
export declare class RateLimitGuard implements CanActivate {
    private readonly reflector;
    private readonly redis;
    private readonly logger;
    constructor(reflector: Reflector, redis: RedisService);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
