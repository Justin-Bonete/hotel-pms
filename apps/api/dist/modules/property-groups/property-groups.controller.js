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
exports.PropertyGroupsController = void 0;
const common_1 = require("@nestjs/common");
const validation_1 = require("@pms/validation");
const zod_validation_pipe_1 = require("../../common/pipes/zod-validation.pipe");
const access_decorators_1 = require("../rbac/decorators/access.decorators");
const property_groups_service_1 = require("./property-groups.service");
let PropertyGroupsController = class PropertyGroupsController {
    groups;
    constructor(groups) {
        this.groups = groups;
    }
    list() {
        return this.groups.list();
    }
    create(dto, access) {
        return this.groups.create(dto, access);
    }
    rename(id, dto, access) {
        return this.groups.rename(id, dto, access);
    }
    async remove(id, access) {
        await this.groups.remove(id, access);
        return null;
    }
};
exports.PropertyGroupsController = PropertyGroupsController;
__decorate([
    (0, access_decorators_1.RequirePermission)('property_group.read'),
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PropertyGroupsController.prototype, "list", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('property_group.manage'),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.propertyGroupSchema))),
    __param(1, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Function]),
    __metadata("design:returntype", void 0)
], PropertyGroupsController.prototype, "create", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('property_group.manage'),
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.propertyGroupSchema))),
    __param(2, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Function]),
    __metadata("design:returntype", void 0)
], PropertyGroupsController.prototype, "rename", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('property_group.manage'),
    (0, common_1.HttpCode)(200),
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Function]),
    __metadata("design:returntype", Promise)
], PropertyGroupsController.prototype, "remove", null);
exports.PropertyGroupsController = PropertyGroupsController = __decorate([
    (0, common_1.Controller)('property-groups'),
    __metadata("design:paramtypes", [property_groups_service_1.PropertyGroupsService])
], PropertyGroupsController);
//# sourceMappingURL=property-groups.controller.js.map