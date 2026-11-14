"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatRate = exports.calcTaxMinor = exports.PAYABLE_RESERVATION_STATUSES = exports.PAYMENT_METHODS = exports.VOIDABLE_ITEM_TYPES = exports.FOLIO_ITEM_TYPES = exports.FOLIO_STATUSES = void 0;
exports.splitTotal = splitTotal;
exports.nightlyRatesFrom = nightlyRatesFrom;
exports.computeFolioTotals = computeFolioTotals;
exports.FOLIO_STATUSES = ['OPEN', 'CLOSED'];
exports.FOLIO_ITEM_TYPES = ['ROOM_CHARGE', 'EXTRA_CHARGE', 'TAX', 'DISCOUNT', 'ADJUSTMENT', 'REVERSAL'];
/** Items a user may void. Tax lines are reversed together with the charge they belong to. */
exports.VOIDABLE_ITEM_TYPES = ['ROOM_CHARGE', 'EXTRA_CHARGE', 'DISCOUNT', 'ADJUSTMENT'];
exports.PAYMENT_METHODS = ['CASH', 'CARD', 'BANK_TRANSFER', 'E_WALLET', 'OTHER'];
/** Payments are accepted from booking until (and, to settle a balance, after) the stay. */
exports.PAYABLE_RESERVATION_STATUSES = ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'];
// ------------------------------------------------------------------ pure money logic (whole minor units)
/** Percentage tax in basis points (1200 = 12%), rounded half-up, on a POSITIVE base. */
const calcTaxMinor = (baseMinor, rateBps) => baseMinor <= 0 ? 0 : Math.floor((baseMinor * rateBps + 5000) / 10000);
exports.calcTaxMinor = calcTaxMinor;
/** Splits a total into `parts` whole amounts that add up EXACTLY (remainder spread over the first parts). */
function splitTotal(totalMinor, parts) {
    if (parts <= 0)
        return [];
    const base = Math.floor(totalMinor / parts);
    const remainder = totalMinor - base * parts;
    return Array.from({ length: parts }, (_, i) => base + (i < remainder ? 1 : 0));
}
/**
 * Nightly prices to bill. Uses the price snapshot taken at booking when it is consistent with the stored
 * total; otherwise (older reservations) spreads the stored total evenly. Always sums to totalMinor.
 */
function nightlyRatesFrom(snapshot, nights, totalMinor) {
    if (Array.isArray(snapshot) && snapshot.length === nights && snapshot.every((n) => Number.isInteger(n) && n >= 0)) {
        const rates = snapshot;
        if (rates.reduce((a, b) => a + b, 0) === totalMinor)
            return rates;
    }
    return splitTotal(totalMinor, nights);
}
function computeFolioTotals(input) {
    const sum = (rows) => rows.reduce((total, r) => total + r.amountMinor, 0);
    const itemsMinor = sum(input.items);
    const paidMinor = sum(input.payments);
    const refundedMinor = sum(input.refunds);
    return { itemsMinor, paidMinor, refundedMinor, balanceMinor: itemsMinor - paidMinor + refundedMinor };
}
const formatRate = (rateBps) => `${(rateBps / 100).toFixed(rateBps % 100 === 0 ? 0 : 2)}%`;
exports.formatRate = formatRate;
//# sourceMappingURL=billing.js.map