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
exports.DashboardService = void 0;
const common_1 = require("@nestjs/common");
const types_1 = require("@pms/types");
const assert_access_1 = require("../../common/access/assert-access");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const UNSELLABLE = ['OUT_OF_ORDER', 'OUT_OF_SERVICE', 'MAINTENANCE'];
/** Live numbers for "today", for the properties the caller may see. Revenue, ADR and RevPAR belong to the analytics phase. */
let DashboardService = class DashboardService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async today(propertyId, access) {
        if (propertyId)
            (0, assert_access_1.assertCan)(access, 'reservation.read', propertyId);
        const scope = access.scopeOf('reservation.read');
        return this.prisma.forTenant(async (tx) => {
            const where = {
                deletedAt: null,
                ...(propertyId ? { id: propertyId } : scope.all ? {} : { id: { in: [...scope.ids] } }),
            };
            const properties = await tx.property.findMany({ where, select: { id: true, name: true, timezone: true }, orderBy: { name: 'asc' } });
            const rows = await Promise.all(properties.map(async (p) => {
                const today = (0, types_1.todayIn)(p.timezone);
                const day = (0, types_1.parseDate)(today);
                const [arrivals, departures, inHouse, rooms, unsellable, dirtyRooms] = await Promise.all([
                    tx.reservation.count({ where: { propertyId: p.id, status: { in: ['PENDING', 'CONFIRMED'] }, arrivalDate: day } }),
                    tx.reservation.count({ where: { propertyId: p.id, status: 'CHECKED_IN', departureDate: day } }),
                    tx.reservation.count({ where: { propertyId: p.id, status: 'CHECKED_IN' } }),
                    tx.room.count({ where: { propertyId: p.id, deletedAt: null } }),
                    tx.room.count({ where: { propertyId: p.id, deletedAt: null, status: { in: [...UNSELLABLE] } } }),
                    tx.room.count({ where: { propertyId: p.id, deletedAt: null, status: 'DIRTY' } }),
                ]);
                const sellableRooms = Math.max(rooms - unsellable, 0);
                return { propertyId: p.id, propertyName: p.name, today, arrivals, departures, inHouse, rooms, sellableRooms, dirtyRooms, occupancyPct: (0, types_1.occupancyPct)(inHouse, sellableRooms) };
            }));
            const sum = (pick) => rows.reduce((s, r) => s + pick(r), 0);
            const sellable = sum((r) => r.sellableRooms);
            const inHouse = sum((r) => r.inHouse);
            return {
                properties: rows,
                totals: { arrivals: sum((r) => r.arrivals), departures: sum((r) => r.departures), inHouse, rooms: sum((r) => r.rooms), sellableRooms: sellable, dirtyRooms: sum((r) => r.dirtyRooms), occupancyPct: (0, types_1.occupancyPct)(inHouse, sellable) },
            };
        });
    }
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map