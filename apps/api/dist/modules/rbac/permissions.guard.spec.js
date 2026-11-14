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
const core_1 = require("@nestjs/core");
const vitest_1 = require("vitest");
const access_context_1 = require("../../common/access/access-context");
const public_decorator_1 = require("../auth/decorators/public.decorator");
const access_decorators_1 = require("./decorators/access.decorators");
const permissions_guard_1 = require("./guards/permissions.guard");
const ORG = '00000000-0000-4000-8000-0000000000f0';
const P1 = '00000000-0000-4000-8000-000000000001';
const P2 = '00000000-0000-4000-8000-000000000002';
class Demo {
    open() { }
    mine() { }
    read() { }
    update() { }
    manageRoles() { }
    naked() { }
}
__decorate([
    (0, public_decorator_1.Public)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], Demo.prototype, "open", null);
__decorate([
    (0, access_decorators_1.Authenticated)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], Demo.prototype, "mine", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('property.read'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], Demo.prototype, "read", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('property.update'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], Demo.prototype, "update", null);
__decorate([
    (0, access_decorators_1.RequirePermission)('role.manage'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], Demo.prototype, "manageRoles", null);
function setup(grants) {
    const access = new access_context_1.AccessContext('u1', ORG, grants, [
        { id: P1, groupId: null },
        { id: P2, groupId: null },
    ]);
    let loads = 0;
    const rbac = { loadAccess: async () => (loads++, access) };
    const guard = new permissions_guard_1.PermissionsGuard(new core_1.Reflector(), rbac);
    const run = (handler, headers = {}, signedIn = true) => {
        const req = {
            auth: signedIn ? { userId: 'u1', organizationId: ORG, familyId: 'f1' } : undefined,
            header: (name) => headers[name.toLowerCase()],
        };
        const ctx = {
            getHandler: () => Demo.prototype[handler],
            getClass: () => Demo,
            switchToHttp: () => ({ getRequest: () => req }),
        };
        return { result: guard.canActivate(ctx), req, loads: () => loads };
    };
    return { run, access };
}
const manager = { roleKey: 'PROPERTY_MANAGER', scopeType: 'PROPERTY', scopeId: P1, permissions: ['property.read', 'property.update'] };
const owner = { roleKey: 'OWNER', scopeType: 'ORGANIZATION', scopeId: ORG, permissions: ['property.read', 'property.update', 'role.manage'] };
(0, vitest_1.describe)('PermissionsGuard', () => {
    (0, vitest_1.it)('lets @Public routes through without any lookup', async () => {
        const t = setup([]);
        const { result, loads } = t.run('open', {}, false);
        await (0, vitest_1.expect)(result).resolves.toBe(true);
        (0, vitest_1.expect)(loads()).toBe(0);
    });
    (0, vitest_1.it)('DENIES routes that declare no rule (deny by default)', async () => {
        await (0, vitest_1.expect)(setup([owner]).run('naked').result).rejects.toMatchObject({ code: 'ROUTE_NOT_CONFIGURED' });
    });
    (0, vitest_1.it)('@Authenticated needs a login but no database lookup', async () => {
        const t = setup([]);
        const { result, loads } = t.run('mine');
        await (0, vitest_1.expect)(result).resolves.toBe(true);
        (0, vitest_1.expect)(loads()).toBe(0);
    });
    (0, vitest_1.it)('allows a user holding the permission and exposes access on the request', async () => {
        const { result, req } = setup([owner]).run('read');
        await (0, vitest_1.expect)(result).resolves.toBe(true);
        (0, vitest_1.expect)(req.access).toBeInstanceOf(access_context_1.AccessContext);
    });
    (0, vitest_1.it)('refuses a user lacking the permission', async () => {
        await (0, vitest_1.expect)(setup([manager]).run('manageRoles').result).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
    (0, vitest_1.it)('a housekeeper-style grant cannot update properties', async () => {
        const housekeeper = { roleKey: 'HOUSEKEEPER', scopeType: 'PROPERTY', scopeId: P1, permissions: ['property.read'] };
        await (0, vitest_1.expect)(setup([housekeeper]).run('update').result).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
    (0, vitest_1.it)('X-Property-Id of a property the user cannot see is refused', async () => {
        await (0, vitest_1.expect)(setup([manager]).run('read', { 'x-property-id': P2 }).result).rejects.toMatchObject({ code: 'PROPERTY_NOT_ACCESSIBLE' });
    });
    (0, vitest_1.it)('X-Property-Id of an allowed property passes and becomes the active property', async () => {
        const { result, req } = setup([manager]).run('update', { 'x-property-id': P1 });
        await (0, vitest_1.expect)(result).resolves.toBe(true);
        (0, vitest_1.expect)(req.access.activePropertyId).toBe(P1);
    });
    (0, vitest_1.it)('a permission held only at property A is refused when property B is selected', async () => {
        const both = [manager, { roleKey: 'FRONT_DESK', scopeType: 'PROPERTY', scopeId: P2, permissions: ['property.read'] }];
        await (0, vitest_1.expect)(setup(both).run('update', { 'x-property-id': P2 }).result).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
    (0, vitest_1.it)('rejects a malformed X-Property-Id', async () => {
        await (0, vitest_1.expect)(setup([owner]).run('read', { 'x-property-id': 'not-a-uuid' }).result).rejects.toMatchObject({ code: 'INVALID_PROPERTY_HEADER' });
    });
    (0, vitest_1.it)('"ALL" means no specific property', async () => {
        const { result, req } = setup([manager]).run('read', { 'x-property-id': 'ALL' });
        await (0, vitest_1.expect)(result).resolves.toBe(true);
        (0, vitest_1.expect)(req.access.activePropertyId).toBeNull();
    });
});
//# sourceMappingURL=permissions.guard.spec.js.map