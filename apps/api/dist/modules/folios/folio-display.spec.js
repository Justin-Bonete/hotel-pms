"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const folio_display_1 = require("./folio-display");
const day = (s) => new Date(`${s}T00:00:00Z`);
const at = (ms) => new Date(1_700_000_000_000 + ms);
const line = (id, over = {}) => ({
    id, parentItemId: null, serviceDate: null, createdAt: at(0), reversesItemId: null, ...over,
});
(0, vitest_1.describe)('orderForDisplay', () => {
    (0, vitest_1.it)('puts each tax line directly under the charge it belongs to, even if it was saved first', () => {
        const items = [
            line('tax1', { parentItemId: 'room1', serviceDate: day('2026-10-01') }),
            line('room2', { serviceDate: day('2026-10-02') }),
            line('room1', { serviceDate: day('2026-10-01') }),
            line('tax2', { parentItemId: 'room2', serviceDate: day('2026-10-02') }),
        ];
        (0, vitest_1.expect)((0, folio_display_1.orderForDisplay)(items).map((i) => i.id)).toEqual(['room1', 'tax1', 'room2', 'tax2']);
    });
    (0, vitest_1.it)('keeps a void next to the line it cancels and puts extras last', () => {
        const items = [
            line('minibar', { createdAt: at(5) }),
            line('void1', { serviceDate: day('2026-10-01'), createdAt: at(9), reversesItemId: 'room1' }),
            line('voidtax1', { parentItemId: 'void1', serviceDate: day('2026-10-01'), createdAt: at(9), reversesItemId: 'tax1' }),
            line('room1', { serviceDate: day('2026-10-01') }),
            line('tax1', { parentItemId: 'room1', serviceDate: day('2026-10-01') }),
        ];
        (0, vitest_1.expect)((0, folio_display_1.orderForDisplay)(items).map((i) => i.id)).toEqual(['room1', 'tax1', 'void1', 'voidtax1', 'minibar']);
    });
    (0, vitest_1.it)('does not lose or duplicate lines', () => {
        const items = [line('a'), line('b', { parentItemId: 'a' }), line('c', { parentItemId: 'a' })];
        (0, vitest_1.expect)((0, folio_display_1.orderForDisplay)(items)).toHaveLength(3);
    });
});
//# sourceMappingURL=folio-display.spec.js.map