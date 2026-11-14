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
exports.PurchasingController = void 0;
const common_1 = require("@nestjs/common");
const validation_1 = require("@pms/validation");
const zod_validation_pipe_1 = require("../../common/pipes/zod-validation.pipe");
const access_decorators_1 = require("../rbac/decorators/access.decorators");
const purchasing_service_1 = require("./purchasing.service");
let PurchasingController = class PurchasingController {
    purchasing;
    constructor(purchasing) {
        this.purchasing = purchasing;
    }
    list(propertyId, query, access) {
        return this.purchasing.list(propertyId, query, access);
    }
    create(propertyId, dto, access) {
        return this.purchasing.create(propertyId, dto, access);
    }
    /** Approve/reject need purchasing.approve; the requester may cancel their own request. The service checks which. */
    decide(id, dto, access) {
        return this.purchasing.decide(id, dto, access);
    }
    receive(id, dto, access) {
        return this.purchasing.receive(id, dto, access);
    }
    invoice(id, dto, access) {
        return this.purchasing.invoice(id, dto, access);
    }
    invoices(propertyId, query, access) {
        return this.purchasing.listInvoices(propertyId, query, access);
    }
    pay(id, dto, access) {
        return this.purchasing.payInvoice(id, dto, access);
    }
};
exports.PurchasingController = PurchasingController;
__decorate([
    (0, access_decorators_1.RequirePermission)('purchasing.read'),
    (0, common_1.Get)('properties/:propertyId/purchase-orders'),
    __param(0, (0, common_1.Param)('propertyId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.ordersQuerySchema))),
    __param(2, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Function]),
    __metadata("design:returntype", void 0)
], PurchasingController.prototype, "list", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('purchasing.request'),
    (0, common_1.Post)('properties/:propertyId/purchase-orders'),
    __param(0, (0, common_1.Param)('propertyId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.createOrderSchema))),
    __param(2, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Function]),
    __metadata("design:returntype", void 0)
], PurchasingController.prototype, "create", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('purchasing.read'),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('purchase-orders/:id/decision'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.decisionSchema))),
    __param(2, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Function]),
    __metadata("design:returntype", void 0)
], PurchasingController.prototype, "decide", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('purchasing.receive'),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('purchase-orders/:id/receive'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.receiveSchema))),
    __param(2, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Function]),
    __metadata("design:returntype", void 0)
], PurchasingController.prototype, "receive", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('purchasing.pay'),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('purchase-orders/:id/invoice'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.invoiceSchema))),
    __param(2, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Function]),
    __metadata("design:returntype", void 0)
], PurchasingController.prototype, "invoice", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('purchasing.read'),
    (0, common_1.Get)('properties/:propertyId/supplier-invoices'),
    __param(0, (0, common_1.Param)('propertyId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.invoicesQuerySchema))),
    __param(2, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Function]),
    __metadata("design:returntype", void 0)
], PurchasingController.prototype, "invoices", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('purchasing.pay'),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('supplier-invoices/:id/pay'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.payInvoiceSchema))),
    __param(2, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Function]),
    __metadata("design:returntype", void 0)
], PurchasingController.prototype, "pay", null);
exports.PurchasingController = PurchasingController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [purchasing_service_1.PurchasingService])
], PurchasingController);
//# sourceMappingURL=purchasing.controller.js.map