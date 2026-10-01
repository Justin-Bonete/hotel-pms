import { HttpStatus, Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { RequestContextStore } from '../../common/context/request-context';
import { AppException } from '../../common/http/app-exception';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(@Inject(ENV) env: Env) {
    super({ datasourceUrl: env.APP_DATABASE_URL });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  forTenant<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    const organizationId = RequestContextStore.get()?.organizationId;
    if (!organizationId) {
      throw new AppException(
        'TENANT_CONTEXT_MISSING',
        'This request has no organization context.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return this.forOrganization(organizationId, fn);
  }

  /** Explicit organization (background jobs, seeds run by the app, tests). */
  forOrganization<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
    if (!UUID.test(organizationId)) {
      throw new AppException('TENANT_CONTEXT_INVALID', 'Invalid organization context.', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    return this.$transaction(async (tx) => {
      // is_local = true: the setting dies with the transaction, so pooled connections never leak a tenant.
      await tx.$queryRaw`SELECT set_config('app.org_id', ${organizationId}, true)`;
      return fn(tx);
    });
  }

  withoutTenant<T>(reason: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
    this.logger.debug(`RLS bypass: ${reason}`);
    return this.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
      return fn(tx);
    });
  }
}
