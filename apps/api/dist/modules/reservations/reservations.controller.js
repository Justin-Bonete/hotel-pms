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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReservationsController = void 0;
const common_1 = require("@nestjs/common");
const validation_1 = require("@pms/validation");
const zod_validation_pipe_1 = require("../../common/pipes/zod-validation.pipe");
const access_decorators_1 = require("../rbac/decorators/access.decorators");
const reservations_service_1 = require("./reservations.service");
let ReservationsController = class ReservationsController {
    reservations;
    constructor(reservations) {
        this.reservations = reservations;
    }
    list(query, access) {
        return this.reservations.list(query, access);
    }
    get(id, access) {
        return this.reservations.get(id, access);
    }
    create(propertyId, dto, access) {
        return this.reservations.create(propertyId, dto, access);
    }
    update(id, dto, access) {
        return this.reservations.update(id, dto, access);
    }
    /** Needs reservation.manage OR reservation.check_in depending on the action; the service checks the exact one. */
    transition(id, dto, access) {
        return this.reservations.transition(id, dto, access);
    }
    extend(id, dto, access) {
        return this.reservations.extend(id, dto, access);
    }
    calendar(propertyId, query, access) {
        return this.reservations.calendar(propertyId, query, access);
    }
    availability(propertyId, query, access) {
        return this.reservations.availability(propertyId, query, access);
    }
};
exports.ReservationsController = ReservationsController;
__decorate([
    (0, access_decorators_1.RequirePermission)('reservation.read'),
    (0, common_1.Get)('reservations'),
    __param(0, (0, common_1.Query)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.reservationsQuerySchema))),
    __param(1, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Function]),
    __metadata("design:returntype", void 0)
], ReservationsController.prototype, "list", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('reservation.read'),
    (0, common_1.Get)('reservations/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Function]),
    __metadata("design:returntype", void 0)
], ReservationsController.prototype, "get", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('reservation.manage'),
    (0, common_1.Post)('properties/:propertyId/reservations'),
    __param(0, (0, common_1.Param)('propertyId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.createReservationSchema))),
    __param(2, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Function]),
    __metadata("design:returntype", void 0)
], ReservationsController.prototype, "create", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('reservation.manage'),
    (0, common_1.Patch)('reservations/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.updateReservationSchema))),
    __param(2, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Function]),
    __metadata("design:returntype", void 0)
], ReservationsController.prototype, "update", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('reservation.read'),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('reservations/:id/transition'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.transitionSchema))),
    __param(2, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Function]),
    __metadata("design:returntype", void 0)
], ReservationsController.prototype, "transition", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('reservation.manage'),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('reservations/:id/extend'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.extendStaySchema))),
    __param(2, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Function]),
    __metadata("design:returntype", void 0)
], ReservationsController.prototype, "extend", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('reservation.read'),
    (0, common_1.Get)('properties/:propertyId/calendar'),
    __param(0, (0, common_1.Param)('propertyId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.rangeQuerySchema))),
    __param(2, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Function]),
    __metadata("design:returntype", void 0)
], ReservationsController.prototype, "calendar", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('reservation.read'),
    (0, common_1.Get)('properties/:propertyId/availability'),
    __param(0, (0, common_1.Param)('propertyId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.rangeQuerySchema))),
    __param(2, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Function]),
    __metadata("design:returntype", void 0)
], ReservationsController.prototype, "availability", null);
exports.ReservationsController = ReservationsController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [reservations_service_1.ReservationsService])
], ReservationsController);
//# sourceMappingURL=reservations.controller.js.map