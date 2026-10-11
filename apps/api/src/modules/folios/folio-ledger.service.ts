import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { calcTaxMinor, eachNight, formatRate, nightlyRatesFrom, parseDate, toDateString } from '@pms/types';
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
    const taxes = await tx.tax.findMany({ where: { propertyId: stay.propertyId, isActive: true, deletedAt: null, appliesToRoom: true }, orderBy: { name: 'asc' } });

    const rows: Prisma.FolioItemCreateManyInput[] = [];
    nights.forEach((night, i) => {
      const amount = rates[i] ?? 0;
      const id = randomUUID();
      rows.push({
        id,
        organizationId: stay.organizationId,
        folioId: folio.id,
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
          folioId: folio.id,
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
    if (rows.length > 0) await tx.folioItem.createMany({ data: rows });
    return true;
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
