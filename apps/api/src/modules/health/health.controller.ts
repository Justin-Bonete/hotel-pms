import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { HealthService } from './health.service';

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /** Liveness: the process is up. No dependencies touched. */
  @Get()
  liveness() {
    return { status: 'ok', uptimeSeconds: Math.round(process.uptime()) };
  }

  /** Readiness: database and Redis reachable. Returns 503 if any dependency is down. */
  @Get('ready')
  async readiness(@Res({ passthrough: true }) res: Response) {
    const checks = await this.health.check();
    const healthy = Object.values(checks).every((c) => c.status === 'up');
    if (!healthy) res.status(HttpStatus.SERVICE_UNAVAILABLE);
    return { status: healthy ? 'ok' : 'degraded', checks };
  }
}
