import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;

  constructor(@Inject(ENV) env: Env) {
    this.client = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2 });
    this.client.on('error', (err) => this.logger.warn(`Redis error: ${err.message}`));
  }

  onModuleDestroy(): void {
    this.client.disconnect();
  }
}
