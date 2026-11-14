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
exports.GuestsController = void 0;
const common_1 = require("@nestjs/common");
const validation_1 = require("@pms/validation");
const zod_validation_pipe_1 = require("../../common/pipes/zod-validation.pipe");
const access_decorators_1 = require("../rbac/decorators/access.decorators");
const guests_service_1 = require("./guests.service");
// Guests belong to the organization, not one property, so these routes only require that the caller
// HOLDS the permission somewhere. A guest's stays are filtered to properties the caller can see.
let GuestsController = class GuestsController {
    guests;
    constructor(guests) {
        this.guests = guests;
    }
    list(query) {
        return this.guests.list(query);
    }
    get(id, access) {
        return this.guests.get(id, access);
    }
    create(dto, access) {
        return this.guests.create(dto, access);
    }
    update(id, dto, access) {
        return this.guests.update(id, dto, access);
    }
};
exports.GuestsController = GuestsController;
__decorate([
    (0, access_decorators_1.RequirePermission)('guest.read'),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.guestsQuerySchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], GuestsController.prototype, "list", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('guest.read'),
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Function]),
    __metadata("design:returntype", void 0)
], GuestsController.prototype, "get", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('guest.manage'),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.guestSchema))),
    __param(1, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Function]),
    __metadata("design:returntype", void 0)
], GuestsController.prototype, "create", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('guest.manage'),
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.updateGuestSchema))),
    __param(2, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Function]),
    __metadata("design:returntype", void 0)
], GuestsController.prototype, "update", null);
exports.GuestsController = GuestsController = __decorate([
    (0, common_1.Controller)('guests'),
    __metadata("design:paramtypes", [guests_service_1.GuestsService])
], GuestsController);
//# sourceMappingURL=guests.controller.js.map