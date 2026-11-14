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
exports.HousekeepingAutomation = void 0;
const common_1 = require("@nestjs/common");
const types_1 = require("@pms/types");
const realtime_service_1 = require("../realtime/realtime.service");
/** Creates tasks as a side effect of other workflows (check-out, repairs finishing). Runs inside the caller's transaction. */
let HousekeepingAutomation = class HousekeepingAutomation {
    realtime;
    constructor(realtime) {
        this.realtime = realtime;
    }
    /**
     * A room needs turnover cleaning. Safe to call twice: a partial unique index allows only one open
     * task per room and kind, and skipDuplicates makes the second call a no-op instead of an error.
     * Rooms with a guest arriving today get HIGH priority.
     */
    async createCheckoutTask(tx, input) {
        const arrivingToday = await tx.reservation.count({
            where: { roomId: input.roomId, status: { in: ['PENDING', 'CONFIRMED'] }, arrivalDate: (0, types_1.parseDate)(input.today) },
        });
        const created = await tx.housekeepingTask.createMany({
            data: [
                {
                    organizationId: input.organizationId,
                    propertyId: input.propertyId,
                    roomId: input.roomId,
                    type: 'CHECKOUT_CLEAN',
                    priority: arrivingToday > 0 ? 'HIGH' : 'NORMAL',
                    notes: arrivingToday > 0 ? `${input.notes} A guest arrives today.` : input.notes,
                    createdById: input.createdById,
                },
            ],
            skipDuplicates: true,
        });
        if (created.count > 0)
            this.realtime.emit(input.organizationId, 'housekeeping.changed', input.propertyId, [input.roomId]);
    }
};
exports.HousekeepingAutomation = HousekeepingAutomation;
exports.HousekeepingAutomation = HousekeepingAutomation = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [realtime_service_1.RealtimeService])
], HousekeepingAutomation);
//# sourceMappingURL=housekeeping-automation.service.js.map