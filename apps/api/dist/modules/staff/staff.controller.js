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
exports.StaffController = void 0;
const common_1 = require("@nestjs/common");
const validation_1 = require("@pms/validation");
const zod_validation_pipe_1 = require("../../common/pipes/zod-validation.pipe");
const access_decorators_1 = require("../rbac/decorators/access.decorators");
const staff_service_1 = require("./staff.service");
let StaffController = class StaffController {
    staff;
    constructor(staff) {
        this.staff = staff;
    }
    list(query, access) {
        return this.staff.list(query, access);
    }
    invite(dto, access) {
        return this.staff.invite(dto, access);
    }
    async resend(id, access) {
        await this.staff.resendInvite(id, access);
        return { message: 'Invitation sent again.' };
    }
    add(id, dto, access) {
        return this.staff.addAssignment(id, dto, access);
    }
    remove(id, assignmentId, access) {
        return this.staff.removeAssignment(id, assignmentId, access);
    }
    disable(id, access) {
        return this.staff.setActive(id, false, access);
    }
    enable(id, access) {
        return this.staff.setActive(id, true, access);
    }
};
exports.StaffController = StaffController;
__decorate([
    (0, access_decorators_1.RequirePermission)('staff.read'),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.staffQuerySchema))),
    __param(1, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Function]),
    __metadata("design:returntype", void 0)
], StaffController.prototype, "list", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('staff.manage'),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.inviteStaffSchema))),
    __param(1, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Function]),
    __metadata("design:returntype", void 0)
], StaffController.prototype, "invite", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('staff.manage'),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)(':id/resend-invite'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Function]),
    __metadata("design:returntype", Promise)
], StaffController.prototype, "resend", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('role.assign'),
    (0, common_1.Post)(':id/assignments'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.scopeSchema))),
    __param(2, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Function]),
    __metadata("design:returntype", void 0)
], StaffController.prototype, "add", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('role.assign'),
    (0, common_1.HttpCode)(200),
    (0, common_1.Delete)(':id/assignments/:assignmentId'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Param)('assignmentId', common_1.ParseUUIDPipe)),
    __param(2, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Function]),
    __metadata("design:returntype", void 0)
], StaffController.prototype, "remove", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('staff.manage'),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)(':id/disable'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Function]),
    __metadata("design:returntype", void 0)
], StaffController.prototype, "disable", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('staff.manage'),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)(':id/enable'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, access_decorators_1.Access)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Function]),
    __metadata("design:returntype", void 0)
], StaffController.prototype, "enable", null);
exports.StaffController = StaffController = __decorate([
    (0, common_1.Controller)('staff'),
    __metadata("design:paramtypes", [staff_service_1.StaffService])
], StaffController);
//# sourceMappingURL=staff.controller.js.map