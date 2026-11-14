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
exports.PosController = void 0;
const common_1 = require("@nestjs/common");
const validation_1 = require("@pms/validation");
const zod_validation_pipe_1 = require("../../common/pipes/zod-validation.pipe");
const access_decorators_1 = require("../rbac/decorators/access.decorators");
const pos_service_1 = require("./pos.service");
let PosController = class PosController {
    pos;
    constructor(pos) {
        this.pos = pos;
    }
    menu(propertyId, access) {
        return this.pos.menu(propertyId, access);
    }
    createOutlet(propertyId, dto, access) {
        return this.pos.createOutlet(propertyId, dto, access);
    }
    updateOutlet(id, dto, access) {
        return this.pos.updateOutlet(id, dto, access);
    }
    async archiveOutlet(id, access) {
        await this.pos.archiveOutlet(id, access);
        return null;
    }
    createItem(dto, access) {
        return this.pos.createItem(dto, access);
    }
    updateItem(id, dto, access) {
        return this.pos.updateItem(id, dto, access);
    }
    async archiveItem(id, access) {
        await this.pos.archiveItem(id, access);
        return null;
    }
    create(propertyId, dto, key, access) {
        return this.pos.create(propertyId, dto, key?.slice(0, 100), access);
    }
    list(propertyId, query, access) {
        return this.pos.list(propertyId, query, access);
    }
    summary(propertyId, query, access) {
        return this.pos.summary(propertyId, query, access);
    }
    void(id, dto, access) {
        return this.pos.void(id, dto, access);
    }
};
exports.PosController = PosController;
__decorate([
    (0, access_decorators_1.RequirePermission)('pos.read'),
    (0, common_1.Get)('properties/:propertyId/pos/menu'),
    __param(0, (0, common_1.Param)('propertyId', common_1.ParseUUIDPipe)),
    __param(1, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Function]),
    __metadata("design:returntype", void 0)
], PosController.prototype, "menu", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('pos.manage'),
    (0, common_1.Post)('properties/:propertyId/pos/outlets'),
    __param(0, (0, common_1.Param)('propertyId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.outletSchema))),
    __param(2, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Function]),
    __metadata("design:returntype", void 0)
], PosController.prototype, "createOutlet", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('pos.manage'),
    (0, common_1.Patch)('pos/outlets/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.updateOutletSchema))),
    __param(2, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Function]),
    __metadata("design:returntype", void 0)
], PosController.prototype, "updateOutlet", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('pos.manage'),
    (0, common_1.HttpCode)(200),
    (0, common_1.Delete)('pos/outlets/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Function]),
    __metadata("design:returntype", Promise)
], PosController.prototype, "archiveOutlet", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('pos.manage'),
    (0, common_1.Post)('pos/items'),
    __param(0, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.posItemSchema))),
    __param(1, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Function]),
    __metadata("design:returntype", void 0)
], PosController.prototype, "createItem", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('pos.manage'),
    (0, common_1.Patch)('pos/items/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.updatePosItemSchema))),
    __param(2, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Function]),
    __metadata("design:returntype", void 0)
], PosController.prototype, "updateItem", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('pos.manage'),
    (0, common_1.HttpCode)(200),
    (0, common_1.Delete)('pos/items/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Function]),
    __metadata("design:returntype", Promise)
], PosController.prototype, "archiveItem", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('pos.sell'),
    (0, common_1.Post)('properties/:propertyId/pos/orders'),
    __param(0, (0, common_1.Param)('propertyId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.createPosOrderSchema))),
    __param(2, (0, common_1.Headers)('idempotency-key')),
    __param(3, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, Function]),
    __metadata("design:returntype", void 0)
], PosController.prototype, "create", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('pos.read'),
    (0, common_1.Get)('properties/:propertyId/pos/orders'),
    __param(0, (0, common_1.Param)('propertyId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.posOrdersQuerySchema))),
    __param(2, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Function]),
    __metadata("design:returntype", void 0)
], PosController.prototype, "list", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('pos.read'),
    (0, common_1.Get)('properties/:propertyId/pos/summary'),
    __param(0, (0, common_1.Param)('propertyId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.posOrdersQuerySchema))),
    __param(2, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Function]),
    __metadata("design:returntype", void 0)
], PosController.prototype, "summary", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('pos.void'),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('pos/orders/:id/void'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.voidPosOrderSchema))),
    __param(2, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Function]),
    __metadata("design:returntype", void 0)
], PosController.prototype, "void", null);
exports.PosController = PosController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [pos_service_1.PosService])
], PosController);
//# sourceMappingURL=pos.controller.js.map