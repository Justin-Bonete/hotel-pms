import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { RealtimeEvent, RealtimeEventType } from '@pms/types';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RedisService } from '../../database/redis/redis.service';
type Listener = (organizationId: string, event: RealtimeEvent) => void;
/**
 * Live updates. Events are published to Redis (so every API instance sees them) and pushed to connected
 * browsers over Server-Sent Events. Events carry ids only; clients refetch through the normal, permission-checked API.
 */
export declare class RealtimeService implements OnModuleInit, OnModuleDestroy {
    private readonly redis;
    private readonly prisma;
    private readonly logger;
    private subscriber?;
    private readonly listeners;
    constructor(redis: RedisService, prisma: PrismaService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): void;
    /** Call from inside a transaction: the event is sent only if (and after) the transaction commits. */
    emit(organizationId: string, type: RealtimeEventType, propertyId: string, ids: string[]): void;
    subscribe(listener: Listener): () => void;
}
export {};
