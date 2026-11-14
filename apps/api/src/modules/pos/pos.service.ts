import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { randomBytes, randomUUID } from 'node:crypto';
import { formatMoney, posLineTotals, stockNeeded, todayIn, zonedDayRange, type PaymentMethod, type PosMenuView, type PosOrderView, type PosSummaryView } from '@pms/types';
import type { CreatePosOrderInput, OutletInput, PosItemInput, PosOrdersQuery, UpdateOutletInput, UpdatePosItemInput, VoidPosOrderInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { assertCan } from '../../common/access/assert-access';
import { badRequest, conflict, notFound } from '../../common/http/errors';
import { emptyToNull } from '../../common/text/text';
import { userNames } from '../../common/text/users';
import { PrismaService, Tx } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FolioLedger } from '../folios/folio-ledger.service';
import { RealtimeService } from '../realtime/realtime.service';

const orderInclude = {
  outlet: { select: { name: true } },
  lines: { orderBy: { createdAt: 'asc' } },
  reservation: { select: { code: true, guest: { select: { firstName: true, lastName: true } }, room: { select: { number: true } } } },
} satisfies Prisma.PosOrderInclude;
type OrderRow = Prisma.PosOrderGetPayload<{ include: typeof orderInclude }>;

const MAX_ORDER_MINOR = 2_000_000_000;

@Injectable()
export class PosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly ledger: FolioLedger,
    private readonly realtime: RealtimeService,
  ) {}

  // ================================================================ menu
  /** Everything the till needs: outlets, their items, the taxes that will apply, and the currency. */
  async menu(propertyId: string, access: AccessContext): Promise<PosMenuView> {
    assertCan(access, 'pos.read', propertyId);
    return this.prisma.forTenant(async (tx) => {
      const property = await this.requireProperty(tx, propertyId);
      const [taxes, outlets] = await Promise.all([
        tx.tax.findMany({ where: { propertyId, isActive: true, deletedAt: null, appliesToExtras: true }, orderBy: { name: 'asc' }, select: { name: true, rateBps: true } }),
        tx.posOutlet.findMany({ where: { propertyId, deletedAt: null }, orderBy: { name: 'asc' }, include: { items: { where: { deletedAt: null }, orderBy: [{ category: 'asc' }, { name: 'asc' }] } } }),
      ]);
      return {
        currency: property.currency,
        taxes,
        outlets: outlets.map((o) => ({
          id: o.id, name: o.name, type: o.type,
          items: o.items.map((i) => ({ id: i.id, outletId: i.outletId, name: i.name, category: i.category, priceMinor: i.priceMinor, taxable: i.taxable, inventoryItemId: i.inventoryItemId, inventoryQuantity: i.inventoryQuantity })),
        })),
      };
    });
  }

  async createOutlet(propertyId: string, dto: OutletInput, access: AccessContext) {
    assertCan(access, 'pos.manage', propertyId);
    return this.prisma.forTenant(async (tx) => {
      await this.requireProperty(tx, propertyId);
      if (await tx.posOutlet.findFirst({ where: { propertyId, name: { equals: dto.name, mode: 'insensitive' }, deletedAt: null }, select: { id: true } })) throw conflict('OUTLET_EXISTS', `There is already an outlet called "${dto.name}".`);
      const row = await tx.posOutlet.create({ data: { organizationId: access.organizationId, propertyId, name: dto.name, type: dto.type } });
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId, action: 'pos.outlet_created', entity: 'pos_outlet', entityId: row.id, after: { name: row.name, type: row.type } });
      return { id: row.id, name: row.name, type: row.type, items: [] };
    });
  }

  async updateOutlet(id: string, dto: UpdateOutletInput, access: AccessContext) {
    return this.prisma.forTenant(async (tx) => {
      const existing = await tx.posOutlet.findFirst({ where: { id, deletedAt: null } });
      if (!existing) throw notFound('Outlet');
      assertCan(access, 'pos.manage', existing.propertyId);
      if (dto.name && dto.name.toLowerCase() !== existing.name.toLowerCase() && (await tx.posOutlet.findFirst({ where: { propertyId: existing.propertyId, name: { equals: dto.name, mode: 'insensitive' }, deletedAt: null }, select: { id: true } }))) {
        throw conflict('OUTLET_EXISTS', `There is already an outlet called "${dto.name}".`);
      }
      const row = await tx.posOutlet.update({ where: { id }, data: { ...(dto.name ? { name: dto.name } : {}), ...(dto.type ? { type: dto.type } : {}) } });
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId: existing.propertyId, action: 'pos.outlet_updated', entity: 'pos_outlet', entityId: id, before: { name: existing.name, type: existing.type }, after: { name: row.name, type: row.type } });
      return { id: row.id, name: row.name, type: row.type };
    });
  }

  /** Archive only. Past sales keep pointing at the outlet. */
  async archiveOutlet(id: string, access: AccessContext): Promise<void> {
    await this.prisma.forTenant(async (tx) => {
      const existing = await tx.posOutlet.findFirst({ where: { id, deletedAt: null } });
      if (!existing) throw notFound('Outlet');
      assertCan(access, 'pos.manage', existing.propertyId);
      const now = new Date();
      await tx.posItem.updateMany({ where: { outletId: id, deletedAt: null }, data: { deletedAt: now } });
      await tx.posOutlet.update({ where: { id }, data: { deletedAt: now } });
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId: existing.propertyId, action: 'pos.outlet_archived', entity: 'pos_outlet', entityId: id, before: { name: existing.name } });
    });
  }

  async createItem(dto: PosItemInput, access: AccessContext) {
    return this.prisma.forTenant(async (tx) => {
      const outlet = await tx.posOutlet.findFirst({ where: { id: dto.outletId, deletedAt: null } });
      if (!outlet) throw badRequest('INVALID_OUTLET', 'That outlet does not exist.');
      assertCan(access, 'pos.manage', outlet.propertyId);
      if (dto.inventoryItemId && !(await tx.inventoryItem.findFirst({ where: { id: dto.inventoryItemId, deletedAt: null }, select: { id: true } }))) throw badRequest('INVALID_ITEM', 'That stock item does not exist.');
      const row = await tx.posItem.create({ data: { organizationId: access.organizationId, outletId: dto.outletId, name: dto.name, category: emptyToNull(dto.category) ?? null, priceMinor: dto.priceMinor, taxable: dto.taxable, inventoryItemId: dto.inventoryItemId ?? null, inventoryQuantity: dto.inventoryQuantity } });
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId: outlet.propertyId, action: 'pos.item_created', entity: 'pos_item', entityId: row.id, after: { name: row.name, price: formatMoney(row.priceMinor, 'PHP'), outlet: outlet.name } });
      return { id: row.id };
    });
  }

  async updateItem(id: string, dto: UpdatePosItemInput, access: AccessContext) {
    return this.prisma.forTenant(async (tx) => {
      const existing = await tx.posItem.findFirst({ where: { id, deletedAt: null }, include: { outlet: { select: { propertyId: true } } } });
      if (!existing) throw notFound('Menu item');
      assertCan(access, 'pos.manage', existing.outlet.propertyId);
      if (dto.inventoryItemId && !(await tx.inventoryItem.findFirst({ where: { id: dto.inventoryItemId, deletedAt: null }, select: { id: true } }))) throw badRequest('INVALID_ITEM', 'That stock item does not exist.');
      const data: Prisma.PosItemUncheckedUpdateInput = {};
      if (dto.name !== undefined) data.name = dto.name;
      if (dto.category !== undefined) data.category = emptyToNull(dto.category);
      if (dto.priceMinor !== undefined) data.priceMinor = dto.priceMinor;
      if (dto.taxable !== undefined) data.taxable = dto.taxable;
      if (dto.inventoryItemId !== undefined) data.inventoryItemId = dto.inventoryItemId;
      if (dto.inventoryQuantity !== undefined) data.inventoryQuantity = dto.inventoryQuantity;
      const row = await tx.posItem.update({ where: { id }, data });
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId: existing.outlet.propertyId, action: 'pos.item_updated', entity: 'pos_item', entityId: id, before: { name: existing.name, priceMinor: existing.priceMinor, taxable: existing.taxable }, after: { name: row.name, priceMinor: row.priceMinor, taxable: row.taxable } });
      return { id: row.id };
    });
  }

  async archiveItem(id: string, access: AccessContext): Promise<void> {
    await this.prisma.forTenant(async (tx) => {
      const existing = await tx.posItem.findFirst({ where: { id, deletedAt: null }, include: { outlet: { select: { propertyId: true } } } });
      if (!existing) throw notFound('Menu item');
      assertCan(access, 'pos.manage', existing.outlet.propertyId);
      await tx.posItem.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId: existing.outlet.propertyId, action: 'pos.item_archived', entity: 'pos_item', entityId: id, before: { name: existing.name } });
    });
  }

  // ================================================================ sell
  /**
   * Rings up a sale. The server works out every price and tax itself (the till only says WHAT and HOW MANY), refuses a
   * sale that would take tracked stock below zero, and for a room charge posts to the guest's bill in the same transaction.
   * A repeated Idempotency-Key returns the first sale instead of creating a second one.
   */
  async create(propertyId: string, dto: CreatePosOrderInput, key: string | undefined, access: AccessContext): Promise<PosOrderView> {
    assertCan(access, 'pos.sell', propertyId);
    return this.prisma.forTenant(async (tx) => {
      const property = await this.requireProperty(tx, propertyId);

      if (key) {
        const existing = await tx.posOrder.findFirst({ where: { idempotencyKey: key }, include: orderInclude });
        if (existing) {
          if (existing.propertyId !== propertyId) throw conflict('IDEMPOTENCY_KEY_REUSED', 'That request key was already used for something else.');
          return (await this.views(tx, [existing]))[0]!;
        }
      }

      const outlet = await tx.posOutlet.findFirst({ where: { id: dto.outletId, propertyId, deletedAt: null } });
      if (!outlet) throw badRequest('INVALID_OUTLET', 'That outlet does not exist (or was archived).');
      const ids = dto.lines.map((l) => l.itemId);
      const items = await tx.posItem.findMany({ where: { id: { in: ids }, outletId: outlet.id, deletedAt: null } });
      if (items.length !== ids.length) throw badRequest('INVALID_ITEM', 'An item is no longer on this menu. Refresh the menu and try again.');
      const byId = new Map(items.map((i) => [i.id, i] as [string, (typeof items)[number]]));
      const specs = dto.lines.map((l) => ({ item: byId.get(l.itemId)!, quantity: l.quantity }));

      const taxes = await tx.tax.findMany({ where: { propertyId, isActive: true, deletedAt: null, appliesToExtras: true }, select: { rateBps: true } });
      const totals = posLineTotals(specs.map((s) => ({ quantity: s.quantity, unitAmountMinor: s.item.priceMinor, taxable: s.item.taxable })), taxes);
      if (totals.totalMinor > MAX_ORDER_MINOR) throw badRequest('TOTAL_TOO_LARGE', 'This sale is too large to ring up in one order.');

      // Tracked stock: refuse the sale rather than let stock go below zero.
      const need = stockNeeded(specs.map((s) => ({ quantity: s.quantity, inventoryItemId: s.item.inventoryItemId, inventoryQuantity: s.item.inventoryQuantity })));
      if (need.size > 0) {
        const stock = await tx.inventoryItem.findMany({ where: { id: { in: [...need.keys()] } }, select: { id: true, name: true, unit: true } });
        const stockById = new Map(stock.map((s) => [s.id, s] as [string, (typeof stock)[number]]));
        for (const itemId of [...need.keys()].sort()) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`stock:${propertyId}:${itemId}`}))`; // same lock the Inventory screens use
          const onHand = (await tx.stockMovement.aggregate({ where: { propertyId, itemId }, _sum: { quantity: true } }))._sum.quantity ?? 0;
          const wanted = need.get(itemId)!;
          if (onHand < wanted) {
            const s = stockById.get(itemId);
            throw conflict('OUT_OF_STOCK', `Not enough ${s?.name ?? 'stock'}: ${onHand} ${s?.unit ?? ''} left, ${wanted} needed for this sale.`.replace('  ', ' '));
          }
        }
      }

      // Settlement
      let reservationId: string | null = null;
      let paymentMethod: PaymentMethod | null = null;
      let stay: { id: string; organizationId: string; propertyId: string; currency: string } | null = null;
      if (dto.settlement.type === 'ROOM_CHARGE') {
        assertCan(access, 'reservation.read', propertyId);
        const r = await tx.reservation.findFirst({ where: { id: dto.settlement.reservationId, propertyId }, select: { id: true, organizationId: true, propertyId: true, currency: true, status: true } });
        if (!r) throw badRequest('INVALID_GUEST', 'That guest was not found at this property.');
        if (r.status !== 'CHECKED_IN') throw conflict('NOT_IN_HOUSE', 'Room charges can only go to a guest who is checked in.');
        reservationId = r.id;
        stay = r;
      } else {
        paymentMethod = dto.settlement.method;
      }

      const code = await this.newCode(tx);
      const folioItemIds: Array<string | null> = [];
      for (const s of specs) {
        folioItemIds.push(stay ? await this.ledger.postExtraCharge(tx, stay, { description: `${outlet.name}: ${s.item.name}`, quantity: s.quantity, unitAmountMinor: s.item.priceMinor, taxable: s.item.taxable, source: 'POS', actorId: access.userId }) : null);
      }

      const order = await tx.posOrder.create({
        data: {
          organizationId: access.organizationId, propertyId, outletId: outlet.id, code, status: stay ? 'ROOM_CHARGED' : 'PAID',
          tableLabel: emptyToNull(dto.tableLabel) ?? null, note: emptyToNull(dto.note) ?? null, reservationId, paymentMethod,
          subtotalMinor: totals.subtotalMinor, taxMinor: totals.taxMinor, totalMinor: totals.totalMinor, currency: property.currency, idempotencyKey: key ?? null, createdById: access.userId,
          lines: {
            create: specs.map((s, i) => ({
              id: randomUUID(), organizationId: access.organizationId, posItemId: s.item.id, description: s.item.name, quantity: s.quantity, unitAmountMinor: s.item.priceMinor,
              amountMinor: totals.lines[i]!.amountMinor, taxable: s.item.taxable, taxMinor: totals.lines[i]!.taxMinor,
              inventoryItemId: s.item.inventoryItemId, inventoryQuantity: s.item.inventoryItemId ? s.item.inventoryQuantity : 0, folioItemId: folioItemIds[i] ?? null,
            })),
          },
        },
        include: orderInclude,
      });

      if (need.size > 0) {
        await tx.stockMovement.createMany({ data: [...need].map(([itemId, quantity]) => ({ organizationId: access.organizationId, propertyId, itemId, type: 'USAGE' as const, quantity: -quantity, note: `POS ${code}`, createdById: access.userId })) });
      }
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId, action: 'pos.sale', entity: 'pos_order', entityId: order.id, after: { code, outlet: outlet.name, total: formatMoney(totals.totalMinor, property.currency), settlement: stay ? 'room charge' : paymentMethod, lines: specs.length } });
      if (stay) this.realtime.emit(access.organizationId, 'folio.changed', propertyId, [stay.id]);
      return (await this.views(tx, [order]))[0]!;
    });
  }

  // ================================================================ void
  /** Voiding reverses everything the sale did: the folio lines (room charge) and the stock it used. Needs pos.void. */
  async void(id: string, dto: VoidPosOrderInput, access: AccessContext): Promise<PosOrderView> {
    return this.prisma.forTenant(async (tx) => {
      const order = await tx.posOrder.findFirst({ where: { id }, include: orderInclude });
      if (!order) throw notFound('Sale');
      assertCan(access, 'pos.void', order.propertyId);
      if (order.status === 'VOID') throw conflict('ALREADY_VOID', 'This sale was already voided.');

      const claimed = await tx.posOrder.updateMany({ where: { id, status: order.status }, data: { status: 'VOID', voidedAt: new Date(), voidedById: access.userId, voidReason: dto.reason } });
      if (claimed.count === 0) throw conflict('SALE_CHANGED', 'Someone else just changed this sale. Refresh and try again.');

      if (order.status === 'ROOM_CHARGED') {
        for (const line of order.lines) if (line.folioItemId) await this.ledger.reverseItem(tx, line.folioItemId, `POS ${order.code} voided: ${dto.reason}`, 'POS', access.userId);
      }
      const restock = new Map<string, number>();
      for (const l of order.lines) if (l.inventoryItemId && l.inventoryQuantity > 0) restock.set(l.inventoryItemId, (restock.get(l.inventoryItemId) ?? 0) + l.inventoryQuantity * l.quantity);
      if (restock.size > 0) {
        await tx.stockMovement.createMany({ data: [...restock].map(([itemId, quantity]) => ({ organizationId: access.organizationId, propertyId: order.propertyId, itemId, type: 'ADJUSTMENT' as const, quantity, note: `Void of POS ${order.code}`, createdById: access.userId })) });
      }
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId: order.propertyId, action: 'pos.void', entity: 'pos_order', entityId: id, before: { code: order.code, status: order.status, total: formatMoney(order.totalMinor, order.currency) }, after: { reason: dto.reason } });
      if (order.reservationId) this.realtime.emit(access.organizationId, 'folio.changed', order.propertyId, [order.reservationId]);
      return (await this.views(tx, [await tx.posOrder.findFirstOrThrow({ where: { id }, include: orderInclude })]))[0]!;
    });
  }

  // ================================================================ reports
  async list(propertyId: string, query: PosOrdersQuery, access: AccessContext): Promise<PosOrderView[]> {
    assertCan(access, 'pos.read', propertyId);
    return this.prisma.forTenant(async (tx) => {
      const property = await this.requireProperty(tx, propertyId);
      const { start, end } = zonedDayRange(query.date ?? todayIn(property.timezone), property.timezone);
      const rows = await tx.posOrder.findMany({ where: { propertyId, createdAt: { gte: start, lt: end } }, include: orderInclude, orderBy: { createdAt: 'desc' }, take: 500 });
      return this.views(tx, rows);
    });
  }

  /** The cashier report: sales for a day by outlet and by how they were settled. Voided sales are counted separately, never in sales. */
  async summary(propertyId: string, query: PosOrdersQuery, access: AccessContext): Promise<PosSummaryView> {
    assertCan(access, 'pos.read', propertyId);
    return this.prisma.forTenant(async (tx) => {
      const property = await this.requireProperty(tx, propertyId);
      const date = query.date ?? todayIn(property.timezone);
      const { start, end } = zonedDayRange(date, property.timezone);
      const rows = await tx.posOrder.findMany({ where: { propertyId, createdAt: { gte: start, lt: end } }, select: { status: true, totalMinor: true, taxMinor: true, paymentMethod: true, outletId: true, outlet: { select: { name: true } } }, take: 5000 });

      const live = rows.filter((r) => r.status !== 'VOID');
      const voided = rows.filter((r) => r.status === 'VOID');
      const byOutlet = new Map<string, { outletId: string; outletName: string; orders: number; totalMinor: number }>();
      const bySettlement = new Map<string, { settlement: string; orders: number; totalMinor: number }>();
      for (const r of live) {
        const o = byOutlet.get(r.outletId) ?? { outletId: r.outletId, outletName: r.outlet.name, orders: 0, totalMinor: 0 };
        o.orders += 1; o.totalMinor += r.totalMinor; byOutlet.set(r.outletId, o);
        const settlement = r.status === 'ROOM_CHARGED' ? 'ROOM_CHARGE' : (r.paymentMethod ?? 'OTHER');
        const s = bySettlement.get(settlement) ?? { settlement, orders: 0, totalMinor: 0 };
        s.orders += 1; s.totalMinor += r.totalMinor; bySettlement.set(settlement, s);
      }
      return {
        date, currency: property.currency, orders: live.length, salesMinor: live.reduce((s, r) => s + r.totalMinor, 0), taxMinor: live.reduce((s, r) => s + r.taxMinor, 0),
        byOutlet: [...byOutlet.values()].sort((a, b) => b.totalMinor - a.totalMinor), bySettlement: [...bySettlement.values()].sort((a, b) => b.totalMinor - a.totalMinor),
        voidedOrders: voided.length, voidedMinor: voided.reduce((s, r) => s + r.totalMinor, 0),
      };
    });
  }

  // ================================================================ internals
  private async views(tx: Tx, orders: OrderRow[]): Promise<PosOrderView[]> {
    const names = await userNames(tx, orders.map((o) => o.createdById));
    return orders.map((o) => ({
      id: o.id, code: o.code, propertyId: o.propertyId, outletId: o.outletId, outletName: o.outlet.name, status: o.status, tableLabel: o.tableLabel, note: o.note,
      reservationCode: o.reservation?.code ?? null, guestName: o.reservation ? `${o.reservation.guest.firstName} ${o.reservation.guest.lastName}` : null, roomNumber: o.reservation?.room?.number ?? null,
      paymentMethod: o.paymentMethod, currency: o.currency, subtotalMinor: o.subtotalMinor, taxMinor: o.taxMinor, totalMinor: o.totalMinor,
      createdByName: o.createdById ? (names.get(o.createdById) ?? null) : null, createdAt: o.createdAt.toISOString(), voidReason: o.voidReason,
      lines: o.lines.map((l) => ({ id: l.id, description: l.description, quantity: l.quantity, unitAmountMinor: l.unitAmountMinor, amountMinor: l.amountMinor, taxMinor: l.taxMinor })),
    }));
  }

  private async requireProperty(tx: Tx, propertyId: string) {
    const property = await tx.property.findFirst({ where: { id: propertyId, deletedAt: null }, select: { id: true, currency: true, timezone: true } });
    if (!property) throw notFound('Property');
    return property;
  }

  private async newCode(tx: Tx): Promise<string> {
    for (let i = 0; i < 6; i++) {
      const code = `POS-${randomBytes(3).toString('hex').toUpperCase()}`;
      if (!(await tx.posOrder.findFirst({ where: { code }, select: { id: true } }))) return code;
    }
    throw conflict('CODE_UNAVAILABLE', 'Could not generate a receipt number. Please try again.');
  }
}
