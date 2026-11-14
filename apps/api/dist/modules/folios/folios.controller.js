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
exports.FoliosController = void 0;
const common_1 = require("@nestjs/common");
const validation_1 = require("@pms/validation");
const zod_validation_pipe_1 = require("../../common/pipes/zod-validation.pipe");
const access_decorators_1 = require("../rbac/decorators/access.decorators");
const folios_service_1 = require("./folios.service");
const KEY = 'idempotency-key';
/** Every money-moving route accepts an optional Idempotency-Key header: replaying it never posts twice. */
let FoliosController = class FoliosController {
    folios;
    constructor(folios) {
        this.folios = folios;
    }
    get(id, access) {
        return this.folios.get(id, access);
    }
    charge(id, dto, key, access) {
        return this.folios.addCharge(id, dto, cleanKey(key), access);
    }
    adjust(id, dto, access) {
        return this.folios.addAdjustment(id, dto, access);
    }
    pay(id, dto, key, access) {
        return this.folios.recordPayment(id, dto, cleanKey(key), access);
    }
    voidItem(id, dto, access) {
        return this.folios.voidItem(id, dto, access);
    }
    refund(id, dto, key, access) {
        return this.folios.refund(id, dto, cleanKey(key), access);
    }
};
exports.FoliosController = FoliosController;
__decorate([
    (0, access_decorators_1.RequirePermission)('folio.read'),
    (0, common_1.Get)('reservations/:id/folio'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Function]),
    __metadata("design:returntype", void 0)
], FoliosController.prototype, "get", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('folio.charge'),
    (0, common_1.Post)('reservations/:id/folio/charges'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.chargeSchema))),
    __param(2, (0, common_1.Headers)(KEY)),
    __param(3, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, Function]),
    __metadata("design:returntype", void 0)
], FoliosController.prototype, "charge", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('folio.adjust'),
    (0, common_1.Post)('reservations/:id/folio/adjustments'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.adjustmentSchema))),
    __param(2, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Function]),
    __metadata("design:returntype", void 0)
], FoliosController.prototype, "adjust", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('payment.take'),
    (0, common_1.Post)('reservations/:id/folio/payments'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.paymentSchema))),
    __param(2, (0, common_1.Headers)(KEY)),
    __param(3, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, Function]),
    __metadata("design:returntype", void 0)
], FoliosController.prototype, "pay", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('folio.adjust'),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('folio-items/:id/void'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.voidSchema))),
    __param(2, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Function]),
    __metadata("design:returntype", void 0)
], FoliosController.prototype, "voidItem", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('payment.refund'),
    (0, common_1.Post)('payments/:id/refunds'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.refundSchema))),
    __param(2, (0, common_1.Headers)(KEY)),
    __param(3, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, Function]),
    __metadata("design:returntype", void 0)
], FoliosController.prototype, "refund", null);
exports.FoliosController = FoliosController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [folios_service_1.FoliosService])
], FoliosController);
/** Keys are opaque client strings; keep them short and printable. */
function cleanKey(value) {
    const key = value?.trim();
    return key && /^[\w:.-]{8,100}$/.test(key) ? key : undefined;
}
//# sourceMappingURL=folios.controller.js.map