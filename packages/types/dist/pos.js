"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POS_ORDER_STATUSES = exports.OUTLET_TYPES = void 0;
exports.posLineTotals = posLineTotals;
exports.stockNeeded = stockNeeded;
exports.zonedDayRange = zonedDayRange;
const billing_1 = require("./billing");
exports.OUTLET_TYPES = ['RESTAURANT', 'BAR', 'CAFE', 'ROOM_SERVICE', 'MINIBAR', 'SPA', 'LAUNDRY', 'OTHER'];
exports.POS_ORDER_STATUSES = ['PAID', 'ROOM_CHARGED', 'VOID'];
/**
 * Totals for a sale. Tax is worked out per line and per tax (the same way the folio does it), so a room
 * charge posts to the guest's bill for exactly the amount the receipt shows. Whole centavos throughout.
 */
function posLineTotals(lines, taxes) {
    const out = lines.map((l) => {
        const amountMinor = l.quantity * l.unitAmountMinor;
        const taxMinor = l.taxable ? taxes.reduce((sum, t) => sum + (0, billing_1.calcTaxMinor)(amountMinor, t.rateBps), 0) : 0;
        return { amountMinor, taxMinor };
    });
    const subtotalMinor = out.reduce((s, l) => s + l.amountMinor, 0);
    const taxMinor = out.reduce((s, l) => s + l.taxMinor, 0);
    return { subtotalMinor, taxMinor, totalMinor: subtotalMinor + taxMinor, lines: out };
}
/** Units of each stock item a sale consumes (several lines can use the same item). */
function stockNeeded(lines) {
    const need = new Map();
    for (const l of lines) {
        if (!l.inventoryItemId || l.inventoryQuantity <= 0)
            continue;
        need.set(l.inventoryItemId, (need.get(l.inventoryItemId) ?? 0) + l.quantity * l.inventoryQuantity);
    }
    return need;
}
/**
 * The UTC instants where a local calendar day starts and ends in a time zone (daylight saving included).
 * Used so "today's sales" means the property's own day, not the server's.
 */
function zonedDayRange(date, timeZone) {
    const [y, m, d] = date.split('-').map(Number);
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const offsetAt = (ts) => {
        const parts = formatter.formatToParts(new Date(ts));
        const get = (type) => Number(parts.find((p) => p.type === type)?.value);
        return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - ts;
    };
    const localMidnight = (year, month, day) => {
        const guess = Date.UTC(year, month - 1, day);
        const once = guess - offsetAt(guess);
        return new Date(guess - offsetAt(once));
    };
    return { start: localMidnight(y, m, d), end: localMidnight(y, m, d + 1) };
}
//# sourceMappingURL=pos.js.map