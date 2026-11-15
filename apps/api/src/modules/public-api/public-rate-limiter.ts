import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../database/redis/redis.service';

export interface Hit {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

/** Fixed-window counters in Redis. Fails OPEN when Redis is down (an outage must not take bookings offline). */
@Injectable()
export class PublicRateLimiter {
  private readonly logger = new Logger('PublicApi');

  constructor(private readonly redis: RedisService) {}

  async hit(bucket: string, id: string, limit: number, windowSeconds: number): Promise<Hit> {
    const key = `prl:${bucket}:${id}`;
    try {
      const r = await this.redis.client.multi().incr(key).expire(key, windowSeconds, 'NX').ttl(key).exec();
      const count = Number(r?.[0]?.[1] ?? 0);
      const ttl = Math.max(Number(r?.[2]?.[1] ?? windowSeconds), 1);
      return { allowed: count <= limit, limit, remaining: Math.max(limit - count, 0), retryAfterSeconds: ttl };
    } catch (err) {
      this.logger.warn(`Rate limiter unavailable, allowing request: ${(err as Error).message}`);
      return { allowed: true, limit, remaining: limit, retryAfterSeconds: windowSeconds };
    }
  }

  /** Failed key attempts per IP, to slow down someone guessing keys. */
  async tooManyFailures(ip: string): Promise<boolean> {
    try {
      return Number((await this.redis.client.get(`pub-fail:${ip}`)) ?? 0) >= 20;
    } catch {
      return false;
    }
  }

  async recordFailure(ip: string): Promise<void> {
    try {
      await this.redis.client.multi().incr(`pub-fail:${ip}`).expire(`pub-fail:${ip}`, 600, 'NX').exec();
    } catch {
      /* best effort */
    }
  }
}
