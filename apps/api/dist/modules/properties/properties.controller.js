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
exports.PropertiesController = void 0;
const common_1 = require("@nestjs/common");
const validation_1 = require("@pms/validation");
const zod_validation_pipe_1 = require("../../common/pipes/zod-validation.pipe");
const access_decorators_1 = require("../rbac/decorators/access.decorators");
const properties_service_1 = require("./properties.service");
let PropertiesController = class PropertiesController {
    properties;
    constructor(properties) {
        this.properties = properties;
    }
    list(query, access) {
        // scopeOf (not scopeInActive): the property switcher needs the FULL list you may pick from.
        return this.properties.list(query, access.scopeOf('property.read'));
    }
    get(id, access) {
        return this.properties.get(id, access);
    }
    create(dto, access) {
        return this.properties.create(dto, access);
    }
    update(id, dto, access) {
        return this.properties.update(id, dto, access);
    }
    async archive(id, access) {
        await this.properties.archive(id, access);
        return null;
    }
};
exports.PropertiesController = PropertiesController;
__decorate([
    (0, access_decorators_1.RequirePermission)('property.read'),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.paginationSchema))),
    __param(1, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Function]),
    __metadata("design:returntype", void 0)
], PropertiesController.prototype, "list", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('property.read'),
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Function]),
    __metadata("design:returntype", void 0)
], PropertiesController.prototype, "get", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('property.create'),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.createPropertySchema))),
    __param(1, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Function]),
    __metadata("design:returntype", void 0)
], PropertiesController.prototype, "create", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('property.update'),
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.updatePropertySchema))),
    __param(2, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Function]),
    __metadata("design:returntype", void 0)
], PropertiesController.prototype, "update", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('property.delete'),
    (0, common_1.HttpCode)(200),
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Function]),
    __metadata("design:returntype", Promise)
], PropertiesController.prototype, "archive", null);
exports.PropertiesController = PropertiesController = __decorate([
    (0, common_1.Controller)('properties'),
    __metadata("design:paramtypes", [properties_service_1.PropertiesService])
], PropertiesController);
//# sourceMappingURL=properties.controller.js.map