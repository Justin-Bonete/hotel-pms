import { PrismaService } from '../../database/prisma/prisma.service';
import { RedisService } from '../../database/redis/redis.service';
export interface DependencyCheck {
    status: 'up' | 'down';
    latencyMs?: number;
    error?: string;
}
export declare class HealthService {
    private readonly prisma;
    private readonly redis;
    constructor(prisma: PrismaService, redis: RedisService);
    check(): Promise<Record<'database' | 'redis', DependencyCheck>>;
    private probe;
}
