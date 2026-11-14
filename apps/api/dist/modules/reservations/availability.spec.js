"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const availability_1 = require("./availability");
const stay = (arrivalDate, departureDate) => ({ arrivalDate, departureDate });
(0, vitest_1.describe)('nightlyAvailability', () => {
    (0, vitest_1.it)('everything is free when there are no reservations', () => {
        const nights = (0, availability_1.nightlyAvailability)({ totalRooms: 3, reservations: [], from: '2026-10-01', days: 3 });
        (0, vitest_1.expect)(nights.map((n) => n.available)).toEqual([3, 3, 3]);
    });
    (0, vitest_1.it)('the check-out day is free again (the stay occupies nights, not the departure day)', () => {
        const nights = (0, availability_1.nightlyAvailability)({ totalRooms: 1, reservations: [stay('2026-10-01', '2026-10-03')], from: '2026-10-01', days: 3 });
        (0, vitest_1.expect)(nights).toEqual([
            { date: '2026-10-01', available: 0 },
            { date: '2026-10-02', available: 0 },
            { date: '2026-10-03', available: 1 },
        ]);
    });
    (0, vitest_1.it)('a same-day turnover is allowed: one guest leaves the morning another arrives', () => {
        const nights = (0, availability_1.nightlyAvailability)({ totalRooms: 1, reservations: [stay('2026-10-01', '2026-10-03')], from: '2026-10-03', days: 2 });
        (0, vitest_1.expect)((0, availability_1.canBook)(nights)).toBe(true);
    });
    (0, vitest_1.it)('never goes below zero when over-booked data exists', () => {
        const nights = (0, availability_1.nightlyAvailability)({ totalRooms: 1, reservations: [stay('2026-10-01', '2026-10-02'), stay('2026-10-01', '2026-10-02')], from: '2026-10-01', days: 1 });
        (0, vitest_1.expect)(nights[0]?.available).toBe(0);
    });
    (0, vitest_1.it)('counts per night, not per overlapping reservation (no false "sold out")', () => {
        // 2 rooms. One stay on nights 1-2, another on nights 3-4. A stay over nights 1-4 still fits: each night has a free room.
        const nights = (0, availability_1.nightlyAvailability)({
            totalRooms: 2,
            reservations: [stay('2026-10-01', '2026-10-03'), stay('2026-10-03', '2026-10-05')],
            from: '2026-10-01',
            days: 4,
        });
        (0, vitest_1.expect)(nights.map((n) => n.available)).toEqual([1, 1, 1, 1]);
        (0, vitest_1.expect)((0, availability_1.canBook)(nights)).toBe(true);
    });
    (0, vitest_1.it)('refuses a stay if even ONE night is full', () => {
        const nights = (0, availability_1.nightlyAvailability)({
            totalRooms: 1,
            reservations: [stay('2026-10-03', '2026-10-04')],
            from: '2026-10-01',
            days: 4,
        });
        (0, vitest_1.expect)(nights.map((n) => n.available)).toEqual([1, 1, 0, 1]);
        (0, vitest_1.expect)((0, availability_1.canBook)(nights)).toBe(false);
    });
});
//# sourceMappingURL=availability.spec.js.map