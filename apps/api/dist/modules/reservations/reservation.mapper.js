"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toReservationView = exports.reservationDetailInclude = exports.reservationInclude = void 0;
const types_1 = require("@pms/types");
exports.reservationInclude = {
    property: { select: { name: true } },
    guest: { select: { firstName: true, lastName: true } },
    roomType: { select: { name: true } },
    room: { select: { number: true } },
    ratePlan: { select: { name: true } },
};
/** Same as reservationInclude, plus the property's timezone (needed for "today" rules). */
exports.reservationDetailInclude = {
    ...exports.reservationInclude,
    property: { select: { name: true, timezone: true } },
};
const toReservationView = (r) => ({
    id: r.id,
    code: r.code,
    propertyId: r.propertyId,
    propertyName: r.property.name,
    status: r.status,
    source: r.source,
    guestId: r.guestId,
    guestName: `${r.guest.firstName} ${r.guest.lastName}`,
    roomTypeId: r.roomTypeId,
    roomTypeName: r.roomType.name,
    roomId: r.roomId,
    roomNumber: r.room?.number ?? null,
    ratePlanId: r.ratePlanId,
    ratePlanName: r.ratePlan?.name ?? null,
    arrivalDate: (0, types_1.toDateString)(r.arrivalDate),
    departureDate: (0, types_1.toDateString)(r.departureDate),
    nights: r.nights,
    adults: r.adults,
    children: r.children,
    totalMinor: r.totalMinor,
    currency: r.currency,
    specialRequests: r.specialRequests,
    notes: r.notes,
    cancelReason: r.cancelReason,
    checkedInAt: r.checkedInAt?.toISOString() ?? null,
    checkedOutAt: r.checkedOutAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
});
exports.toReservationView = toReservationView;
//# sourceMappingURL=reservation.mapper.js.map