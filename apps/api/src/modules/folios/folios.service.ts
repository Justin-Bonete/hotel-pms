import { HttpStatus, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import {
  PAYABLE_RESERVATION_STATUSES,
  VOIDABLE_ITEM_TYPES,
  calcTaxMinor,
  computeFolioTotals,
  formatMoney,
  formatRate,
  toDateString,
  type FolioView,
} from '@pms/types';
import type { AdjustmentInput, ChargeInput, PaymentInput, RefundInput, VoidInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { assertCan } from '../../common/access/assert-access';
import { AppException } from '../../common/http/app-exception';
import { badRequest, conflict, notFound } from '../../common/http/errors';
import { emptyToNull } from '../../common/text/text';
import { PrismaService, Tx } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { orderForDisplay } from './folio-display';
import { FolioLedger } from './folio-ledger.service';

const reservationSelect = {
  id: true, code: true, organizationId: true, propertyId: true, status: true, currency: true,
  guest: { select: { firstName: true, lastName: true } },
  property: { select: { name: true } },
} satisfies Prisma.ReservationSelect;
type ReservationRow = Prisma.ReservationGetPayload<{ select: typeof reservationSelect }>;

const money = (minor: number, currency: string) => formatMoney(minor, currency);

@Injectable()
export class FoliosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: FolioLedger,
    private readonly audit: AuditService,
  ) {}

  // ================================================================ read
  async get(reservationId: string, access: AccessContext): Promise<FolioView> {
    return this.prisma.forTenant(async (tx) => {
      const r = await this.loadReservation(tx, reservationId);
      assertCan(access, 'folio.read', r.propertyId);
      return this.view(tx, r);
    });
  }

  // ================================================================ extra charge
  async addCharge(reservationId: string, dto: ChargeInput, key: string | undefined, access: AccessContext): Promise<FolioView> {
    return this.prisma.forTenant(async (tx) => {
      const r = await this.loadReservation(tx, reservationId);
      assertCan(access, 'folio.charge', r.propertyId);
      if (await this.alreadyDone(tx, 'folioItem', key)) return this.view(tx, r);
      if (r.status !== 'CHECKED_IN') throw conflict('NOT_IN_HOUSE', 'Charges can only be posted while the guest is checked in.');

      const folio = await this.ledger.ensureFolio(tx, r);
      this.assertOpen(folio.status);
      const amount = dto.quantity * dto.unitAmountMinor;
      const id = randomUUID();
      const rows: Prisma.FolioItemCreateManyInput[] = [
        { id, organizationId: r.organizationId, folioId: folio.id, type: 'EXTRA_CHARGE', description: dto.description, quantity: dto.quantity, unitAmountMinor: dto.unitAmountMinor, amountMinor: amount, source: 'FRONT_DESK', idempotencyKey: key ?? null, createdById: access.userId },
      ];
      if (dto.taxable) {
        const taxes = await tx.tax.findMany({ where: { propertyId: r.propertyId, isActive: true, deletedAt: null, appliesToExtras: true }, orderBy: { name: 'asc' } });
        for (const tax of taxes) {
          const t = calcTaxMinor(amount, tax.rateBps);
          if (t > 0) rows.push({ id: randomUUID(), organizationId: r.organizationId, folioId: folio.id, type: 'TAX', description: `${tax.name} (${formatRate(tax.rateBps)})`, quantity: 1, unitAmountMinor: t, amountMinor: t, parentItemId: id, taxId: tax.id, source: 'SYSTEM', createdById: access.userId });
        }
      }
      await tx.folioItem.createMany({ data: rows });
      await this.audit.record(tx, { organizationId: r.organizationId, actorId: access.userId, propertyId: r.propertyId, action: 'folio.charge_posted', entity: 'folio', entityId: folio.id, after: { reservation: r.code, description: dto.description, amount: money(amount, r.currency) } });
      return this.view(tx, r);
    });
  }

  // ================================================================ discount / adjustment
  async addAdjustment(reservationId: string, dto: AdjustmentInput, access: AccessContext): Promise<FolioView> {
    return this.prisma.forTenant(async (tx) => {
      const r = await this.loadReservation(tx, reservationId);
      assertCan(access, 'folio.adjust', r.propertyId);
      if (r.status !== 'CHECKED_IN') throw conflict('NOT_IN_HOUSE', 'Adjustments can only be posted while the guest is checked in.');
      const folio = await this.ledger.ensureFolio(tx, r);
      this.assertOpen(folio.status);

      await tx.folioItem.create({
        data: { organizationId: r.organizationId, folioId: folio.id, type: dto.amountMinor < 0 ? 'DISCOUNT' : 'ADJUSTMENT', description: dto.description, quantity: 1, unitAmountMinor: dto.amountMinor, amountMinor: dto.amountMinor, reason: dto.reason, source: 'FRONT_DESK', createdById: access.userId },
        select: { id: true },
      });
      await this.audit.record(tx, { organizationId: r.organizationId, actorId: access.userId, propertyId: r.propertyId, action: dto.amountMinor < 0 ? 'folio.discount_posted' : 'folio.adjustment_posted', entity: 'folio', entityId: folio.id, after: { reservation: r.code, description: dto.description, amount: money(dto.amountMinor, r.currency), reason: dto.reason } });
      return this.view(tx, r);
    });
  }

  // ================================================================ void (reversal, never delete)
  async voidItem(itemId: string, dto: VoidInput, access: AccessContext): Promise<FolioView> {
    return this.prisma.forTenant(async (tx) => {
      const item = await tx.folioItem.findFirst({ where: { id: itemId }, include: { folio: true, taxLines: true, reversedBy: { select: { id: true } } } });
      if (!item) throw notFound('Folio line');
      const r = await this.loadReservation(tx, item.folio.reservationId);
      assertCan(access, 'folio.adjust', r.propertyId);
      this.assertOpen(item.folio.status);
      if (!VOIDABLE_ITEM_TYPES.includes(item.type)) throw badRequest('NOT_VOIDABLE', 'Tax lines are voided together with the charge they belong to.');
      if (item.reversedBy) throw conflict('ALREADY_VOIDED', 'This line has already been voided.');

      const lines = [item, ...item.taxLines];
      const reversalOfParent = randomUUID();
      const rows: Prisma.FolioItemCreateManyInput[] = lines.map((line) => ({
        id: line.id === item.id ? reversalOfParent : randomUUID(),
        organizationId: r.organizationId,
        folioId: line.folioId,
        type: 'REVERSAL' as const,
        description: `VOID: ${line.description}`,
        serviceDate: line.serviceDate,
        quantity: 1,
        unitAmountMinor: -line.amountMinor,
        amountMinor: -line.amountMinor,
        parentItemId: line.id === item.id ? null : reversalOfParent,
        reversesItemId: line.id,
        reason: dto.reason,
        source: 'FRONT_DESK',
        createdById: access.userId,
      }));
      // Parent row first so the foreign key on parentItemId resolves.
      rows.sort((a, b) => (a.id === reversalOfParent ? -1 : b.id === reversalOfParent ? 1 : 0));
      await tx.folioItem.createMany({ data: rows });
      await this.audit.record(tx, { organizationId: r.organizationId, actorId: access.userId, propertyId: r.propertyId, action: 'folio.item_voided', entity: 'folio_item', entityId: itemId, before: { description: item.description, amount: money(item.amountMinor, r.currency) }, after: { reason: dto.reason, linesReversed: rows.length } });
      return this.view(tx, r);
    });
  }

  // ================================================================ payment / deposit
  async recordPayment(reservationId: string, dto: PaymentInput, key: string | undefined, access: AccessContext): Promise<FolioView> {
    return this.prisma.forTenant(async (tx) => {
      const r = await this.loadReservation(tx, reservationId);
      assertCan(access, 'payment.take', r.propertyId);
      if (await this.alreadyDone(tx, 'payment', key)) return this.view(tx, r);
      if (!(PAYABLE_RESERVATION_STATUSES as readonly string[]).includes(r.status)) {
        throw conflict('NOT_PAYABLE', 'Payments can only be taken for pending, confirmed, in-house or checked-out reservations.');
      }

      const folio = await this.ledger.ensureFolio(tx, r);
      // After the room charges exist, never take more than is owed. (Before check-in a deposit is open-ended.)
      if (folio.roomChargesPostedAt) {
        const { balanceMinor } = await this.ledger.balance(tx, folio.id);
        if (dto.amountMinor > Math.max(balanceMinor, 0)) {
          throw conflict('OVERPAYMENT', `That is more than the balance due (${money(Math.max(balanceMinor, 0), r.currency)}).`);
        }
      }
      const payment = await tx.payment.create({
        data: { organizationId: r.organizationId, folioId: folio.id, amountMinor: dto.amountMinor, method: dto.method, reference: emptyToNull(dto.reference) ?? null, note: emptyToNull(dto.note) ?? null, idempotencyKey: key ?? null, receivedById: access.userId },
        select: { id: true },
      });
      await this.audit.record(tx, { organizationId: r.organizationId, actorId: access.userId, propertyId: r.propertyId, action: 'payment.received', entity: 'payment', entityId: payment.id, after: { reservation: r.code, amount: money(dto.amountMinor, r.currency), method: dto.method } });
      return this.view(tx, r);
    });
  }

  // ================================================================ refund
  async refund(paymentId: string, dto: RefundInput, key: string | undefined, access: AccessContext): Promise<FolioView> {
    return this.prisma.forTenant(async (tx) => {
      const payment = await tx.payment.findFirst({ where: { id: paymentId }, include: { folio: { select: { reservationId: true } } } });
      if (!payment) throw notFound('Payment');
      const r = await this.loadReservation(tx, payment.folio.reservationId);
      assertCan(access, 'payment.refund', r.propertyId);
      if (await this.alreadyDone(tx, 'refund', key)) return this.view(tx, r);

      // Serialize refunds of the same payment so two clicks can't refund more than was paid.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'refund:' + paymentId}))`;
      const already = await tx.refund.aggregate({ where: { paymentId }, _sum: { amountMinor: true } });
      const refundable = payment.amountMinor - (already._sum.amountMinor ?? 0);
      if (dto.amountMinor > refundable) {
        throw new AppException('REFUND_TOO_LARGE', `Only ${money(refundable, r.currency)} of this payment can still be refunded.`, HttpStatus.CONFLICT);
      }
      const refund = await tx.refund.create({
        data: { organizationId: r.organizationId, paymentId, amountMinor: dto.amountMinor, reason: dto.reason, idempotencyKey: key ?? null, createdById: access.userId },
        select: { id: true },
      });
      await this.audit.record(tx, { organizationId: r.organizationId, actorId: access.userId, propertyId: r.propertyId, action: 'payment.refunded', entity: 'refund', entityId: refund.id, before: { payment: money(payment.amountMinor, r.currency) }, after: { reservation: r.code, refunded: money(dto.amountMinor, r.currency), reason: dto.reason } });
      return this.view(tx, r);
    });
  }

  // ================================================================ internals
  private async loadReservation(tx: Tx, id: string): Promise<ReservationRow> {
    const r = await tx.reservation.findFirst({ where: { id }, select: reservationSelect });
    if (!r) throw notFound('Reservation');
    return r;
  }

  private assertOpen(status: string): void {
    if (status !== 'OPEN') throw conflict('FOLIO_CLOSED', 'This folio is closed. Only payments can still be recorded.');
  }

  /** Same Idempotency-Key twice = the first request already did the work. */
  private async alreadyDone(tx: Tx, model: 'payment' | 'refund' | 'folioItem', key: string | undefined): Promise<boolean> {
    if (!key) return false;
    const where = { idempotencyKey: key };
    const found = model === 'payment' ? await tx.payment.findFirst({ where, select: { id: true } }) : model === 'refund' ? await tx.refund.findFirst({ where, select: { id: true } }) : await tx.folioItem.findFirst({ where, select: { id: true } });
    return found !== null;
  }

  private async view(tx: Tx, r: ReservationRow): Promise<FolioView> {
    const folio = await tx.folio.findFirst({
      where: { reservationId: r.id },
      include: {
        items: { orderBy: [{ createdAt: 'asc' }, { serviceDate: 'asc' }], include: { reversedBy: { select: { id: true } } } },
        payments: { orderBy: { createdAt: 'asc' }, include: { refunds: { orderBy: { createdAt: 'asc' } } } },
      },
    });
    const base = { reservationId: r.id, reservationCode: r.code, guestName: `${r.guest.firstName} ${r.guest.lastName}`, propertyName: r.property.name, currency: r.currency };
    if (!folio) return { ...base, id: null, status: 'OPEN', roomChargesPosted: false, items: [], payments: [], totals: computeFolioTotals({ items: [], payments: [], refunds: [] }) };

    const refunds = folio.payments.flatMap((p) => p.refunds);
    const items = orderForDisplay<(typeof folio.items)[number]>(folio.items);
    return {
      ...base,
      id: folio.id,
      status: folio.status,
      currency: folio.currency,
      roomChargesPosted: folio.roomChargesPostedAt !== null,
      items: items.map((i) => ({
        id: i.id,
        type: i.type,
        description: i.description,
        serviceDate: i.serviceDate ? toDateString(i.serviceDate) : null,
        quantity: i.quantity,
        unitAmountMinor: i.unitAmountMinor,
        amountMinor: i.amountMinor,
        parentItemId: i.parentItemId,
        reversesItemId: i.reversesItemId,
        voided: i.reversedBy !== null,
        voidable: folio.status === 'OPEN' && i.reversedBy === null && (VOIDABLE_ITEM_TYPES as readonly string[]).includes(i.type),
        reason: i.reason,
        createdAt: i.createdAt.toISOString(),
      })),
      payments: folio.payments.map((p) => ({
        id: p.id,
        amountMinor: p.amountMinor,
        refundedMinor: p.refunds.reduce((sum, x) => sum + x.amountMinor, 0),
        method: p.method,
        reference: p.reference,
        note: p.note,
        createdAt: p.createdAt.toISOString(),
        refunds: p.refunds.map((x) => ({ id: x.id, amountMinor: x.amountMinor, reason: x.reason, createdAt: x.createdAt.toISOString() })),
      })),
      totals: computeFolioTotals({ items, payments: folio.payments, refunds }),
    };
  }
}
