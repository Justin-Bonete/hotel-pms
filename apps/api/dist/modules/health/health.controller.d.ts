import type { Response } from 'express';
import { HealthService } from './health.service';
export declare class HealthController {
    private readonly health;
    constructor(health: HealthService);
    /** Liveness: the process is up. No dependencies touched. */
    liveness(): {
        status: string;
        uptimeSeconds: number;
    };
    /** Readiness: database and Redis reachable. Returns 503 if any dependency is down. */
    readiness(res: Response): Promise<{
        status: string;
        checks: Record<"database" | "redis", import("./health.service").DependencyCheck>;
    }>;
}
