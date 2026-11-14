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
exports.RoomsController = void 0;
const common_1 = require("@nestjs/common");
const validation_1 = require("@pms/validation");
const zod_validation_pipe_1 = require("../../common/pipes/zod-validation.pipe");
const access_decorators_1 = require("../rbac/decorators/access.decorators");
const rooms_service_1 = require("./rooms.service");
let RoomsController = class RoomsController {
    rooms;
    constructor(rooms) {
        this.rooms = rooms;
    }
    list(propertyId, query, access) {
        return this.rooms.list(propertyId, query, access);
    }
    create(propertyId, dto, access) {
        return this.rooms.create(propertyId, dto, access);
    }
    update(id, dto, access) {
        return this.rooms.update(id, dto, access);
    }
    changeStatus(id, dto, access) {
        return this.rooms.changeStatus(id, dto, access);
    }
    async archive(id, access) {
        await this.rooms.archive(id, access);
        return null;
    }
};
exports.RoomsController = RoomsController;
__decorate([
    (0, access_decorators_1.RequirePermission)('room.read'),
    (0, common_1.Get)('properties/:propertyId/rooms'),
    __param(0, (0, common_1.Param)('propertyId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.roomsQuerySchema))),
    __param(2, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Function]),
    __metadata("design:returntype", void 0)
], RoomsController.prototype, "list", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('room.manage'),
    (0, common_1.Post)('properties/:propertyId/rooms'),
    __param(0, (0, common_1.Param)('propertyId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.roomSchema))),
    __param(2, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Function]),
    __metadata("design:returntype", void 0)
], RoomsController.prototype, "create", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('room.manage'),
    (0, common_1.Patch)('rooms/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.updateRoomSchema))),
    __param(2, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Function]),
    __metadata("design:returntype", void 0)
], RoomsController.prototype, "update", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('room.update_status'),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('rooms/:id/status'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.roomStatusSchema))),
    __param(2, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Function]),
    __metadata("design:returntype", void 0)
], RoomsController.prototype, "changeStatus", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('room.manage'),
    (0, common_1.HttpCode)(200),
    (0, common_1.Delete)('rooms/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Function]),
    __metadata("design:returntype", Promise)
], RoomsController.prototype, "archive", null);
exports.RoomsController = RoomsController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [rooms_service_1.RoomsService])
], RoomsController);
//# sourceMappingURL=rooms.controller.js.map