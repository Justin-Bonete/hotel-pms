export const FOLIO_STATUSES = ['OPEN', 'CLOSED'] as const;
export type FolioStatus = (typeof FOLIO_STATUSES)[number];

export const FOLIO_ITEM_TYPES = ['ROOM_CHARGE', 'EXTRA_CHARGE', 'TAX', 'DISCOUNT', 'ADJUSTMENT', 'REVERSAL'] as const;
export type FolioItemType = (typeof FOLIO_ITEM_TYPES)[number];

/** Items a user may void. Tax lines are reversed together with the charge they belong to. */
export const VOIDABLE_ITEM_TYPES: readonly FolioItemType[] = ['ROOM_CHARGE', 'EXTRA_CHARGE', 'DISCOUNT', 'ADJUSTMENT'];

export const PAYMENT_METHODS = ['CASH', 'CARD', 'BANK_TRANSFER', 'E_WALLET', 'OTHER'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Payments are accepted from booking until (and, to settle a balance, after) the stay. */
export const PAYABLE_RESERVATION_STATUSES = ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] as const;

// ------------------------------------------------------------------ pure money logic (whole minor units)

/** Percentage tax in basis points (1200 = 12%), rounded half-up, on a POSITIVE base. */
export const calcTaxMinor = (baseMinor: number, rateBps: number): number =>
  baseMinor <= 0 ? 0 : Math.floor((baseMinor * rateBps + 5000) / 10000);

/** Splits a total into `parts` whole amounts that add up EXACTLY (remainder spread over the first parts). */
export function splitTotal(totalMinor: number, parts: number): number[] {
  if (parts <= 0) return [];
  const base = Math.floor(totalMinor / parts);
  const remainder = totalMinor - base * parts;
  return Array.from({ length: parts }, (_, i) => base + (i < remainder ? 1 : 0));
}

/**
 * Nightly prices to bill. Uses the price snapshot taken at booking when it is consistent with the stored
 * total; otherwise (older reservations) spreads the stored total evenly. Always sums to totalMinor.
 */
export function nightlyRatesFrom(snapshot: unknown, nights: number, totalMinor: number): number[] {
  if (Array.isArray(snapshot) && snapshot.length === nights && snapshot.every((n) => Number.isInteger(n) && n >= 0)) {
    const rates = snapshot as number[];
    if (rates.reduce((a, b) => a + b, 0) === totalMinor) return rates;
  }
  return splitTotal(totalMinor, nights);
}

export interface FolioTotals {
  /** Sum of every line (charges, taxes, discounts, reversals), net. */
  itemsMinor: number;
  paidMinor: number;
  refundedMinor: number;
  /** itemsMinor - paid + refunded. Positive = the guest owes money. Negative = the guest is in credit. */
  balanceMinor: number;
}

export function computeFolioTotals(input: {
  items: ReadonlyArray<{ amountMinor: number }>;
  payments: ReadonlyArray<{ amountMinor: number }>;
  refunds: ReadonlyArray<{ amountMinor: number }>;
}): FolioTotals {
  const sum = (rows: ReadonlyArray<{ amountMinor: number }>) => rows.reduce((total, r) => total + r.amountMinor, 0);
  const itemsMinor = sum(input.items);
  const paidMinor = sum(input.payments);
  const refundedMinor = sum(input.refunds);
  return { itemsMinor, paidMinor, refundedMinor, balanceMinor: itemsMinor - paidMinor + refundedMinor };
}

export const formatRate = (rateBps: number): string => `${(rateBps / 100).toFixed(rateBps % 100 === 0 ? 0 : 2)}%`;

// ------------------------------------------------------------------ API views

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
