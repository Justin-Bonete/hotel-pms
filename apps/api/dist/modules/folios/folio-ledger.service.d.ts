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
export declare class FolioLedger {
    /** One folio per reservation, created on first need (deposit, charge or check-in). */
    ensureFolio(tx: Tx, stay: Pick<StayForBilling, 'id' | 'organizationId' | 'propertyId' | 'currency'>): Promise<{
        id: string;
        organizationId: string;
        status: import("@prisma/client").$Enums.FolioStatus;
        currency: string;
        createdAt: Date;
        updatedAt: Date;
        propertyId: string;
        reservationId: string;
        roomChargesPostedAt: Date | null;
        closedAt: Date | null;
    }>;
    /**
     * Posts one ROOM_CHARGE per night (at the price quoted at booking) plus a TAX line per active room tax.
     * Safe to call twice: the first caller claims the folio row, later callers do nothing.
     */
    postRoomCharges(tx: Tx, stay: StayForBilling, actorId: string | null): Promise<boolean>;
    /** An in-house guest stays longer: bill the added nights (and their taxes) from `fromDate`. Returns false if the folio is closed. */
    postExtraNights(tx: Tx, stay: StayForBilling, fromDate: string, rates: number[], actorId: string | null): Promise<boolean>;
    private nightRows;
    /**
     * Posts one extra charge (and its taxes) to an OPEN folio, inside the caller's transaction. Used by the POS to bill a
     * guest's room. Refuses if the bill is already closed. Returns the id of the charge line.
     */
    postExtraCharge(tx: Tx, stay: Pick<StayForBilling, 'id' | 'organizationId' | 'propertyId' | 'currency'>, input: {
        description: string;
        quantity: number;
        unitAmountMinor: number;
        taxable: boolean;
        source: string;
        actorId: string | null;
    }): Promise<string>;
    /** Reverses a charge and its tax lines by appending reversal lines (nothing is deleted). Already-reversed is a no-op. Needs an OPEN folio. */
    reverseItem(tx: Tx, itemId: string, reason: string, source: string, actorId: string | null): Promise<void>;
    balance(tx: Tx, folioId: string): Promise<BalanceSnapshot>;
    close(tx: Tx, folioId: string): Promise<void>;
}
