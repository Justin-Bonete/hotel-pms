import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { addDays, calcTaxMinor, eachNight, formatRate, nightlyRatesFrom, parseDate, toDateString } from '@pms/types';
import { conflict } from '../../common/http/errors';
import type { Tx } from '../../database/prisma/prisma.service';

export interface StayForBilling {
  id: string;
  organizationId: string;
  propertyId: string;
  currency: string;
  arrivalDate: Date;
  departureDate: Date;
  totalMinor: number;
  nightlyRates: unknown;
  roomNumber: string;
  roomTypeName: string;
}

export interface BalanceSnapshot {
  itemsMinor: number;
  paidMinor: number;
  refundedMinor: number;
  balanceMinor: number;
}

/**
 * Low-level folio operations that must run INSIDE the caller's transaction, so a check-in and its room
 * charges (or a check-out and its settlement check) succeed or fail together.
 */
@Injectable()
export class FolioLedger {
  /** One folio per reservation, created on first need (deposit, charge or check-in). */
  async ensureFolio(tx: Tx, stay: Pick<StayForBilling, 'id' | 'organizationId' | 'propertyId' | 'currency'>) {
    return tx.folio.upsert({
      where: { reservationId: stay.id },
      update: {},
      create: { organizationId: stay.organizationId, propertyId: stay.propertyId, reservationId: stay.id, currency: stay.currency },
    });
  }

  /**
   * Posts one ROOM_CHARGE per night (at the price quoted at booking) plus a TAX line per active room tax.
   * Safe to call twice: the first caller claims the folio row, later callers do nothing.
   */
  async postRoomCharges(tx: Tx, stay: StayForBilling, actorId: string | null): Promise<boolean> {
    const folio = await this.ensureFolio(tx, stay);
    const claimed = await tx.folio.updateMany({ where: { id: folio.id, roomChargesPostedAt: null, status: 'OPEN' }, data: { roomChargesPostedAt: new Date() } });
    if (claimed.count === 0) return false;

    const nights = eachNight(toDateString(stay.arrivalDate), toDateString(stay.departureDate));
    const rates = nightlyRatesFrom(stay.nightlyRates, nights.length, stay.totalMinor);
    const rows = await this.nightRows(tx, stay, folio.id, nights, rates, actorId);
    if (rows.length > 0) await tx.folioItem.createMany({ data: rows });
    return true;
  }

  /** An in-house guest stays longer: bill the added nights (and their taxes) from `fromDate`. Returns false if the folio is closed. */
  async postExtraNights(tx: Tx, stay: StayForBilling, fromDate: string, rates: number[], actorId: string | null): Promise<boolean> {
    const folio = await this.ensureFolio(tx, stay);
    if (folio.status !== 'OPEN') return false;
    const nights = rates.map((_, i) => addDays(fromDate, i));
    const rows = await this.nightRows(tx, stay, folio.id, nights, rates, actorId);
    if (rows.length > 0) await tx.folioItem.createMany({ data: rows });
    return true;
  }

  private async nightRows(tx: Tx, stay: StayForBilling, folioId: string, nights: string[], rates: number[], actorId: string | null): Promise<Prisma.FolioItemCreateManyInput[]> {
    const taxes = await tx.tax.findMany({ where: { propertyId: stay.propertyId, isActive: true, deletedAt: null, appliesToRoom: true }, orderBy: { name: 'asc' } });
    const rows: Prisma.FolioItemCreateManyInput[] = [];
    nights.forEach((night, i) => {
      const amount = rates[i] ?? 0;
      const id = randomUUID();
      rows.push({
        id,
        organizationId: stay.organizationId,
        folioId,
        type: 'ROOM_CHARGE',
        description: `Room ${stay.roomNumber} · ${stay.roomTypeName}`,
        serviceDate: parseDate(night),
        quantity: 1,
        unitAmountMinor: amount,
        amountMinor: amount,
        source: 'SYSTEM',
        createdById: actorId,
      });
      for (const tax of taxes) {
        const taxAmount = calcTaxMinor(amount, tax.rateBps);
        if (taxAmount === 0) continue;
        rows.push({
          id: randomUUID(),
          organizationId: stay.organizationId,
          folioId,
          type: 'TAX',
          description: `${tax.name} (${formatRate(tax.rateBps)})`,
          serviceDate: parseDate(night),
          quantity: 1,
          unitAmountMinor: taxAmount,
          amountMinor: taxAmount,
          parentItemId: id,
          taxId: tax.id,
          source: 'SYSTEM',
          createdById: actorId,
        });
      }
    });
    return rows;
  }

  /**
   * Posts one extra charge (and its taxes) to an OPEN folio, inside the caller's transaction. Used by the POS to bill a
   * guest's room. Refuses if the bill is already closed. Returns the id of the charge line.
   */
  async postExtraCharge(
    tx: Tx,
    stay: Pick<StayForBilling, 'id' | 'organizationId' | 'propertyId' | 'currency'>,
    input: { description: string; quantity: number; unitAmountMinor: number; taxable: boolean; source: string; actorId: string | null },
  ): Promise<string> {
    const folio = await this.ensureFolio(tx, stay);
    if (folio.status !== 'OPEN') throw conflict('FOLIO_CLOSED', "This guest's bill is already closed, so nothing more can be charged to it.");
    const amount = input.quantity * input.unitAmountMinor;
    const id = randomUUID();
    const rows: Prisma.FolioItemCreateManyInput[] = [
      { id, organizationId: stay.organizationId, folioId: folio.id, type: 'EXTRA_CHARGE', description: input.description, quantity: input.quantity, unitAmountMinor: input.unitAmountMinor, amountMinor: amount, source: input.source, createdById: input.actorId },
    ];
    if (input.taxable) {
      const taxes = await tx.tax.findMany({ where: { propertyId: stay.propertyId, isActive: true, deletedAt: null, appliesToExtras: true }, orderBy: { name: 'asc' } });
      for (const tax of taxes) {
        const taxAmount = calcTaxMinor(amount, tax.rateBps);
        if (taxAmount > 0) rows.push({ id: randomUUID(), organizationId: stay.organizationId, folioId: folio.id, type: 'TAX', description: `${tax.name} (${formatRate(tax.rateBps)})`, quantity: 1, unitAmountMinor: taxAmount, amountMinor: taxAmount, parentItemId: id, taxId: tax.id, source: 'SYSTEM', createdById: input.actorId });
      }
    }
    await tx.folioItem.createMany({ data: rows });
    return id;
  }

  /** Reverses a charge and its tax lines by appending reversal lines (nothing is deleted). Already-reversed is a no-op. Needs an OPEN folio. */
  async reverseItem(tx: Tx, itemId: string, reason: string, source: string, actorId: string | null): Promise<void> {
    const item = await tx.folioItem.findFirst({ where: { id: itemId }, include: { folio: true, taxLines: true, reversedBy: { select: { id: true } } } });
    if (!item) throw conflict('FOLIO_LINE_MISSING', 'The bill line for this sale could not be found.');
    if (item.reversedBy) return;
    if (item.folio.status !== 'OPEN') throw conflict('FOLIO_CLOSED', "This guest's bill is already closed, so the charge can't be reversed here. Ask a manager to adjust the closed bill.");

    const reversalOfParent = randomUUID();
    const rows: Prisma.FolioItemCreateManyInput[] = [item, ...item.taxLines].map((line) => ({
      id: line.id === item.id ? reversalOfParent : randomUUID(),
      organizationId: line.organizationId,
      folioId: line.folioId,
      type: 'REVERSAL' as const,
      description: `VOID: ${line.description}`,
      serviceDate: line.serviceDate,
      quantity: 1,
      unitAmountMinor: -line.amountMinor,
      amountMinor: -line.amountMinor,
      parentItemId: line.id === item.id ? null : reversalOfParent,
      reversesItemId: line.id,
      reason,
      source,
      createdById: actorId,
    }));
    rows.sort((a, b) => (a.id === reversalOfParent ? -1 : b.id === reversalOfParent ? 1 : 0));
    await tx.folioItem.createMany({ data: rows });
  }

  async balance(tx: Tx, folioId: string): Promise<BalanceSnapshot> {
    const [items, payments, refunds] = await Promise.all([
      tx.folioItem.aggregate({ where: { folioId }, _sum: { amountMinor: true } }),
      tx.payment.aggregate({ where: { folioId }, _sum: { amountMinor: true } }),
      tx.refund.aggregate({ where: { payment: { folioId } }, _sum: { amountMinor: true } }),
    ]);
    const itemsMinor = items._sum.amountMinor ?? 0;
    const paidMinor = payments._sum.amountMinor ?? 0;
    const refundedMinor = refunds._sum.amountMinor ?? 0;
    return { itemsMinor, paidMinor, refundedMinor, balanceMinor: itemsMinor - paidMinor + refundedMinor };
  }

  async close(tx: Tx, folioId: string): Promise<void> {
    await tx.folio.updateMany({ where: { id: folioId, status: 'OPEN' }, data: { status: 'CLOSED', closedAt: new Date() } });
  }
}
