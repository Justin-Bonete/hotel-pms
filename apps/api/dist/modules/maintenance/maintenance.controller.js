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
exports.MaintenanceController = void 0;
const common_1 = require("@nestjs/common");
const validation_1 = require("@pms/validation");
const zod_validation_pipe_1 = require("../../common/pipes/zod-validation.pipe");
const access_decorators_1 = require("../rbac/decorators/access.decorators");
const maintenance_service_1 = require("./maintenance.service");
let MaintenanceController = class MaintenanceController {
    maintenance;
    constructor(maintenance) {
        this.maintenance = maintenance;
    }
    list(propertyId, query, access) {
        return this.maintenance.list(propertyId, query, access);
    }
    staff(propertyId, access) {
        return this.maintenance.staff(propertyId, access);
    }
    create(propertyId, dto, access) {
        return this.maintenance.create(propertyId, dto, access);
    }
    action(id, dto, access) {
        return this.maintenance.action(id, dto, access);
    }
    logWork(id, dto, access) {
        return this.maintenance.logWork(id, dto, access);
    }
};
exports.MaintenanceController = MaintenanceController;
__decorate([
    (0, access_decorators_1.RequirePermission)('maintenance.read'),
    (0, common_1.Get)('properties/:propertyId/maintenance/tickets'),
    __param(0, (0, common_1.Param)('propertyId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.ticketsQuerySchema))),
    __param(2, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Function]),
    __metadata("design:returntype", void 0)
], MaintenanceController.prototype, "list", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('maintenance.manage'),
    (0, common_1.Get)('properties/:propertyId/maintenance/staff'),
    __param(0, (0, common_1.Param)('propertyId', common_1.ParseUUIDPipe)),
    __param(1, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Function]),
    __metadata("design:returntype", void 0)
], MaintenanceController.prototype, "staff", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('maintenance.report'),
    (0, common_1.Post)('properties/:propertyId/maintenance/tickets'),
    __param(0, (0, common_1.Param)('propertyId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.createTicketSchema))),
    __param(2, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Function]),
    __metadata("design:returntype", void 0)
], MaintenanceController.prototype, "create", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('maintenance.read'),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('maintenance/tickets/:id/action'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.ticketActionSchema))),
    __param(2, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Function]),
    __metadata("design:returntype", void 0)
], MaintenanceController.prototype, "action", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('maintenance.read'),
    (0, common_1.Patch)('maintenance/tickets/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.ticketWorkSchema))),
    __param(2, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Function]),
    __metadata("design:returntype", void 0)
], MaintenanceController.prototype, "logWork", null);
exports.MaintenanceController = MaintenanceController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [maintenance_service_1.MaintenanceService])
], MaintenanceController);
//# sourceMappingURL=maintenance.controller.js.map