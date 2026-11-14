"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canBook = void 0;
exports.nightlyAvailability = nightlyAvailability;
const types_1 = require("@pms/types");
/** For each night in [from, from + days): how many rooms of a type are still free. Pure, no database. */
function nightlyAvailability(args) {
    const result = [];
    for (let i = 0; i < args.days; i++) {
        const date = (0, types_1.addDays)(args.from, i);
        const taken = args.reservations.filter((r) => r.arrivalDate <= date && date < r.departureDate).length;
        result.push({ date, available: Math.max(args.totalRooms - taken, 0) });
    }
    return result;
}
/** A stay can be booked only if EVERY one of its nights has a free room. */
const canBook = (nights) => nights.every((n) => n.available >= 1);
exports.canBook = canBook;
//# sourceMappingURL=availability.js.map