import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { OPEN_PURCHASE_STATUSES, type SupplierView } from '@pms/types';
import type { SupplierInput, UpdateSupplierInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { changedFields } from '../../common/audit/changed-fields';
import { conflict, notFound } from '../../common/http/errors';
import { emptyToNull } from '../../common/text/text';
import { PrismaService, Tx } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const toView = (s: { id: string; name: string; contactName: string | null; email: string | null; phone: string | null; address: string | null; notes: string | null }): SupplierView => ({
  id: s.id, name: s.name, contactName: s.contactName, email: s.email, phone: s.phone, address: s.address, notes: s.notes,
});
const AUDITED = ['name', 'contactName', 'email', 'phone', 'address', 'notes'] as const;

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<SupplierView[]> {
    const rows = await this.prisma.forTenant((tx) => tx.supplier.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } }));
    return rows.map(toView);
  }

  async create(dto: SupplierInput, access: AccessContext): Promise<SupplierView> {
    return this.prisma.forTenant(async (tx) => {
      await this.ensureNameFree(tx, dto.name);
      const row = await tx.supplier.create({
        data: { organizationId: access.organizationId, name: dto.name, contactName: emptyToNull(dto.contactName) ?? null, email: emptyToNull(dto.email) ?? null, phone: emptyToNull(dto.phone) ?? null, address: emptyToNull(dto.address) ?? null, notes: emptyToNull(dto.notes) ?? null },
      });
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, action: 'supplier.created', entity: 'supplier', entityId: row.id, after: { name: row.name } });
      return toView(row);
    });
  }

  async update(id: string, dto: UpdateSupplierInput, access: AccessContext): Promise<SupplierView> {
    return this.prisma.forTenant(async (tx) => {
      const existing = await tx.supplier.findFirst({ where: { id, deletedAt: null } });
      if (!existing) throw notFound('Supplier');
      if (dto.name !== undefined && dto.name.toLowerCase() !== existing.name.toLowerCase()) await this.ensureNameFree(tx, dto.name);
      const data: Prisma.SupplierUncheckedUpdateInput = {};
      if (dto.name !== undefined) data.name = dto.name;
      if (dto.contactName !== undefined) data.contactName = emptyToNull(dto.contactName);
      if (dto.email !== undefined) data.email = emptyToNull(dto.email);
      if (dto.phone !== undefined) data.phone = emptyToNull(dto.phone);
      if (dto.address !== undefined) data.address = emptyToNull(dto.address);
      if (dto.notes !== undefined) data.notes = emptyToNull(dto.notes);
      const row = await tx.supplier.update({ where: { id }, data });
      const diff = changedFields(existing, row, AUDITED);
      if (diff.changed.length > 0) await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, action: 'supplier.updated', entity: 'supplier', entityId: id, before: diff.before, after: diff.after });
      return toView(row);
    });
  }

  /** Archive only; history keeps pointing at the supplier. Refused while orders are still open. */
  async archive(id: string, access: AccessContext): Promise<void> {
    await this.prisma.forTenant(async (tx) => {
      const existing = await tx.supplier.findFirst({ where: { id, deletedAt: null } });
      if (!existing) throw notFound('Supplier');
      if ((await tx.purchaseOrder.count({ where: { supplierId: id, status: { in: [...OPEN_PURCHASE_STATUSES] } } })) > 0) {
        throw conflict('SUPPLIER_HAS_OPEN_ORDERS', 'This supplier still has open purchase orders. Finish or cancel them first.');
      }
      await tx.supplier.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, action: 'supplier.archived', entity: 'supplier', entityId: id, before: { name: existing.name } });
    });
  }

  private async ensureNameFree(tx: Tx, name: string): Promise<void> {
    if (await tx.supplier.findFirst({ where: { name: { equals: name, mode: 'insensitive' }, deletedAt: null }, select: { id: true } })) {
      throw conflict('SUPPLIER_EXISTS', `A supplier named "${name}" already exists.`);
    }
  }
}
