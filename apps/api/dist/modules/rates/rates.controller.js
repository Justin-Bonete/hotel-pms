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
exports.RatesController = void 0;
const common_1 = require("@nestjs/common");
const validation_1 = require("@pms/validation");
const zod_validation_pipe_1 = require("../../common/pipes/zod-validation.pipe");
const access_decorators_1 = require("../rbac/decorators/access.decorators");
const rates_service_1 = require("./rates.service");
let RatesController = class RatesController {
    rates;
    constructor(rates) {
        this.rates = rates;
    }
    list(propertyId, access) {
        return this.rates.list(propertyId, access);
    }
    create(propertyId, dto, access) {
        return this.rates.create(propertyId, dto, access);
    }
    update(id, dto, access) {
        return this.rates.update(id, dto, access);
    }
    async archive(id, access) {
        await this.rates.archive(id, access);
        return null;
    }
};
exports.RatesController = RatesController;
__decorate([
    (0, access_decorators_1.RequirePermission)('rate.read'),
    (0, common_1.Get)('properties/:propertyId/rate-plans'),
    __param(0, (0, common_1.Param)('propertyId', common_1.ParseUUIDPipe)),
    __param(1, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Function]),
    __metadata("design:returntype", void 0)
], RatesController.prototype, "list", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('rate.manage'),
    (0, common_1.Post)('properties/:propertyId/rate-plans'),
    __param(0, (0, common_1.Param)('propertyId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.ratePlanSchema))),
    __param(2, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Function]),
    __metadata("design:returntype", void 0)
], RatesController.prototype, "create", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('rate.manage'),
    (0, common_1.Patch)('rate-plans/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.ratePlanSchema))),
    __param(2, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Function]),
    __metadata("design:returntype", void 0)
], RatesController.prototype, "update", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('rate.manage'),
    (0, common_1.HttpCode)(200),
    (0, common_1.Delete)('rate-plans/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Function]),
    __metadata("design:returntype", Promise)
], RatesController.prototype, "archive", null);
exports.RatesController = RatesController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [rates_service_1.RatesService])
], RatesController);
//# sourceMappingURL=rates.controller.js.map