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
exports.BuildingsController = void 0;
const common_1 = require("@nestjs/common");
const validation_1 = require("@pms/validation");
const zod_validation_pipe_1 = require("../../common/pipes/zod-validation.pipe");
const access_decorators_1 = require("../rbac/decorators/access.decorators");
const buildings_service_1 = require("./buildings.service");
let BuildingsController = class BuildingsController {
    buildings;
    constructor(buildings) {
        this.buildings = buildings;
    }
    structure(propertyId, access) {
        return this.buildings.structure(propertyId, access);
    }
    addBuilding(propertyId, dto, access) {
        return this.buildings.addBuilding(propertyId, dto, access);
    }
    addFloor(propertyId, buildingId, dto, access) {
        return this.buildings.addFloor(propertyId, buildingId, dto, access);
    }
};
exports.BuildingsController = BuildingsController;
__decorate([
    (0, access_decorators_1.RequirePermission)('property.read'),
    (0, common_1.Get)('structure'),
    __param(0, (0, common_1.Param)('propertyId', common_1.ParseUUIDPipe)),
    __param(1, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Function]),
    __metadata("design:returntype", void 0)
], BuildingsController.prototype, "structure", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('property.update'),
    (0, common_1.Post)('buildings'),
    __param(0, (0, common_1.Param)('propertyId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.buildingSchema))),
    __param(2, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Function]),
    __metadata("design:returntype", void 0)
], BuildingsController.prototype, "addBuilding", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('property.update'),
    (0, common_1.Post)('buildings/:buildingId/floors'),
    __param(0, (0, common_1.Param)('propertyId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Param)('buildingId', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.floorSchema))),
    __param(3, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, Function]),
    __metadata("design:returntype", void 0)
], BuildingsController.prototype, "addFloor", null);
exports.BuildingsController = BuildingsController = __decorate([
    (0, common_1.Controller)('properties/:propertyId'),
    __metadata("design:paramtypes", [buildings_service_1.BuildingsService])
], BuildingsController);
//# sourceMappingURL=buildings.controller.js.map