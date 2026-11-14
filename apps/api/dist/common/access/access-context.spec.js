"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const access_context_1 = require("./access-context");
const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const C = '00000000-0000-4000-8000-00000000000c';
const GROUP_1 = '00000000-0000-4000-8000-0000000000a1';
const ORG = '00000000-0000-4000-8000-0000000000f0';
const properties = [
    { id: A, groupId: GROUP_1 },
    { id: B, groupId: GROUP_1 },
    { id: C, groupId: null },
];
const grant = (scopeType, scopeId, permissions, roleKey = 'R') => ({
    roleKey,
    scopeType,
    scopeId,
    permissions,
});
const make = (grants) => new access_context_1.AccessContext('u1', ORG, grants, properties);
(0, vitest_1.describe)('AccessContext', () => {
    (0, vitest_1.it)('a user with no roles can do nothing and sees nothing', () => {
        const ctx = make([]);
        (0, vitest_1.expect)(ctx.can('property.read')).toBe(false);
        (0, vitest_1.expect)(ctx.canSeeProperty(A)).toBe(false);
        (0, vitest_1.expect)(ctx.scopeOf('property.read')).toEqual({ all: false, ids: new Set() });
    });
    (0, vitest_1.it)('organization scope applies to every property', () => {
        const ctx = make([grant('ORGANIZATION', ORG, ['property.read', 'property.create'])]);
        (0, vitest_1.expect)(ctx.can('property.read', A)).toBe(true);
        (0, vitest_1.expect)(ctx.can('property.read', C)).toBe(true);
        (0, vitest_1.expect)(ctx.can('property.create')).toBe(true);
        (0, vitest_1.expect)(ctx.scopeOf('property.read').all).toBe(true);
    });
    (0, vitest_1.it)('property scope applies to that property only', () => {
        const ctx = make([grant('PROPERTY', A, ['property.read', 'property.update'])]);
        (0, vitest_1.expect)(ctx.can('property.update', A)).toBe(true);
        (0, vitest_1.expect)(ctx.can('property.update', B)).toBe(false);
        (0, vitest_1.expect)(ctx.canSeeProperty(A)).toBe(true);
        (0, vitest_1.expect)(ctx.canSeeProperty(B)).toBe(false);
    });
    (0, vitest_1.it)('group scope applies to the properties of that group', () => {
        const ctx = make([grant('GROUP', GROUP_1, ['property.read'])]);
        (0, vitest_1.expect)(ctx.can('property.read', A)).toBe(true);
        (0, vitest_1.expect)(ctx.can('property.read', B)).toBe(true);
        (0, vitest_1.expect)(ctx.can('property.read', C)).toBe(false);
    });
    (0, vitest_1.it)('organization-level permissions are ignored unless granted at organization scope', () => {
        const ctx = make([grant('PROPERTY', A, ['property.read', 'property.create', 'role.manage'])]);
        (0, vitest_1.expect)(ctx.can('property.read', A)).toBe(true);
        (0, vitest_1.expect)(ctx.can('property.create')).toBe(false);
        (0, vitest_1.expect)(ctx.can('role.manage')).toBe(false);
    });
    (0, vitest_1.it)('combines several assignments (manager of A, front desk at B)', () => {
        const ctx = make([
            grant('PROPERTY', A, ['property.read', 'property.update'], 'PROPERTY_MANAGER'),
            grant('PROPERTY', B, ['property.read'], 'FRONT_DESK'),
        ]);
        (0, vitest_1.expect)(ctx.can('property.update', A)).toBe(true);
        (0, vitest_1.expect)(ctx.can('property.update', B)).toBe(false);
        (0, vitest_1.expect)(ctx.can('property.read', B)).toBe(true);
    });
    (0, vitest_1.it)('a grant on a deleted/unknown property gives nothing (fail closed)', () => {
        const ctx = make([grant('PROPERTY', '00000000-0000-4000-8000-0000000000ff', ['property.read'])]);
        (0, vitest_1.expect)(ctx.can('property.read')).toBe(false);
    });
    (0, vitest_1.it)('unknown permission keys grant nothing', () => {
        const ctx = make([grant('ORGANIZATION', ORG, ['finance.view_everything'])]);
        (0, vitest_1.expect)(ctx.toSummary().permissions).toEqual({});
    });
    (0, vitest_1.it)('the property switcher narrows data scope but not the picker list', () => {
        const ctx = make([grant('ORGANIZATION', ORG, ['property.read'])]);
        ctx.setActiveProperty(B);
        (0, vitest_1.expect)(ctx.scopeOf('property.read').all).toBe(true);
        (0, vitest_1.expect)(ctx.scopeInActive('property.read')).toEqual({ all: false, ids: new Set([B]) });
    });
    (0, vitest_1.it)('switching to a property you lack the permission for yields an empty scope', () => {
        const ctx = make([grant('PROPERTY', A, ['property.update'])]);
        ctx.setActiveProperty(B);
        (0, vitest_1.expect)(ctx.scopeInActive('property.update')).toEqual({ all: false, ids: new Set() });
    });
});
//# sourceMappingURL=access-context.spec.js.map