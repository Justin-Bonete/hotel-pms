import { Injectable } from '@nestjs/common';
import type { PropertyGroupView } from '@pms/types';
import type { PropertyGroupInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { conflict, notFound } from '../../common/http/errors';
import { PrismaService, Tx } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const include = { _count: { select: { properties: { where: { deletedAt: null } } } } } as const;

@Injectable()
export class PropertyGroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<PropertyGroupView[]> {
    const groups = await this.prisma.forTenant((tx) =>
      tx.propertyGroup.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' }, include }),
    );
    return groups.map((g) => ({ id: g.id, name: g.name, propertyCount: g._count.properties }));
  }

  async create(dto: PropertyGroupInput, access: AccessContext): Promise<PropertyGroupView> {
    return this.prisma.forTenant(async (tx) => {
      await this.ensureNameFree(tx, dto.name);
      const g = await tx.propertyGroup.create({ data: { organizationId: access.organizationId, name: dto.name }, include });
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, action: 'property_group.created', entity: 'property_group', entityId: g.id, after: { name: g.name } });
      return { id: g.id, name: g.name, propertyCount: g._count.properties };
    });
  }

  async rename(id: string, dto: PropertyGroupInput, access: AccessContext): Promise<PropertyGroupView> {
    return this.prisma.forTenant(async (tx) => {
      const existing = await tx.propertyGroup.findFirst({ where: { id, deletedAt: null } });
      if (!existing) throw notFound('Property group');
      if (existing.name !== dto.name) await this.ensureNameFree(tx, dto.name);
      const g = await tx.propertyGroup.update({ where: { id }, data: { name: dto.name }, include });
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, action: 'property_group.renamed', entity: 'property_group', entityId: id, before: { name: existing.name }, after: { name: g.name } });
      return { id: g.id, name: g.name, propertyCount: g._count.properties };
    });
  }

  /** Groups are only labels, so an EMPTY group may be removed for real. */
  async remove(id: string, access: AccessContext): Promise<void> {
    await this.prisma.forTenant(async (tx) => {
      const g = await tx.propertyGroup.findFirst({ where: { id, deletedAt: null }, include });
      if (!g) throw notFound('Property group');
      if (g._count.properties > 0) throw conflict('GROUP_NOT_EMPTY', 'Move this group’s properties to another group first.');
      await tx.propertyGroup.delete({ where: { id } });
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, action: 'property_group.deleted', entity: 'property_group', entityId: id, before: { name: g.name } });
    });
  }

  private async ensureNameFree(tx: Tx, name: string): Promise<void> {
    const clash = await tx.propertyGroup.findFirst({ where: { name: { equals: name, mode: 'insensitive' }, deletedAt: null } });
    if (clash) throw conflict('GROUP_EXISTS', `A group named "${name}" already exists.`);
  }
}
