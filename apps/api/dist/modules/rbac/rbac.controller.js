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
exports.RbacController = void 0;
const common_1 = require("@nestjs/common");
const types_1 = require("@pms/types");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const access_decorators_1 = require("./decorators/access.decorators");
const rbac_service_1 = require("./rbac.service");
let RbacController = class RbacController {
    rbac;
    constructor(rbac) {
        this.rbac = rbac;
    }
    /** What the signed-in user can do and where. The web app uses this to show or hide actions. */
    async me(auth) {
        const access = await this.rbac.loadAccess(auth.userId, auth.organizationId);
        return access.toSummary();
    }
    permissions() {
        return types_1.PERMISSION_CATALOG;
    }
    roles() {
        return this.rbac.listRoles();
    }
};
exports.RbacController = RbacController;
__decorate([
    (0, access_decorators_1.Authenticated)(),
    (0, common_1.Get)('me'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RbacController.prototype, "me", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('role.read'),
    (0, common_1.Get)('permissions'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], RbacController.prototype, "permissions", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('role.read'),
    (0, common_1.Get)('roles'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], RbacController.prototype, "roles", null);
exports.RbacController = RbacController = __decorate([
    (0, common_1.Controller)('rbac'),
    __metadata("design:paramtypes", [rbac_service_1.RbacService])
], RbacController);
//# sourceMappingURL=rbac.controller.js.map