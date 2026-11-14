"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FrontDeskService = void 0;
const common_1 = require("@nestjs/common");
const types_1 = require("@pms/types");
const assert_access_1 = require("../../common/access/assert-access");
const errors_1 = require("../../common/http/errors");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const reservation_mapper_1 = require("../reservations/reservation.mapper");
const include = {
    ...reservation_mapper_1.reservationInclude,
    guest: { select: { firstName: true, lastName: true, isVip: true } },
};
/** "Who is arriving, departing and staying?" in one request, for the property's own "today". */
let FrontDeskService = class FrontDeskService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async get(propertyId, access) {
        (0, assert_access_1.assertCan)(access, 'reservation.read', propertyId);
        return this.prisma.forTenant(async (tx) => {
            const property = await tx.property.findFirst({ where: { id: propertyId, deletedAt: null }, select: { timezone: true } });
            if (!property)
                throw (0, errors_1.notFound)('Property');
            const today = (0, types_1.todayIn)(property.timezone);
            const todayDate = (0, types_1.parseDate)(today);
            const [arrivalRows, inHouseRows, expectedRows, rooms, dirty, outOfOrder] = await Promise.all([
                tx.reservation.findMany({ where: { propertyId, status: { in: ['PENDING', 'CONFIRMED'] }, arrivalDate: todayDate }, include, orderBy: { createdAt: 'asc' } }),
                tx.reservation.findMany({ where: { propertyId, status: 'CHECKED_IN' }, include, orderBy: [{ departureDate: 'asc' }, { createdAt: 'asc' }] }),
                tx.reservation.findMany({ where: { propertyId, status: { in: ['PENDING', 'CONFIRMED'] }, arrivalDate: { gt: todayDate, lte: (0, types_1.parseDate)((0, types_1.addDays)(today, 3)) } }, include, orderBy: { arrivalDate: 'asc' }, take: 100 }),
                tx.room.count({ where: { propertyId, deletedAt: null } }),
                tx.room.count({ where: { propertyId, deletedAt: null, status: 'DIRTY' } }),
                tx.room.count({ where: { propertyId, deletedAt: null, status: { in: ['OUT_OF_ORDER', 'OUT_OF_SERVICE', 'MAINTENANCE'] } } }),
            ]);
            const balances = await this.balances(tx, inHouseRows.map((r) => r.id));
            const item = (r, withBalance) => ({
                ...(0, reservation_mapper_1.toReservationView)(r),
                guestIsVip: r.guest.isVip,
                balanceDueMinor: withBalance ? (balances.get(r.id) ?? null) : null,
            });
            const arrivals = arrivalRows.map((r) => item(r, false));
            const inHouse = inHouseRows.map((r) => item(r, true));
            return {
                today,
                propertyId,
                counts: { rooms, inHouse: inHouse.length, arrivals: arrivals.length, departures: inHouse.filter((i) => i.departureDate === today).length, dirty, outOfOrder },
                arrivals,
                departures: inHouse.filter((i) => i.departureDate === today),
                inHouse,
                expected: expectedRows.map((r) => item(r, false)),
                overstays: inHouse.filter((i) => i.departureDate < today),
                vips: [...arrivals, ...inHouse].filter((i) => i.guestIsVip),
                paymentsDue: inHouse.filter((i) => (i.balanceDueMinor ?? 0) > 0).sort((a, b) => (b.balanceDueMinor ?? 0) - (a.balanceDueMinor ?? 0)),
            };
        });
    }
    /** Balance per reservation (charges - payments + refunds), computed with three grouped queries, not one per guest. */
    async balances(tx, reservationIds) {
        const result = new Map();
        if (reservationIds.length === 0)
            return result;
        const folios = await tx.folio.findMany({ where: { reservationId: { in: reservationIds } }, select: { id: true, reservationId: true } });
        if (folios.length === 0)
            return result;
        const folioIds = folios.map((f) => f.id);
        const [items, payments, refunds] = await Promise.all([
            tx.folioItem.groupBy({ by: ['folioId'], where: { folioId: { in: folioIds } }, _sum: { amountMinor: true } }),
            tx.payment.groupBy({ by: ['folioId'], where: { folioId: { in: folioIds } }, _sum: { amountMinor: true } }),
            tx.refund.findMany({ where: { payment: { folioId: { in: folioIds } } }, select: { amountMinor: true, payment: { select: { folioId: true } } } }),
        ]);
        const charged = new Map(items.map((i) => [i.folioId, i._sum.amountMinor ?? 0]));
        const paid = new Map(payments.map((p) => [p.folioId, p._sum.amountMinor ?? 0]));
        const refunded = new Map();
        for (const r of refunds)
            refunded.set(r.payment.folioId, (refunded.get(r.payment.folioId) ?? 0) + r.amountMinor);
        for (const f of folios)
            result.set(f.reservationId, (charged.get(f.id) ?? 0) - (paid.get(f.id) ?? 0) + (refunded.get(f.id) ?? 0));
        return result;
    }
};
exports.FrontDeskService = FrontDeskService;
exports.FrontDeskService = FrontDeskService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], FrontDeskService);
//# sourceMappingURL=frontdesk.service.js.map