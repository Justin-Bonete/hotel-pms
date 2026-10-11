import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { TaxView } from '@pms/types';
import type { TaxInput, UpdateTaxInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { assertCan } from '../../common/access/assert-access';
import { changedFields } from '../../common/audit/changed-fields';
import { conflict, notFound } from '../../common/http/errors';
import { PrismaService, Tx } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const toView = (t: { id: string; propertyId: string; name: string; rateBps: number; appliesToRoom: boolean; appliesToExtras: boolean; isActive: boolean }): TaxView => ({
  id: t.id, propertyId: t.propertyId, name: t.name, rateBps: t.rateBps, appliesToRoom: t.appliesToRoom, appliesToExtras: t.appliesToExtras, isActive: t.isActive,
});

@Injectable()
export class TaxesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(propertyId: string, access: AccessContext): Promise<TaxView[]> {
    assertCan(access, 'rate.read', propertyId);
    const rows = await this.prisma.forTenant(async (tx) => {
      await this.requireProperty(tx, propertyId);
      return tx.tax.findMany({ where: { propertyId, deletedAt: null }, orderBy: { name: 'asc' } });
    });
    return rows.map(toView);
  }

  /** Taxes apply to charges posted AFTER the change. Lines already on a folio are never rewritten. */
  async create(propertyId: string, dto: TaxInput, access: AccessContext): Promise<TaxView> {
    assertCan(access, 'tax.manage', propertyId);
    return this.prisma.forTenant(async (tx) => {
      await this.requireProperty(tx, propertyId);
      await this.ensureNameFree(tx, propertyId, dto.name);
      const row = await tx.tax.create({ data: { organizationId: access.organizationId, propertyId, ...dto } });
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId, action: 'tax.created', entity: 'tax', entityId: row.id, after: { name: row.name, rateBps: row.rateBps } });
      return toView(row);
    });
  }

  async update(id: string, dto: UpdateTaxInput, access: AccessContext): Promise<TaxView> {
    return this.prisma.forTenant(async (tx) => {
      const existing = await tx.tax.findFirst({ where: { id, deletedAt: null } });
      if (!existing) throw notFound('Tax');
      assertCan(access, 'tax.manage', existing.propertyId);
      if (dto.name !== undefined && dto.name.toLowerCase() !== existing.name.toLowerCase()) await this.ensureNameFree(tx, existing.propertyId, dto.name);
      const data: Prisma.TaxUncheckedUpdateInput = { ...dto };
      const row = await tx.tax.update({ where: { id }, data });
      const diff = changedFields(existing, row, ['name', 'rateBps', 'appliesToRoom', 'appliesToExtras', 'isActive'] as const);
      if (diff.changed.length > 0) {
        await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId: row.propertyId, action: 'tax.updated', entity: 'tax', entityId: id, before: diff.before, after: diff.after });
      }
      return toView(row);
    });
  }

  async archive(id: string, access: AccessContext): Promise<void> {
    await this.prisma.forTenant(async (tx) => {
      const existing = await tx.tax.findFirst({ where: { id, deletedAt: null } });
      if (!existing) throw notFound('Tax');
      assertCan(access, 'tax.manage', existing.propertyId);
      await tx.tax.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId: existing.propertyId, action: 'tax.archived', entity: 'tax', entityId: id, before: { name: existing.name } });
    });
  }

  private async requireProperty(tx: Tx, propertyId: string): Promise<void> {
    if ((await tx.property.count({ where: { id: propertyId, deletedAt: null } })) === 0) throw notFound('Property');
  }

  private async ensureNameFree(tx: Tx, propertyId: string, name: string): Promise<void> {
    if (await tx.tax.findFirst({ where: { propertyId, deletedAt: null, name: { equals: name, mode: 'insensitive' } }, select: { id: true } })) {
      throw conflict('TAX_EXISTS', `A tax named "${name}" already exists at this property.`);
    }
  }
}
