"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RbacRepository = void 0;
const common_1 = require("@nestjs/common");
let RbacRepository = class RbacRepository {
    async loadAccessData(tx, userId) {
        const [user, assignments, properties] = await Promise.all([
            tx.user.findFirst({
                where: { id: userId, deletedAt: null },
                select: { status: true, organization: { select: { status: true } } },
            }),
            tx.userRoleAssignment.findMany({
                where: { userId },
                include: {
                    role: { select: { key: true, permissions: { select: { permission: { select: { key: true } } } } } },
                },
            }),
            tx.property.findMany({ where: { deletedAt: null }, select: { id: true, groupId: true } }),
        ]);
        return { user, assignments, properties };
    }
    listRoles(tx) {
        return tx.role.findMany({
            orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
            include: { permissions: { select: { permission: { select: { key: true } } } } },
        });
    }
    /**
     * Active users who hold a permission at a property: through an organization-wide role, a role on the
     * property's group, or a role on the property itself.
     */
    async usersWithPermission(tx, propertyId, groupId, permissionKey) {
        const scopes = [
            { scopeType: 'ORGANIZATION' },
            { scopeType: 'PROPERTY', scopeId: propertyId },
        ];
        if (groupId)
            scopes.push({ scopeType: 'GROUP', scopeId: groupId });
        const rows = await tx.userRoleAssignment.findMany({
            where: {
                OR: scopes,
                role: { permissions: { some: { permission: { key: permissionKey } } } },
                user: { status: 'ACTIVE', deletedAt: null },
            },
            select: { user: { select: { id: true, firstName: true, lastName: true } } },
        });
        const unique = new Map(rows.map((r) => [r.user.id, r.user]));
        return [...unique.values()].sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
    }
};
exports.RbacRepository = RbacRepository;
exports.RbacRepository = RbacRepository = __decorate([
    (0, common_1.Injectable)()
], RbacRepository);
//# sourceMappingURL=rbac.repository.js.map