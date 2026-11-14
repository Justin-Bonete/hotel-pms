import { calcTaxMinor, type PaymentMethod } from './billing';

export const OUTLET_TYPES = ['RESTAURANT', 'BAR', 'CAFE', 'ROOM_SERVICE', 'MINIBAR', 'SPA', 'LAUNDRY', 'OTHER'] as const;
export type OutletType = (typeof OUTLET_TYPES)[number];

export const POS_ORDER_STATUSES = ['PAID', 'ROOM_CHARGED', 'VOID'] as const;
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
  lines: Array<{ amountMinor: number; taxMinor: number }>;
}

/**
 * Totals for a sale. Tax is worked out per line and per tax (the same way the folio does it), so a room
 * charge posts to the guest's bill for exactly the amount the receipt shows. Whole centavos throughout.
 */
export function posLineTotals(lines: ReadonlyArray<PosLineAmounts>, taxes: ReadonlyArray<{ rateBps: number }>): PosTotals {
  const out = lines.map((l) => {
    const amountMinor = l.quantity * l.unitAmountMinor;
    const taxMinor = l.taxable ? taxes.reduce((sum, t) => sum + calcTaxMinor(amountMinor, t.rateBps), 0) : 0;
    return { amountMinor, taxMinor };
  });
  const subtotalMinor = out.reduce((s, l) => s + l.amountMinor, 0);
  const taxMinor = out.reduce((s, l) => s + l.taxMinor, 0);
  return { subtotalMinor, taxMinor, totalMinor: subtotalMinor + taxMinor, lines: out };
}

/** Units of each stock item a sale consumes (several lines can use the same item). */
export function stockNeeded(lines: ReadonlyArray<{ quantity: number; inventoryItemId: string | null; inventoryQuantity: number }>): Map<string, number> {
  const need = new Map<string, number>();
  for (const l of lines) {
    if (!l.inventoryItemId || l.inventoryQuantity <= 0) continue;
    need.set(l.inventoryItemId, (need.get(l.inventoryItemId) ?? 0) + l.quantity * l.inventoryQuantity);
  }
  return need;
}

/**
 * The UTC instants where a local calendar day starts and ends in a time zone (daylight saving included).
 * Used so "today's sales" means the property's own day, not the server's.
 */
export function zonedDayRange(date: string, timeZone: string): { start: Date; end: Date } {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const offsetAt = (ts: number): number => {
    const parts = formatter.formatToParts(new Date(ts));
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - ts;
  };
  const localMidnight = (year: number, month: number, day: number): Date => {
    const guess = Date.UTC(year, month - 1, day);
    const once = guess - offsetAt(guess);
    return new Date(guess - offsetAt(once));
  };
  return { start: localMidnight(y, m, d), end: localMidnight(y, m, d + 1) };
}

// ================================================================== views
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
  taxes: Array<{ name: string; rateBps: number }>;
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
  byOutlet: Array<{ outletId: string; outletName: string; orders: number; totalMinor: number }>;
  /** How the sales were settled: a payment method, or ROOM_CHARGE (billed to a guest's room). */
  bySettlement: Array<{ settlement: string; orders: number; totalMinor: number }>;
  voidedOrders: number;
  voidedMinor: number;
}
