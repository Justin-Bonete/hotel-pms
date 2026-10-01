import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RedisService } from '../../database/redis/redis.service';

export interface DependencyCheck {
  status: 'up' | 'down';
  latencyMs?: number;
  error?: string;
}

const TIMEOUT_MS = 2000;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timed out')), TIMEOUT_MS)),
  ]);
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async check(): Promise<Record<'database' | 'redis', DependencyCheck>> {
    const [database, redis] = await Promise.all([
      this.probe(() => this.prisma.$queryRaw`SELECT 1`),
      this.probe(() => this.redis.client.ping()),
    ]);
    return { database, redis };
  }

  private async probe(fn: () => Promise<unknown>): Promise<DependencyCheck> {
    const started = Date.now();
    try {
      await withTimeout(fn());
      return { status: 'up', latencyMs: Date.now() - started };
    } catch (err) {
      return { status: 'down', error: err instanceof Error ? err.message : 'unknown error' };
    }
  }
}
