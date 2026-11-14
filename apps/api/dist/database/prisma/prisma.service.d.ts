import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import type { Env } from '../../config/env';
export type Tx = Prisma.TransactionClient;
/**
 * The ONLY door to the database.
 *
 * Connects as pms_app, so PostgreSQL Row-Level Security applies. Repositories must run queries
 * through one of the two helpers below; each opens a transaction and sets the tenant for it:
 *
 *   forTenant(fn)          tenant taken from the authenticated request (normal path)
 *   withoutTenant(why, fn) RLS bypass for flows that run before a tenant is known
 *                          (login, refresh, register, password reset). Keep usages few and reviewed.
 *
 * Using the bare client (this.prisma.user.findMany) would see zero tenant rows, which is the safe failure.
 */
export declare class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private readonly logger;
    private readonly commitQueue;
    constructor(env: Env);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    forTenant<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
    /** Explicit organization (background jobs, seeds run by the app, tests). */
    forOrganization<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T>;
    /**
     * Queue a side effect (e.g. a realtime event) to run only AFTER the surrounding forTenant/withoutTenant
     * transaction has committed. If it rolls back, the effect never happens. Outside a transaction it runs now.
     */
    afterCommit(effect: () => void): void;
    private runCommitted;
    withoutTenant<T>(reason: string, fn: (tx: Tx) => Promise<T>): Promise<T>;
}
