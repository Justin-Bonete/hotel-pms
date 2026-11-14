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
exports.HousekeepingController = void 0;
const common_1 = require("@nestjs/common");
const validation_1 = require("@pms/validation");
const zod_validation_pipe_1 = require("../../common/pipes/zod-validation.pipe");
const access_decorators_1 = require("../rbac/decorators/access.decorators");
const housekeeping_service_1 = require("./housekeeping.service");
let HousekeepingController = class HousekeepingController {
    housekeeping;
    constructor(housekeeping) {
        this.housekeeping = housekeeping;
    }
    list(propertyId, query, access) {
        return this.housekeeping.list(propertyId, query, access);
    }
    staff(propertyId, access) {
        return this.housekeeping.staff(propertyId, access);
    }
    create(propertyId, dto, access) {
        return this.housekeeping.create(propertyId, dto, access);
    }
    generate(propertyId, access) {
        return this.housekeeping.generateStayovers(propertyId, access);
    }
    /** Housekeepers start and finish their own tasks; supervisors do the rest. The service checks which. */
    action(id, dto, access) {
        return this.housekeeping.action(id, dto, access);
    }
};
exports.HousekeepingController = HousekeepingController;
__decorate([
    (0, access_decorators_1.RequirePermission)('housekeeping.read'),
    (0, common_1.Get)('properties/:propertyId/housekeeping/tasks'),
    __param(0, (0, common_1.Param)('propertyId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.tasksQuerySchema))),
    __param(2, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Function]),
    __metadata("design:returntype", void 0)
], HousekeepingController.prototype, "list", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('housekeeping.manage'),
    (0, common_1.Get)('properties/:propertyId/housekeeping/staff'),
    __param(0, (0, common_1.Param)('propertyId', common_1.ParseUUIDPipe)),
    __param(1, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Function]),
    __metadata("design:returntype", void 0)
], HousekeepingController.prototype, "staff", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('housekeeping.manage'),
    (0, common_1.Post)('properties/:propertyId/housekeeping/tasks'),
    __param(0, (0, common_1.Param)('propertyId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.createTaskSchema))),
    __param(2, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Function]),
    __metadata("design:returntype", void 0)
], HousekeepingController.prototype, "create", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('housekeeping.manage'),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('properties/:propertyId/housekeeping/generate-stayovers'),
    __param(0, (0, common_1.Param)('propertyId', common_1.ParseUUIDPipe)),
    __param(1, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Function]),
    __metadata("design:returntype", void 0)
], HousekeepingController.prototype, "generate", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('housekeeping.read'),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('housekeeping/tasks/:id/action'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.taskActionSchema))),
    __param(2, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Function]),
    __metadata("design:returntype", void 0)
], HousekeepingController.prototype, "action", null);
exports.HousekeepingController = HousekeepingController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [housekeeping_service_1.HousekeepingService])
], HousekeepingController);
//# sourceMappingURL=housekeeping.controller.js.map