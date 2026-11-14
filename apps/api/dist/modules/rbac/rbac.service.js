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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RbacService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const access_context_1 = require("../../common/access/access-context");
const app_exception_1 = require("../../common/http/app-exception");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const rbac_repository_1 = require("./rbac.repository");
let RbacService = class RbacService {
    prisma;
    repo;
    constructor(prisma, repo) {
        this.prisma = prisma;
        this.repo = repo;
    }
    /**
     * Builds the caller's AccessContext from the database on every protected request, so a role change
     * or a disabled account takes effect immediately. (Optimization for later: cache in Redis for ~60s and
     * clear it when roles change.)
     */
    async loadAccess(userId, organizationId) {
        const data = await this.prisma.forOrganization(organizationId, (tx) => this.repo.loadAccessData(tx, userId));
        if (!data.user || data.user.status === client_1.UserStatus.DISABLED || data.user.organization.status !== client_1.OrganizationStatus.ACTIVE) {
            throw new app_exception_1.AppException('ACCOUNT_DISABLED', 'This account is disabled. Contact your administrator.', common_1.HttpStatus.FORBIDDEN);
        }
        const grants = data.assignments.map((a) => ({
            roleKey: a.role.key,
            scopeType: a.scopeType,
            scopeId: a.scopeId,
            permissions: a.role.permissions.map((rp) => rp.permission.key),
        }));
        return new access_context_1.AccessContext(userId, organizationId, grants, data.properties);
    }
    async listRoles() {
        const roles = await this.prisma.forTenant((tx) => this.repo.listRoles(tx));
        return roles.map((r) => ({
            id: r.id,
            key: r.key,
            name: r.name,
            description: r.description,
            isSystem: r.isSystem,
            permissions: r.permissions.map((rp) => rp.permission.key).sort(),
        }));
    }
    /** Staff who can be given work of a kind at a property (housekeeping.work, maintenance.work...). Runs inside the caller's transaction. */
    async assignableStaff(tx, propertyId, permissionKey) {
        const property = await tx.property.findFirst({ where: { id: propertyId, deletedAt: null }, select: { groupId: true } });
        const users = await this.repo.usersWithPermission(tx, propertyId, property?.groupId ?? null, permissionKey);
        return users.map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}` }));
    }
};
exports.RbacService = RbacService;
exports.RbacService = RbacService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        rbac_repository_1.RbacRepository])
], RbacService);
//# sourceMappingURL=rbac.service.js.map