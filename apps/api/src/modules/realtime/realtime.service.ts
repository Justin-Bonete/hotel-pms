import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { RealtimeEvent, RealtimeEventType } from '@pms/types';
import type Redis from 'ioredis';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RedisService } from '../../database/redis/redis.service';

type Listener = (organizationId: string, event: RealtimeEvent) => void;

/**
 * Live updates. Events are published to Redis (so every API instance sees them) and pushed to connected
 * browsers over Server-Sent Events. Events carry ids only; clients refetch through the normal, permission-checked API.
 */
@Injectable()
export class RealtimeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeService.name);
  private subscriber?: Redis;
  private readonly listeners = new Set<Listener>();

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      this.subscriber = this.redis.client.duplicate();
      this.subscriber.on('error', (err: Error) => this.logger.warn(`Realtime subscriber error: ${err.message}`));
      await this.subscriber.psubscribe('rt:*');
      this.subscriber.on('pmessage', (_pattern: string, channel: string, message: string) => {
        try {
          const event = JSON.parse(message) as RealtimeEvent;
          const organizationId = channel.slice('rt:'.length);
          for (const listener of this.listeners) listener(organizationId, event);
        } catch (err) {
          this.logger.warn(`Ignoring malformed realtime message: ${(err as Error).message}`);
        }
      });
    } catch (err) {
      // The app keeps working without live updates; screens still refresh on a timer.
      this.logger.warn(`Realtime disabled: ${(err as Error).message}`);
    }
  }

  onModuleDestroy(): void {
    this.subscriber?.disconnect();
  }

  /** Call from inside a transaction: the event is sent only if (and after) the transaction commits. */
  emit(organizationId: string, type: RealtimeEventType, propertyId: string, ids: string[]): void {
    this.prisma.afterCommit(() => {
      const event: RealtimeEvent = { type, propertyId, ids, at: new Date().toISOString() };
      this.redis.client.publish(`rt:${organizationId}`, JSON.stringify(event)).catch((err: Error) => {
        this.logger.warn(`Could not publish ${type}: ${err.message}`);
      });
    });
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
