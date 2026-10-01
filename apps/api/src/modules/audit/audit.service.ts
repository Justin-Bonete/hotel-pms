import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { RequestContextStore } from '../../common/context/request-context';
import type { Tx } from '../../database/prisma/prisma.service';

export interface AuditEntry {
  organizationId: string;
  actorId?: string | null;
  propertyId?: string;
  /** e.g. "auth.login", "property.update" */
  action: string;
  entity: string;
  entityId?: string;
  /** Never include passwords, hashes, tokens or MFA secrets in before/after. */
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
}

/** Writes inside the caller's transaction, so an action and its audit record commit or roll back together. */
@Injectable()
export class AuditService {
  async record(tx: Tx, entry: AuditEntry): Promise<void> {
    const ctx = RequestContextStore.get();
    await tx.auditLog.create({
      data: { ...entry, ip: ctx?.ip, userAgent: ctx?.userAgent },
      select: { id: true },
    });
  }
}
