"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const types_1 = require("@pms/types");
const vitest_1 = require("vitest");
(0, vitest_1.describe)('reservation constants match the database', () => {
    (0, vitest_1.it)('statuses and sources are identical to the Prisma enums', () => {
        (0, vitest_1.expect)([...types_1.RESERVATION_STATUSES].sort()).toEqual(Object.values(client_1.ReservationStatus).sort());
        (0, vitest_1.expect)([...types_1.RESERVATION_SOURCES].sort()).toEqual(Object.values(client_1.ReservationSource).sort());
    });
});
(0, vitest_1.describe)('reservation status flow', () => {
    (0, vitest_1.it)('every action is allowed from at least one status', () => {
        for (const a of types_1.RESERVATION_ACTIONS)
            (0, vitest_1.expect)(types_1.ACTION_FROM[a].length).toBeGreaterThan(0);
    });
    (0, vitest_1.it)('check-in only from CONFIRMED, check-out only from CHECKED_IN', () => {
        (0, vitest_1.expect)([...types_1.ACTION_FROM.check_in]).toEqual(['CONFIRMED']);
        (0, vitest_1.expect)([...types_1.ACTION_FROM.check_out]).toEqual(['CHECKED_IN']);
    });
    (0, vitest_1.it)('terminal statuses allow no action', () => {
        for (const terminal of ['CHECKED_OUT', 'CANCELLED', 'NO_SHOW']) {
            for (const a of types_1.RESERVATION_ACTIONS)
                (0, vitest_1.expect)(types_1.ACTION_FROM[a], `${a} from ${terminal}`).not.toContain(terminal);
        }
    });
    (0, vitest_1.it)('inquiries do not hold a room; new reservations can only start as inquiry, pending or confirmed', () => {
        (0, vitest_1.expect)(types_1.HOLDING_STATUSES).not.toContain('INQUIRY');
        (0, vitest_1.expect)([...types_1.CREATABLE_STATUSES]).toEqual(['INQUIRY', 'PENDING', 'CONFIRMED']);
    });
    (0, vitest_1.it)('a checked-in stay cannot be edited or cancelled', () => {
        (0, vitest_1.expect)(types_1.EDITABLE_STATUSES).not.toContain('CHECKED_IN');
        (0, vitest_1.expect)(types_1.ACTION_FROM.cancel).not.toContain('CHECKED_IN');
        (0, vitest_1.expect)(types_1.ACTION_RESULT.check_in).toBe('CHECKED_IN');
    });
});
(0, vitest_1.describe)('stay dates and pricing (money is whole centavos)', () => {
    (0, vitest_1.it)('counts nights and handles month and year ends', () => {
        (0, vitest_1.expect)((0, types_1.nightsBetween)('2026-10-02', '2026-10-05')).toBe(3);
        (0, vitest_1.expect)((0, types_1.addDays)('2026-12-31', 1)).toBe('2027-01-01');
    });
    (0, vitest_1.it)('rejects impossible dates', () => {
        (0, vitest_1.expect)((0, types_1.isDateString)('2026-02-30')).toBe(false);
        (0, vitest_1.expect)((0, types_1.isDateString)('2026-10-04')).toBe(true);
    });
    (0, vitest_1.it)('Friday and Saturday nights use the weekend rate', () => {
        const q = (0, types_1.quoteStay)('2026-10-01', '2026-10-05', { nightlyRateMinor: 350000, weekendRateMinor: 400000 }); // Thu Fri Sat Sun
        (0, vitest_1.expect)(q.nights).toBe(4);
        (0, vitest_1.expect)(q.totalMinor).toBe(350000 + 400000 + 400000 + 350000);
    });
    (0, vitest_1.it)('without a weekend rate every night costs the nightly rate', () => {
        (0, vitest_1.expect)((0, types_1.quoteStay)('2026-10-01', '2026-10-04', { nightlyRateMinor: 100, weekendRateMinor: null }).totalMinor).toBe(300);
    });
    (0, vitest_1.it)('"today" follows the property timezone', () => {
        const instant = new Date('2026-10-04T20:00:00Z');
        (0, vitest_1.expect)((0, types_1.todayIn)('UTC', instant)).toBe('2026-10-04');
        (0, vitest_1.expect)((0, types_1.todayIn)('Asia/Manila', instant)).toBe('2026-10-05');
    });
});
//# sourceMappingURL=reservation-rules.spec.js.map