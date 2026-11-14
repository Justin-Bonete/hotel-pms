"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const types_1 = require("@pms/types");
const assert_access_1 = require("../../common/access/assert-access");
const changed_fields_1 = require("../../common/audit/changed-fields");
const errors_1 = require("../../common/http/errors");
const text_1 = require("../../common/text/text");
const users_1 = require("../../common/text/users");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const toView = (i, onHand) => ({
    id: i.id, sku: i.sku, name: i.name, category: i.category, unit: i.unit, minStock: i.minStock, maxStock: i.maxStock, unitCostMinor: i.unitCostMinor,
    onHand, status: (0, types_1.stockStatus)(onHand, i.minStock, i.maxStock), suggestedReorder: (0, types_1.suggestedReorder)(onHand, i.minStock, i.maxStock),
});
const AUDITED = ['sku', 'name', 'category', 'unit', 'minStock', 'maxStock', 'unitCostMinor'];
let InventoryService = class InventoryService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    /** Every item with this property's on-hand stock (sum of its movements). */
    async list(propertyId, access) {
        (0, assert_access_1.assertCan)(access, 'inventory.read', propertyId);
        return this.prisma.forTenant(async (tx) => {
            await this.requireProperty(tx, propertyId);
            const [items, sums] = await Promise.all([
                tx.inventoryItem.findMany({ where: { deletedAt: null }, orderBy: [{ category: 'asc' }, { name: 'asc' }] }),
                tx.stockMovement.groupBy({ by: ['itemId'], where: { propertyId }, _sum: { quantity: true } }),
            ]);
            const onHand = new Map(sums.map((s) => [s.itemId, s._sum.quantity ?? 0]));
            return items.map((i) => toView(i, onHand.get(i.id) ?? 0));
        });
    }
    async movements(propertyId, itemId, access) {
        (0, assert_access_1.assertCan)(access, 'inventory.read', propertyId);
        return this.prisma.forTenant(async (tx) => {
            await this.requireProperty(tx, propertyId);
            const rows = await tx.stockMovement.findMany({ where: { propertyId, itemId }, orderBy: { createdAt: 'desc' }, take: 50 });
            const names = await (0, users_1.userNames)(tx, rows.map((r) => r.createdById));
            return rows.map((r) => ({ id: r.id, type: r.type, quantity: r.quantity, unitCostMinor: r.unitCostMinor, note: r.note, createdByName: r.createdById ? (names.get(r.createdById) ?? null) : null, createdAt: r.createdAt.toISOString() }));
        });
    }
    // ================================================================ catalog
    async createItem(dto, access) {
        return this.prisma.forTenant(async (tx) => {
            await this.ensureSkuFree(tx, dto.sku);
            const row = await tx.inventoryItem.create({ data: { organizationId: access.organizationId, ...dto, sku: dto.sku.trim() } });
            await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, action: 'inventory.item_created', entity: 'inventory_item', entityId: row.id, after: { sku: row.sku, name: row.name } });
            return toView(row, 0);
        });
    }
    async updateItem(id, dto, access) {
        return this.prisma.forTenant(async (tx) => {
            const existing = await tx.inventoryItem.findFirst({ where: { id, deletedAt: null } });
            if (!existing)
                throw (0, errors_1.notFound)('Inventory item');
            if (dto.sku !== undefined && dto.sku.toLowerCase() !== existing.sku.toLowerCase())
                await this.ensureSkuFree(tx, dto.sku);
            const min = dto.minStock ?? existing.minStock;
            const max = dto.maxStock ?? existing.maxStock;
            if (max !== 0 && max < min)
                throw (0, errors_1.badRequest)('INVALID_THRESHOLDS', 'The maximum must be at least the minimum (or 0 for no maximum).');
            const row = await tx.inventoryItem.update({ where: { id }, data: { ...dto, ...(dto.sku !== undefined ? { sku: dto.sku.trim() } : {}) } });
            const diff = (0, changed_fields_1.changedFields)(existing, row, AUDITED);
            if (diff.changed.length > 0)
                await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, action: 'inventory.item_updated', entity: 'inventory_item', entityId: id, before: diff.before, after: diff.after });
            return toView(row, 0);
        });
    }
    /** Archive only. Refused while stock remains anywhere or an open purchase order still wants the item. */
    async archiveItem(id, access) {
        await this.prisma.forTenant(async (tx) => {
            const existing = await tx.inventoryItem.findFirst({ where: { id, deletedAt: null } });
            if (!existing)
                throw (0, errors_1.notFound)('Inventory item');
            const byProperty = await tx.stockMovement.groupBy({ by: ['propertyId'], where: { itemId: id }, _sum: { quantity: true } });
            if (byProperty.some((p) => (p._sum.quantity ?? 0) > 0))
                throw (0, errors_1.conflict)('ITEM_HAS_STOCK', 'There is still stock of this item. Use it up, write it off or transfer it first.');
            if ((await tx.purchaseOrderLine.count({ where: { itemId: id, purchaseOrder: { status: { in: [...types_1.OPEN_PURCHASE_STATUSES] } } } })) > 0) {
                throw (0, errors_1.conflict)('ITEM_ON_OPEN_ORDER', 'An open purchase order still includes this item.');
            }
            await tx.inventoryItem.update({ where: { id }, data: { deletedAt: new Date() } });
            await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, action: 'inventory.item_archived', entity: 'inventory_item', entityId: id, before: { sku: existing.sku, name: existing.name } });
        });
    }
    // ================================================================ stock changes
    /** Opening count, usage, wastage or a count adjustment. Stock can never be taken below zero. */
    async record(propertyId, dto, access) {
        (0, assert_access_1.assertCan)(access, 'inventory.manage', propertyId);
        const delta = (0, types_1.movementDelta)(dto.type, dto.quantity);
        return this.prisma.forTenant(async (tx) => {
            await this.requireProperty(tx, propertyId);
            const item = await this.requireItem(tx, dto.itemId);
            await this.lock(tx, propertyId, item.id); // concurrent changes to the same stock take turns
            const onHand = await this.balance(tx, propertyId, item.id);
            if (onHand + delta < 0) {
                throw (0, errors_1.conflict)('INSUFFICIENT_STOCK', `Only ${onHand} ${item.unit} of ${item.name} is on hand, so ${-delta} can't be removed.`);
            }
            await tx.stockMovement.create({
                data: { organizationId: access.organizationId, propertyId, itemId: item.id, type: dto.type, quantity: delta, note: (0, text_1.emptyToNull)(dto.note) ?? null, createdById: access.userId },
                select: { id: true },
            });
            await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId, action: `inventory.${dto.type.toLowerCase()}`, entity: 'inventory_item', entityId: item.id, before: { item: item.name, onHand }, after: { change: delta, onHand: onHand + delta, note: (0, text_1.emptyToNull)(dto.note) ?? null } });
            return toView(item, onHand + delta);
        });
    }
    /** Move stock between two properties atomically: out of one and into the other, or neither. Needs inventory.manage at BOTH. */
    async transfer(dto, access) {
        (0, assert_access_1.assertCan)(access, 'inventory.manage', dto.fromPropertyId);
        (0, assert_access_1.assertCan)(access, 'inventory.manage', dto.toPropertyId);
        return this.prisma.forTenant(async (tx) => {
            const [from, to] = await Promise.all([this.requireProperty(tx, dto.fromPropertyId), this.requireProperty(tx, dto.toPropertyId)]);
            const item = await this.requireItem(tx, dto.itemId);
            // Always lock in the same order, so two opposite transfers can't deadlock each other.
            for (const propertyId of [dto.fromPropertyId, dto.toPropertyId].sort())
                await this.lock(tx, propertyId, item.id);
            const fromOnHand = await this.balance(tx, dto.fromPropertyId, item.id);
            if (fromOnHand < dto.quantity)
                throw (0, errors_1.conflict)('INSUFFICIENT_STOCK', `${from.name} has only ${fromOnHand} ${item.unit} of ${item.name}.`);
            const toOnHand = await this.balance(tx, dto.toPropertyId, item.id);
            const transferId = (0, node_crypto_1.randomUUID)();
            const note = (0, text_1.emptyToNull)(dto.note);
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
    async balance(tx, propertyId, itemId) {
        const sum = await tx.stockMovement.aggregate({ where: { propertyId, itemId }, _sum: { quantity: true } });
        return sum._sum.quantity ?? 0;
    }
    async lock(tx, propertyId, itemId) {
        await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${`stock:${propertyId}:${itemId}`}))`;
    }
    async requireProperty(tx, propertyId) {
        const property = await tx.property.findFirst({ where: { id: propertyId, deletedAt: null }, select: { id: true, name: true } });
        if (!property)
            throw (0, errors_1.notFound)('Property');
        return property;
    }
    async requireItem(tx, itemId) {
        const item = await tx.inventoryItem.findFirst({ where: { id: itemId, deletedAt: null } });
        if (!item)
            throw (0, errors_1.badRequest)('INVALID_ITEM', 'That item does not exist (or was archived).');
        return item;
    }
    async ensureSkuFree(tx, sku) {
        if (await tx.inventoryItem.findFirst({ where: { sku: { equals: sku.trim(), mode: 'insensitive' }, deletedAt: null }, select: { id: true } })) {
            throw (0, errors_1.conflict)('SKU_EXISTS', `An item with code "${sku.trim()}" already exists.`);
        }
    }
};
exports.InventoryService = InventoryService;
exports.InventoryService = InventoryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], InventoryService);
//# sourceMappingURL=inventory.service.js.map