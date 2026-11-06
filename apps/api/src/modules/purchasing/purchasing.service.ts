import { HttpStatus, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import {
  INVOICEABLE_STATUSES,
  PO_DECISION_FROM,
  PO_DECISION_RESULT,
  RECEIVABLE_STATUSES,
  formatMoney,
  invoiceVariance,
  mayApprove,
  parseDate,
  poTotal,
  receiptStatus,
  receivedValue,
  remainingToReceive,
  toDateString,
  todayIn,
  type PurchaseOrderView,
  type SupplierInvoiceView,
} from '@pms/types';
import type { CreateOrderInput, DecisionInput, InvoiceInput, InvoicesQuery, OrdersQuery, PayInvoiceInput, ReceiveInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { assertCan } from '../../common/access/assert-access';
import { AppException } from '../../common/http/app-exception';
import { badRequest, conflict, notFound } from '../../common/http/errors';
import { emptyToNull } from '../../common/text/text';
import { userNames } from '../../common/text/users';
import { PrismaService, Tx } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RbacService } from '../rbac/rbac.service';

const orderInclude = {
  supplier: { select: { name: true } },
  lines: { include: { item: { select: { name: true, sku: true, unit: true } } }, orderBy: { createdAt: 'asc' } },
  invoice: { include: { supplier: { select: { name: true } }, purchaseOrder: { select: { code: true, currency: true } } } },
} satisfies Prisma.PurchaseOrderInclude;
type OrderRow = Prisma.PurchaseOrderGetPayload<{ include: typeof orderInclude }>;
type InvoiceRow = NonNullable<OrderRow['invoice']>;

const label = (v: string): string => v.toLowerCase().replace(/_/g, ' ');
const money = (minor: number, currency: string) => formatMoney(minor, currency);

@Injectable()
export class PurchasingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly rbac: RbacService,
  ) {}

  // ================================================================ reads
  async list(propertyId: string, query: OrdersQuery, access: AccessContext): Promise<PurchaseOrderView[]> {
    assertCan(access, 'purchasing.read', propertyId);
    return this.prisma.forTenant(async (tx) => {
      await this.requireProperty(tx, propertyId);
      const rows = await tx.purchaseOrder.findMany({ where: { propertyId, ...(query.status ? { status: query.status } : {}) }, include: orderInclude, orderBy: { requestedAt: 'desc' }, take: 200 });
      return this.views(tx, rows);
    });
  }

  async listInvoices(propertyId: string, query: InvoicesQuery, access: AccessContext): Promise<SupplierInvoiceView[]> {
    assertCan(access, 'purchasing.read', propertyId);
    return this.prisma.forTenant(async (tx) => {
      await this.requireProperty(tx, propertyId);
      const today = toDateString(new Date(todayIn((await this.requireProperty(tx, propertyId)).timezone) + 'T00:00:00Z'));
      const rows = await tx.supplierInvoice.findMany({
        where: { propertyId, ...(query.status ? { status: query.status } : {}) },
        include: { supplier: { select: { name: true } }, purchaseOrder: { select: { code: true, currency: true } } },
        orderBy: [{ status: 'asc' }, { dueOn: 'asc' }],
        take: 200,
      });
      return rows.map((r) => this.invoiceView(r, today));
    });
  }

  // ================================================================ request
  async create(propertyId: string, dto: CreateOrderInput, access: AccessContext): Promise<PurchaseOrderView> {
    assertCan(access, 'purchasing.request', propertyId);
    return this.prisma.forTenant(async (tx) => {
      const property = await this.requireProperty(tx, propertyId);
      if (!(await tx.supplier.findFirst({ where: { id: dto.supplierId, deletedAt: null }, select: { id: true } }))) throw badRequest('INVALID_SUPPLIER', 'That supplier does not exist (or was archived).');
      const ids = dto.lines.map((l) => l.itemId);
      if ((await tx.inventoryItem.count({ where: { id: { in: ids }, deletedAt: null } })) !== ids.length) throw badRequest('INVALID_ITEM', 'One of the items does not exist (or was archived).');

      const order = await tx.purchaseOrder.create({
        data: {
          organizationId: access.organizationId,
          propertyId,
          code: await this.newCode(tx),
          supplierId: dto.supplierId,
          notes: emptyToNull(dto.notes) ?? null,
          currency: property.currency,
          totalMinor: poTotal(dto.lines),
          requestedById: access.userId,
          lines: { create: dto.lines.map((l) => ({ organizationId: access.organizationId, itemId: l.itemId, quantity: l.quantity, unitCostMinor: l.unitCostMinor })) },
        },
        include: orderInclude,
      });
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId, action: 'purchasing.requested', entity: 'purchase_order', entityId: order.id, after: { code: order.code, supplier: order.supplier.name, lines: order.lines.length, total: money(order.totalMinor, order.currency) } });
      return (await this.views(tx, [order]))[0]!;
    });
  }

  // ================================================================ approve / reject / cancel
  async decide(id: string, dto: DecisionInput, access: AccessContext): Promise<PurchaseOrderView> {
    return this.prisma.forTenant(async (tx) => {
      const order = await this.load(tx, id);
      assertCan(access, 'purchasing.read', order.propertyId);
      const canApprove = access.can('purchasing.approve', order.propertyId);
      if (dto.action === 'cancel') {
        const own = order.requestedById === access.userId && access.can('purchasing.request', order.propertyId);
        if (!canApprove && !own) throw new AppException('FORBIDDEN', 'Only the requester or an approver can cancel this request.', HttpStatus.FORBIDDEN);
      } else if (!canApprove) {
        throw new AppException('FORBIDDEN', 'You do not have permission to approve or reject purchases here.', HttpStatus.FORBIDDEN);
      }
      if (!PO_DECISION_FROM[dto.action].includes(order.status)) {
        throw conflict('INVALID_TRANSITION', `This order is ${label(order.status)}, so you can't ${dto.action} it.`);
      }

      let selfApproved = false;
      if (dto.action === 'approve') {
        const others = (await this.rbac.assignableStaff(tx, order.propertyId, 'purchasing.approve')).filter((s) => s.id !== order.requestedById).length;
        if (!mayApprove(order.requestedById, access.userId, others)) {
          throw new AppException('SELF_APPROVAL', "You can't approve your own request. Ask another approver.", HttpStatus.FORBIDDEN);
        }
        selfApproved = order.requestedById === access.userId;
      }

      const result = PO_DECISION_RESULT[dto.action];
      const changed = await tx.purchaseOrder.updateMany({
        where: { id, status: order.status },
        data: { status: result, decidedAt: new Date(), decisionNote: emptyToNull(dto.note) ?? null, ...(dto.action === 'cancel' ? {} : { approvedById: access.userId }) },
      });
      if (changed.count === 0) throw conflict('ORDER_CHANGED', 'Someone else just changed this order. Refresh and try again.');
      await this.audit.record(tx, {
        organizationId: access.organizationId, actorId: access.userId, propertyId: order.propertyId, action: `purchasing.${dto.action}`, entity: 'purchase_order', entityId: id,
        before: { code: order.code, status: order.status }, after: { status: result, note: emptyToNull(dto.note) ?? null, ...(selfApproved ? { selfApproved: 'no other approver was available' } : {}) },
      });
      return (await this.views(tx, [await this.load(tx, id)]))[0]!;
    });
  }

  // ================================================================ receive goods into stock
  /** Receiving adds to the stock ledger. You can never receive more than was ordered; two people receiving at once take turns. */
  async receive(id: string, dto: ReceiveInput, access: AccessContext): Promise<PurchaseOrderView> {
    return this.prisma.forTenant(async (tx) => {
      const probe = await tx.purchaseOrder.findFirst({ where: { id }, select: { propertyId: true } });
      if (!probe) throw notFound('Purchase order');
      assertCan(access, 'purchasing.receive', probe.propertyId);

      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`po:${id}`}))`;
      const order = await this.load(tx, id); // re-read AFTER the lock so concurrent receipts see each other
      if (!RECEIVABLE_STATUSES.includes(order.status)) throw conflict('NOT_RECEIVABLE', `This order is ${label(order.status)}, so goods can't be received against it.`);

      const wanted = new Map<string, number>();
      for (const l of dto.lines) {
        if (wanted.has(l.lineId)) throw badRequest('DUPLICATE_LINE', 'Each line can appear once.');
        wanted.set(l.lineId, l.quantity);
      }
      const byId = new Map(order.lines.map((l) => [l.id, l] as [string, (typeof order.lines)[number]]));
      for (const [lineId, quantity] of wanted) {
        const line = byId.get(lineId);
        if (!line) throw badRequest('INVALID_LINE', 'One of the lines does not belong to this order.');
        const remaining = remainingToReceive(line);
        if (quantity > remaining) throw conflict('OVER_RECEIPT', `Only ${remaining} ${line.item.unit} of ${line.item.name} is still expected.`);
      }

      await tx.stockMovement.createMany({
        data: [...wanted].map(([lineId, quantity]) => {
          const line = byId.get(lineId)!;
          return { organizationId: access.organizationId, propertyId: order.propertyId, itemId: line.itemId, type: 'PURCHASE_RECEIPT' as const, quantity, unitCostMinor: line.unitCostMinor, purchaseOrderId: id, note: `Received on ${order.code}`, createdById: access.userId };
        }),
      });
      for (const [lineId, quantity] of wanted) await tx.purchaseOrderLine.update({ where: { id: lineId }, data: { receivedQuantity: { increment: quantity } }, select: { id: true } });

      const updated = order.lines.map((l) => ({ quantity: l.quantity, receivedQuantity: l.receivedQuantity + (wanted.get(l.id) ?? 0) }));
      const status = receiptStatus(updated);
      await tx.purchaseOrder.updateMany({ where: { id, status: order.status }, data: { status, ...(status === 'RECEIVED' ? { receivedAt: new Date() } : {}) } });
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId: order.propertyId, action: 'purchasing.received', entity: 'purchase_order', entityId: id, before: { code: order.code, status: order.status }, after: { status, received: [...wanted].map(([lineId, q]) => `${byId.get(lineId)!.item.name} x ${q}`) } });
      return (await this.views(tx, [await this.load(tx, id)]))[0]!;
    });
  }

  // ================================================================ supplier invoice and payment
  /** Records the supplier's invoice and compares it with what was actually received. A difference is shown, never hidden. */
  async invoice(id: string, dto: InvoiceInput, access: AccessContext): Promise<PurchaseOrderView> {
    return this.prisma.forTenant(async (tx) => {
      const order = await this.load(tx, id);
      assertCan(access, 'purchasing.pay', order.propertyId);
      if (!INVOICEABLE_STATUSES.includes(order.status)) throw conflict('NOT_INVOICEABLE', 'An invoice can be recorded once some of the goods have been received.');
      if (order.invoice) throw conflict('ALREADY_INVOICED', 'This order already has an invoice.');

      const matched = receivedValue(order.lines);
      await tx.supplierInvoice.create({
        data: { organizationId: access.organizationId, propertyId: order.propertyId, purchaseOrderId: id, supplierId: order.supplierId, number: dto.number, amountMinor: dto.amountMinor, receivedValueMinor: matched, issuedOn: parseDate(dto.issuedOn), dueOn: parseDate(dto.dueOn), createdById: access.userId },
        select: { id: true },
      });
      const variance = invoiceVariance(dto.amountMinor, matched);
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId: order.propertyId, action: 'purchasing.invoiced', entity: 'purchase_order', entityId: id, after: { code: order.code, invoice: dto.number, amount: money(dto.amountMinor, order.currency), receivedValue: money(matched, order.currency), variance: money(variance, order.currency) } });
      return (await this.views(tx, [await this.load(tx, id)]))[0]!;
    });
  }

  /** Paying marks the invoice paid and records the expense, in one step and exactly once. */
  async payInvoice(invoiceId: string, dto: PayInvoiceInput, access: AccessContext): Promise<SupplierInvoiceView> {
    return this.prisma.forTenant(async (tx) => {
      const inv = await tx.supplierInvoice.findFirst({ where: { id: invoiceId }, include: { supplier: { select: { name: true } }, purchaseOrder: { select: { code: true, currency: true } }, property: { select: { timezone: true } } } });
      if (!inv) throw notFound('Supplier invoice');
      assertCan(access, 'purchasing.pay', inv.propertyId);

      const now = new Date();
      const claimed = await tx.supplierInvoice.updateMany({ where: { id: invoiceId, status: 'UNPAID' }, data: { status: 'PAID', paidAt: now, paidMethod: dto.method, paidReference: emptyToNull(dto.reference) ?? null } });
      if (claimed.count === 0) throw conflict('ALREADY_PAID', 'This invoice has already been paid.');

      await tx.expense.create({
        data: {
          organizationId: access.organizationId, propertyId: inv.propertyId, category: 'INVENTORY', vendor: inv.supplier.name, supplierId: inv.supplierId,
          incurredOn: parseDate(todayIn(inv.property.timezone)), amountMinor: inv.amountMinor, paymentMethod: dto.method, reference: emptyToNull(dto.reference) ?? inv.number,
          note: `Supplier invoice ${inv.number} (${inv.purchaseOrder.code})`, source: 'PURCHASING', supplierInvoiceId: invoiceId, createdById: access.userId,
        },
        select: { id: true },
      });
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId: inv.propertyId, action: 'purchasing.invoice_paid', entity: 'supplier_invoice', entityId: invoiceId, after: { invoice: inv.number, supplier: inv.supplier.name, amount: money(inv.amountMinor, inv.purchaseOrder.currency), method: dto.method } });
      const fresh = await tx.supplierInvoice.findFirstOrThrow({ where: { id: invoiceId }, include: { supplier: { select: { name: true } }, purchaseOrder: { select: { code: true, currency: true } } } });
      return this.invoiceView(fresh, todayIn(inv.property.timezone));
    });
  }

  // ================================================================ internals
  private async load(tx: Tx, id: string): Promise<OrderRow> {
    const order = await tx.purchaseOrder.findFirst({ where: { id }, include: orderInclude });
    if (!order) throw notFound('Purchase order');
    return order;
  }

  private async views(tx: Tx, orders: OrderRow[]): Promise<PurchaseOrderView[]> {
    const names = await userNames(tx, orders.flatMap((o) => [o.requestedById, o.approvedById]));
    return orders.map((o) => ({
      id: o.id, code: o.code, propertyId: o.propertyId, supplierId: o.supplierId, supplierName: o.supplier.name, status: o.status, notes: o.notes, currency: o.currency,
      totalMinor: o.totalMinor, receivedValueMinor: receivedValue(o.lines),
      requestedById: o.requestedById, requestedByName: o.requestedById ? (names.get(o.requestedById) ?? null) : null, requestedAt: o.requestedAt.toISOString(),
      approvedByName: o.approvedById ? (names.get(o.approvedById) ?? null) : null, decisionNote: o.decisionNote,
      lines: o.lines.map((l) => ({ id: l.id, itemId: l.itemId, itemName: l.item.name, sku: l.item.sku, unit: l.item.unit, quantity: l.quantity, unitCostMinor: l.unitCostMinor, receivedQuantity: l.receivedQuantity })),
      invoice: o.invoice ? this.invoiceView(o.invoice, toDateString(new Date())) : null,
    }));
  }

  private invoiceView(i: { id: string; purchaseOrderId: string; number: string; amountMinor: number; receivedValueMinor: number; issuedOn: Date; dueOn: Date; status: 'UNPAID' | 'PAID'; paidAt: Date | null; supplier: { name: string }; purchaseOrder: { code: string; currency: string } }, today: string): SupplierInvoiceView {
    const dueOn = toDateString(i.dueOn);
    return {
      id: i.id, purchaseOrderId: i.purchaseOrderId, purchaseOrderCode: i.purchaseOrder.code, supplierName: i.supplier.name, number: i.number, amountMinor: i.amountMinor,
      receivedValueMinor: i.receivedValueMinor, varianceMinor: invoiceVariance(i.amountMinor, i.receivedValueMinor), issuedOn: toDateString(i.issuedOn), dueOn,
      status: i.status, overdue: i.status === 'UNPAID' && dueOn < today, paidAt: i.paidAt?.toISOString() ?? null, currency: i.purchaseOrder.currency,
    };
  }

  private async requireProperty(tx: Tx, propertyId: string) {
    const property = await tx.property.findFirst({ where: { id: propertyId, deletedAt: null }, select: { id: true, currency: true, timezone: true } });
    if (!property) throw notFound('Property');
    return property;
  }

  private async newCode(tx: Tx): Promise<string> {
    for (let i = 0; i < 6; i++) {
      const code = `PO-${randomBytes(3).toString('hex').toUpperCase()}`;
      if (!(await tx.purchaseOrder.findFirst({ where: { code }, select: { id: true } }))) return code;
    }
    throw conflict('CODE_UNAVAILABLE', 'Could not generate an order number. Please try again.');
  }
}
