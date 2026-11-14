import { type PaymentMethod } from './billing';
export declare const OUTLET_TYPES: readonly ["RESTAURANT", "BAR", "CAFE", "ROOM_SERVICE", "MINIBAR", "SPA", "LAUNDRY", "OTHER"];
export type OutletType = (typeof OUTLET_TYPES)[number];
export declare const POS_ORDER_STATUSES: readonly ["PAID", "ROOM_CHARGED", "VOID"];
export type PosOrderStatus = (typeof POS_ORDER_STATUSES)[number];
export interface PosLineAmounts {
    quantity: number;
    unitAmountMinor: number;
    taxable: boolean;
}
export interface PosTotals {
    subtotalMinor: number;
    taxMinor: number;
    totalMinor: number;
    lines: Array<{
        amountMinor: number;
        taxMinor: number;
    }>;
}
/**
 * Totals for a sale. Tax is worked out per line and per tax (the same way the folio does it), so a room
 * charge posts to the guest's bill for exactly the amount the receipt shows. Whole centavos throughout.
 */
export declare function posLineTotals(lines: ReadonlyArray<PosLineAmounts>, taxes: ReadonlyArray<{
    rateBps: number;
}>): PosTotals;
/** Units of each stock item a sale consumes (several lines can use the same item). */
export declare function stockNeeded(lines: ReadonlyArray<{
    quantity: number;
    inventoryItemId: string | null;
    inventoryQuantity: number;
}>): Map<string, number>;
/**
 * The UTC instants where a local calendar day starts and ends in a time zone (daylight saving included).
 * Used so "today's sales" means the property's own day, not the server's.
 */
export declare function zonedDayRange(date: string, timeZone: string): {
    start: Date;
    end: Date;
};
export interface PosItemView {
    id: string;
    outletId: string;
    name: string;
    category: string | null;
    priceMinor: number;
    taxable: boolean;
    inventoryItemId: string | null;
    inventoryQuantity: number;
}
export interface PosOutletView {
    id: string;
    name: string;
    type: OutletType;
    items: PosItemView[];
}
export interface PosMenuView {
    currency: string;
    taxes: Array<{
        name: string;
        rateBps: number;
    }>;
    outlets: PosOutletView[];
}
export interface PosOrderLineView {
    id: string;
    description: string;
    quantity: number;
    unitAmountMinor: number;
    amountMinor: number;
    taxMinor: number;
}
export interface PosOrderView {
    id: string;
    code: string;
    propertyId: string;
    outletId: string;
    outletName: string;
    status: PosOrderStatus;
    tableLabel: string | null;
    note: string | null;
    /** Set for a room charge. */
    reservationCode: string | null;
    guestName: string | null;
    roomNumber: string | null;
    paymentMethod: PaymentMethod | null;
    currency: string;
    subtotalMinor: number;
    taxMinor: number;
    totalMinor: number;
    createdByName: string | null;
    createdAt: string;
    voidReason: string | null;
    lines: PosOrderLineView[];
}
export interface PosSummaryView {
    date: string;
    currency: string;
    orders: number;
    salesMinor: number;
    taxMinor: number;
    byOutlet: Array<{
        outletId: string;
        outletName: string;
        orders: number;
        totalMinor: number;
    }>;
    /** How the sales were settled: a payment method, or ROOM_CHARGE (billed to a guest's room). */
    bySettlement: Array<{
        settlement: string;
        orders: number;
        totalMinor: number;
    }>;
    voidedOrders: number;
    voidedMinor: number;
}
