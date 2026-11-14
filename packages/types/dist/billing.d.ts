export declare const FOLIO_STATUSES: readonly ["OPEN", "CLOSED"];
export type FolioStatus = (typeof FOLIO_STATUSES)[number];
export declare const FOLIO_ITEM_TYPES: readonly ["ROOM_CHARGE", "EXTRA_CHARGE", "TAX", "DISCOUNT", "ADJUSTMENT", "REVERSAL"];
export type FolioItemType = (typeof FOLIO_ITEM_TYPES)[number];
/** Items a user may void. Tax lines are reversed together with the charge they belong to. */
export declare const VOIDABLE_ITEM_TYPES: readonly FolioItemType[];
export declare const PAYMENT_METHODS: readonly ["CASH", "CARD", "BANK_TRANSFER", "E_WALLET", "OTHER"];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
/** Payments are accepted from booking until (and, to settle a balance, after) the stay. */
export declare const PAYABLE_RESERVATION_STATUSES: readonly ["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT"];
/** Percentage tax in basis points (1200 = 12%), rounded half-up, on a POSITIVE base. */
export declare const calcTaxMinor: (baseMinor: number, rateBps: number) => number;
/** Splits a total into `parts` whole amounts that add up EXACTLY (remainder spread over the first parts). */
export declare function splitTotal(totalMinor: number, parts: number): number[];
/**
 * Nightly prices to bill. Uses the price snapshot taken at booking when it is consistent with the stored
 * total; otherwise (older reservations) spreads the stored total evenly. Always sums to totalMinor.
 */
export declare function nightlyRatesFrom(snapshot: unknown, nights: number, totalMinor: number): number[];
export interface FolioTotals {
    /** Sum of every line (charges, taxes, discounts, reversals), net. */
    itemsMinor: number;
    paidMinor: number;
    refundedMinor: number;
    /** itemsMinor - paid + refunded. Positive = the guest owes money. Negative = the guest is in credit. */
    balanceMinor: number;
}
export declare function computeFolioTotals(input: {
    items: ReadonlyArray<{
        amountMinor: number;
    }>;
    payments: ReadonlyArray<{
        amountMinor: number;
    }>;
    refunds: ReadonlyArray<{
        amountMinor: number;
    }>;
}): FolioTotals;
export declare const formatRate: (rateBps: number) => string;
export interface TaxView {
    id: string;
    propertyId: string;
    name: string;
    rateBps: number;
    appliesToRoom: boolean;
    appliesToExtras: boolean;
    isActive: boolean;
}
export interface FolioItemView {
    id: string;
    type: FolioItemType;
    description: string;
    /** YYYY-MM-DD for room nights */
    serviceDate: string | null;
    quantity: number;
    unitAmountMinor: number;
    amountMinor: number;
    parentItemId: string | null;
    reversesItemId: string | null;
    /** true when a later REVERSAL cancelled this line */
    voided: boolean;
    /** can the user still void this line (right type, not voided, folio open)? */
    voidable: boolean;
    reason: string | null;
    createdAt: string;
}
export interface RefundView {
    id: string;
    amountMinor: number;
    reason: string;
    createdAt: string;
}
export interface PaymentView {
    id: string;
    amountMinor: number;
    refundedMinor: number;
    method: PaymentMethod;
    reference: string | null;
    note: string | null;
    createdAt: string;
    refunds: RefundView[];
}
export interface FolioView {
    /** null until the first charge or payment creates the folio */
    id: string | null;
    reservationId: string;
    reservationCode: string;
    guestName: string;
    propertyName: string;
    status: FolioStatus;
    currency: string;
    roomChargesPosted: boolean;
    items: FolioItemView[];
    payments: PaymentView[];
    totals: FolioTotals;
}
