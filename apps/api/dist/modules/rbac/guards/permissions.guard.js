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
var PermissionsGuard_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionsGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const app_exception_1 = require("../../../common/http/app-exception");
const public_decorator_1 = require("../../auth/decorators/public.decorator");
const access_decorators_1 = require("../decorators/access.decorators");
const rbac_service_1 = require("../rbac.service");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/**
 * Global guard, runs after JwtAuthGuard. DENY BY DEFAULT: every route must be @Public(),
 * @Authenticated() or @RequirePermission(...). A route with none of these is refused, so forgetting
 * a rule can never silently expose data.
 */
let PermissionsGuard = PermissionsGuard_1 = class PermissionsGuard {
    reflector;
    rbac;
    logger = new common_1.Logger(PermissionsGuard_1.name);
    constructor(reflector, rbac) {
        this.reflector = reflector;
        this.rbac = rbac;
    }
    async canActivate(context) {
        const targets = [context.getHandler(), context.getClass()];
        if (this.reflector.getAllAndOverride(public_decorator_1.IS_PUBLIC, targets))
            return true;
        const required = this.reflector.getAllAndOverride(access_decorators_1.REQUIRE_PERMISSION, targets) ?? [];
        const authenticatedOnly = this.reflector.getAllAndOverride(access_decorators_1.AUTHENTICATED_ONLY, targets) ?? false;
        if (required.length === 0 && !authenticatedOnly) {
            this.logger.error(`No access rule on ${context.getClass().name}.${context.getHandler().name}. Add @RequirePermission, @Authenticated or @Public.`);
            throw new app_exception_1.AppException('ROUTE_NOT_CONFIGURED', 'This endpoint has no access rule and is blocked.', common_1.HttpStatus.FORBIDDEN);
        }
        const req = context.switchToHttp().getRequest();
        if (!req.auth)
            throw new app_exception_1.AppException('UNAUTHENTICATED', 'Please sign in to continue.', common_1.HttpStatus.UNAUTHORIZED);
        const header = req.header('x-property-id');
        const propertyId = parsePropertyHeader(header);
        // Routes that only need a login and no property context skip the database lookup.
        if (required.length === 0 && propertyId === null)
            return true;
        const access = await this.rbac.loadAccess(req.auth.userId, req.auth.organizationId);
        if (propertyId !== null) {
            if (!access.canSeeProperty(propertyId)) {
                throw new app_exception_1.AppException('PROPERTY_NOT_ACCESSIBLE', 'You do not have access to this property.', common_1.HttpStatus.FORBIDDEN);
            }
            access.setActiveProperty(propertyId);
        }
        for (const permission of required) {
            if (!access.can(permission, propertyId ?? undefined)) {
                throw new app_exception_1.AppException('FORBIDDEN', 'You do not have permission to do this.', common_1.HttpStatus.FORBIDDEN);
            }
        }
        req.access = access;
        return true;
    }
};
exports.PermissionsGuard = PermissionsGuard;
exports.PermissionsGuard = PermissionsGuard = PermissionsGuard_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        rbac_service_1.RbacService])
], PermissionsGuard);
/** X-Property-Id: absent or "ALL" = all properties; otherwise a property UUID. */
function parsePropertyHeader(value) {
    if (value === undefined || value === '' || value.toUpperCase() === 'ALL')
        return null;
    if (!UUID.test(value)) {
        throw new app_exception_1.AppException('INVALID_PROPERTY_HEADER', 'X-Property-Id must be "ALL" or a property id.', common_1.HttpStatus.BAD_REQUEST);
    }
    return value;
}
//# sourceMappingURL=permissions.guard.js.map