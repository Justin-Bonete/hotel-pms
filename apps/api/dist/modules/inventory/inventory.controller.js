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
exports.InventoryController = void 0;
const common_1 = require("@nestjs/common");
const validation_1 = require("@pms/validation");
const zod_validation_pipe_1 = require("../../common/pipes/zod-validation.pipe");
const access_decorators_1 = require("../rbac/decorators/access.decorators");
const inventory_service_1 = require("./inventory.service");
let InventoryController = class InventoryController {
    inventory;
    constructor(inventory) {
        this.inventory = inventory;
    }
    list(propertyId, access) {
        return this.inventory.list(propertyId, access);
    }
    movements(propertyId, itemId, access) {
        return this.inventory.movements(propertyId, itemId, access);
    }
    record(propertyId, dto, access) {
        return this.inventory.record(propertyId, dto, access);
    }
    transfer(dto, access) {
        return this.inventory.transfer(dto, access);
    }
    // The item catalog is shared by the organization; the caller must hold inventory.manage somewhere.
    createItem(dto, access) {
        return this.inventory.createItem(dto, access);
    }
    updateItem(id, dto, access) {
        return this.inventory.updateItem(id, dto, access);
    }
    async archiveItem(id, access) {
        await this.inventory.archiveItem(id, access);
        return null;
    }
};
exports.InventoryController = InventoryController;
__decorate([
    (0, access_decorators_1.RequirePermission)('inventory.read'),
    (0, common_1.Get)('properties/:propertyId/inventory'),
    __param(0, (0, common_1.Param)('propertyId', common_1.ParseUUIDPipe)),
    __param(1, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Function]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "list", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('inventory.read'),
    (0, common_1.Get)('properties/:propertyId/inventory/:itemId/movements'),
    __param(0, (0, common_1.Param)('propertyId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Param)('itemId', common_1.ParseUUIDPipe)),
    __param(2, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Function]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "movements", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('inventory.manage'),
    (0, common_1.Post)('properties/:propertyId/inventory/movements'),
    __param(0, (0, common_1.Param)('propertyId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.movementSchema))),
    __param(2, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Function]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "record", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('inventory.manage'),
    (0, common_1.Post)('inventory/transfers'),
    __param(0, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.transferSchema))),
    __param(1, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Function]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "transfer", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('inventory.manage'),
    (0, common_1.Post)('inventory/items'),
    __param(0, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.inventoryItemSchema))),
    __param(1, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Function]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "createItem", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('inventory.manage'),
    (0, common_1.Patch)('inventory/items/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.updateInventoryItemSchema))),
    __param(2, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Function]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "updateItem", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('inventory.manage'),
    (0, common_1.HttpCode)(200),
    (0, common_1.Delete)('inventory/items/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Function]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "archiveItem", null);
exports.InventoryController = InventoryController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [inventory_service_1.InventoryService])
], InventoryController);
//# sourceMappingURL=inventory.controller.js.map