import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { OPEN_PURCHASE_STATUSES, movementDelta, stockStatus, suggestedReorder, type InventoryItemView, type StockMovementView } from '@pms/types';
import type { InventoryItemInput, MovementInput, TransferInput, UpdateInventoryItemInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { assertCan } from '../../common/access/assert-access';
import { changedFields } from '../../common/audit/changed-fields';
import { badRequest, conflict, notFound } from '../../common/http/errors';
import { emptyToNull } from '../../common/text/text';
import { userNames } from '../../common/text/users';
import { PrismaService, Tx } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

type ItemRow = Prisma.InventoryItemGetPayload<object>;

const toView = (i: ItemRow, onHand: number): InventoryItemView => ({
  id: i.id, sku: i.sku, name: i.name, category: i.category, unit: i.unit, minStock: i.minStock, maxStock: i.maxStock, unitCostMinor: i.unitCostMinor,
  onHand, status: stockStatus(onHand, i.minStock, i.maxStock), suggestedReorder: suggestedReorder(onHand, i.minStock, i.maxStock),
});
const AUDITED = ['sku', 'name', 'category', 'unit', 'minStock', 'maxStock', 'unitCostMinor'] as const;

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Every item with this property's on-hand stock (sum of its movements). */
  async list(propertyId: string, access: AccessContext): Promise<InventoryItemView[]> {
    assertCan(access, 'inventory.read', propertyId);
    return this.prisma.forTenant(async (tx) => {
      await this.requireProperty(tx, propertyId);
      const [items, sums] = await Promise.all([
        tx.inventoryItem.findMany({ where: { deletedAt: null }, orderBy: [{ category: 'asc' }, { name: 'asc' }] }),
        tx.stockMovement.groupBy({ by: ['itemId'], where: { propertyId }, _sum: { quantity: true } }),
      ]);
      const onHand = new Map<string, number>(sums.map((s) => [s.itemId, s._sum.quantity ?? 0] as [string, number]));
      return items.map((i) => toView(i, onHand.get(i.id) ?? 0));
    });
  }

  async movements(propertyId: string, itemId: string, access: AccessContext): Promise<StockMovementView[]> {
    assertCan(access, 'inventory.read', propertyId);
    return this.prisma.forTenant(async (tx) => {
      await this.requireProperty(tx, propertyId);
      const rows = await tx.stockMovement.findMany({ where: { propertyId, itemId }, orderBy: { createdAt: 'desc' }, take: 50 });
      const names = await userNames(tx, rows.map((r) => r.createdById));
      return rows.map((r) => ({ id: r.id, type: r.type, quantity: r.quantity, unitCostMinor: r.unitCostMinor, note: r.note, createdByName: r.createdById ? (names.get(r.createdById) ?? null) : null, createdAt: r.createdAt.toISOString() }));
    });
  }

  // ================================================================ catalog
  async createItem(dto: InventoryItemInput, access: AccessContext): Promise<InventoryItemView> {
    return this.prisma.forTenant(async (tx) => {
      await this.ensureSkuFree(tx, dto.sku);
      const row = await tx.inventoryItem.create({ data: { organizationId: access.organizationId, ...dto, sku: dto.sku.trim() } });
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, action: 'inventory.item_created', entity: 'inventory_item', entityId: row.id, after: { sku: row.sku, name: row.name } });
      return toView(row, 0);
    });
  }

  async updateItem(id: string, dto: UpdateInventoryItemInput, access: AccessContext): Promise<InventoryItemView> {
    return this.prisma.forTenant(async (tx) => {
      const existing = await tx.inventoryItem.findFirst({ where: { id, deletedAt: null } });
      if (!existing) throw notFound('Inventory item');
      if (dto.sku !== undefined && dto.sku.toLowerCase() !== existing.sku.toLowerCase()) await this.ensureSkuFree(tx, dto.sku);
      const min = dto.minStock ?? existing.minStock;
      const max = dto.maxStock ?? existing.maxStock;
      if (max !== 0 && max < min) throw badRequest('INVALID_THRESHOLDS', 'The maximum must be at least the minimum (or 0 for no maximum).');
      const row = await tx.inventoryItem.update({ where: { id }, data: { ...dto, ...(dto.sku !== undefined ? { sku: dto.sku.trim() } : {}) } });
      const diff = changedFields(existing, row, AUDITED);
      if (diff.changed.length > 0) await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, action: 'inventory.item_updated', entity: 'inventory_item', entityId: id, before: diff.before, after: diff.after });
      return toView(row, 0);
    });
  }

  /** Archive only. Refused while stock remains anywhere or an open purchase order still wants the item. */
  async archiveItem(id: string, access: AccessContext): Promise<void> {
    await this.prisma.forTenant(async (tx) => {
      const existing = await tx.inventoryItem.findFirst({ where: { id, deletedAt: null } });
      if (!existing) throw notFound('Inventory item');
      const byProperty = await tx.stockMovement.groupBy({ by: ['propertyId'], where: { itemId: id }, _sum: { quantity: true } });
      if (byProperty.some((p) => (p._sum.quantity ?? 0) > 0)) throw conflict('ITEM_HAS_STOCK', 'There is still stock of this item. Use it up, write it off or transfer it first.');
      if ((await tx.purchaseOrderLine.count({ where: { itemId: id, purchaseOrder: { status: { in: [...OPEN_PURCHASE_STATUSES] } } } })) > 0) {
        throw conflict('ITEM_ON_OPEN_ORDER', 'An open purchase order still includes this item.');
      }
      await tx.inventoryItem.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, action: 'inventory.item_archived', entity: 'inventory_item', entityId: id, before: { sku: existing.sku, name: existing.name } });
    });
  }

  // ================================================================ stock changes
  /** Opening count, usage, wastage or a count adjustment. Stock can never be taken below zero. */
  async record(propertyId: string, dto: MovementInput, access: AccessContext): Promise<InventoryItemView> {
    assertCan(access, 'inventory.manage', propertyId);
    const delta = movementDelta(dto.type, dto.quantity);
    return this.prisma.forTenant(async (tx) => {
      await this.requireProperty(tx, propertyId);
      const item = await this.requireItem(tx, dto.itemId);
      await this.lock(tx, propertyId, item.id); // concurrent changes to the same stock take turns
      const onHand = await this.balance(tx, propertyId, item.id);
      if (onHand + delta < 0) {
        throw conflict('INSUFFICIENT_STOCK', `Only ${onHand} ${item.unit} of ${item.name} is on hand, so ${-delta} can't be removed.`);
      }
      await tx.stockMovement.create({
        data: { organizationId: access.organizationId, propertyId, itemId: item.id, type: dto.type, quantity: delta, note: emptyToNull(dto.note) ?? null, createdById: access.userId },
        select: { id: true },
      });
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId, action: `inventory.${dto.type.toLowerCase()}`, entity: 'inventory_item', entityId: item.id, before: { item: item.name, onHand }, after: { change: delta, onHand: onHand + delta, note: emptyToNull(dto.note) ?? null } });
      return toView(item, onHand + delta);
    });
  }

  /** Move stock between two properties atomically: out of one and into the other, or neither. Needs inventory.manage at BOTH. */
  async transfer(dto: TransferInput, access: AccessContext): Promise<{ from: InventoryItemView; to: InventoryItemView }> {
    assertCan(access, 'inventory.manage', dto.fromPropertyId);
    assertCan(access, 'inventory.manage', dto.toPropertyId);
    return this.prisma.forTenant(async (tx) => {
      const [from, to] = await Promise.all([this.requireProperty(tx, dto.fromPropertyId), this.requireProperty(tx, dto.toPropertyId)]);
      const item = await this.requireItem(tx, dto.itemId);

      // Always lock in the same order, so two opposite transfers can't deadlock each other.
      for (const propertyId of [dto.fromPropertyId, dto.toPropertyId].sort()) await this.lock(tx, propertyId, item.id);
      const fromOnHand = await this.balance(tx, dto.fromPropertyId, item.id);
      if (fromOnHand < dto.quantity) throw conflict('INSUFFICIENT_STOCK', `${from.name} has only ${fromOnHand} ${item.unit} of ${item.name}.`);
      const toOnHand = await this.balance(tx, dto.toPropertyId, item.id);

      const transferId = randomUUID();
      const note = emptyToNull(dto.note);
      await tx.stockMovement.createMany({
        data: [
          { organizationId: access.organizationId, propertyId: dto.fromPropertyId, itemId: item.id, type: 'TRANSFER_OUT', quantity: -dto.quantity, transferId, note: `To ${to.name}${note ? `: ${note}` : ''}`, createdById: access.userId },
          { organizationId: access.organizationId, propertyId: dto.toPropertyId, itemId: item.id, type: 'TRANSFER_IN', quantity: dto.quantity, transferId, note: `From ${from.name}${note ? `: ${note}` : ''}`, createdById: access.userId },
        ],
      });
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId: dto.fromPropertyId, action: 'inventory.transferred', entity: 'inventory_item', entityId: item.id, before: { [from.name]: fromOnHand, [to.name]: toOnHand }, after: { moved: dto.quantity, item: item.name, [from.name]: fromOnHand - dto.quantity, [to.name]: toOnHand + dto.quantity, transferId } });
      return { from: toView(item, fromOnHand - dto.quantity), to: toView(item, toOnHand + dto.quantity) };
    });
  }

  // ================================================================ internals
  private async balance(tx: Tx, propertyId: string, itemId: string): Promise<number> {
    const sum = await tx.stockMovement.aggregate({ where: { propertyId, itemId }, _sum: { quantity: true } });
    return sum._sum.quantity ?? 0;
  }

  private async lock(tx: Tx, propertyId: string, itemId: string): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`stock:${propertyId}:${itemId}`}))`;
  }

  private async requireProperty(tx: Tx, propertyId: string) {
    const property = await tx.property.findFirst({ where: { id: propertyId, deletedAt: null }, select: { id: true, name: true } });
    if (!property) throw notFound('Property');
    return property;
  }

  private async requireItem(tx: Tx, itemId: string): Promise<ItemRow> {
    const item = await tx.inventoryItem.findFirst({ where: { id: itemId, deletedAt: null } });
    if (!item) throw badRequest('INVALID_ITEM', 'That item does not exist (or was archived).');
    return item;
  }

  private async ensureSkuFree(tx: Tx, sku: string): Promise<void> {
    if (await tx.inventoryItem.findFirst({ where: { sku: { equals: sku.trim(), mode: 'insensitive' }, deletedAt: null }, select: { id: true } })) {
      throw conflict('SKU_EXISTS', `An item with code "${sku.trim()}" already exists.`);
    }
  }
}
