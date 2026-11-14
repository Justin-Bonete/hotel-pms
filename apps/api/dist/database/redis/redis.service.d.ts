import { OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import type { Env } from '../../config/env';
export declare class RedisService implements OnModuleDestroy {
    private readonly logger;
    readonly client: Redis;
    constructor(env: Env);
    onModuleDestroy(): void;
}
