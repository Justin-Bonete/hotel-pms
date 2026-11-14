"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderForDisplay = orderForDisplay;
/**
 * Room nights in date order, each tax line directly under the charge it was calculated on, voids next to
 * the lines they cancel, and extras (no service date) last. Lines saved in one batch share a timestamp,
 * so database order alone is not enough.
 */
function orderForDisplay(items) {
    const children = new Map();
    const roots = [];
    for (const item of items) {
        if (item.parentItemId)
            children.set(item.parentItemId, [...(children.get(item.parentItemId) ?? []), item]);
        else
            roots.push(item);
    }
    const day = (i) => (i.serviceDate ? i.serviceDate.toISOString().slice(0, 10) : '9999-12-31');
    roots.sort((a, b) => day(a).localeCompare(day(b)) || a.createdAt.getTime() - b.createdAt.getTime());
    return roots.flatMap((root) => [root, ...(children.get(root.id) ?? []).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())]);
}
//# sourceMappingURL=folio-display.js.map