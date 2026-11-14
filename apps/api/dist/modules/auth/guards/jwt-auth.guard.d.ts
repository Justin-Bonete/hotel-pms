import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisService } from '../../../database/redis/redis.service';
import { TokenService } from '../token.service';
export declare const revokedFamilyKey: (familyId: string) => string;
/** Global guard: every route requires a valid access token unless marked @Public(). */
export declare class JwtAuthGuard implements CanActivate {
    private readonly reflector;
    private readonly tokens;
    private readonly redis;
    constructor(reflector: Reflector, tokens: TokenService, redis: RedisService);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
