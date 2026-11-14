"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("@pms/types");
const vitest_1 = require("vitest");
const access_context_1 = require("./access-context");
const grant_1 = require("./grant");
const ORG = '00000000-0000-4000-8000-0000000000f0';
const A = 'prop-a';
const B = 'prop-b';
const C = 'prop-c';
const G = 'group-1';
const props = [{ id: A, groupId: G }, { id: B, groupId: G }, { id: C, groupId: null }];
const perms = (key) => types_1.SYSTEM_ROLE_TEMPLATES.find((r) => r.key === key).permissions;
const who = (grants) => new access_context_1.AccessContext('u', ORG, grants, props);
const grant = (roleKey, scopeType, scopeId) => ({ roleKey, scopeType, scopeId, permissions: perms(roleKey) });
const owner = who([grant('OWNER', 'ORGANIZATION', ORG)]);
const managerAtA = who([grant('GENERAL_MANAGER', 'PROPERTY', A)]);
const groupManager = who([grant('GENERAL_MANAGER', 'GROUP', G)]);
const frontDesk = who([grant('FRONT_DESK', 'PROPERTY', A)]);
(0, vitest_1.describe)('canGrant: nobody can give more access than they hold', () => {
    (0, vitest_1.it)('an owner can grant any role anywhere', () => {
        for (const key of ['OWNER', 'GENERAL_MANAGER', 'HOUSEKEEPER', 'FRONT_DESK']) {
            (0, vitest_1.expect)((0, grant_1.canGrant)(owner, perms(key), 'ORGANIZATION', ORG, props)).toBe(true);
            (0, vitest_1.expect)((0, grant_1.canGrant)(owner, perms(key), 'PROPERTY', A, props)).toBe(true);
        }
    });
    (0, vitest_1.it)('a property manager can staff their own property but no other', () => {
        (0, vitest_1.expect)((0, grant_1.canGrant)(managerAtA, perms('HOUSEKEEPER'), 'PROPERTY', A, props)).toBe(true);
        (0, vitest_1.expect)((0, grant_1.canGrant)(managerAtA, perms('FRONT_DESK'), 'PROPERTY', A, props)).toBe(true);
        (0, vitest_1.expect)((0, grant_1.canGrant)(managerAtA, perms('HOUSEKEEPER'), 'PROPERTY', B, props)).toBe(false);
        (0, vitest_1.expect)((0, grant_1.canGrant)(managerAtA, perms('HOUSEKEEPER'), 'PROPERTY', C, props)).toBe(false);
    });
    (0, vitest_1.it)('nobody below organization level can grant organization-wide access or the Owner role organization-wide', () => {
        (0, vitest_1.expect)((0, grant_1.canGrant)(managerAtA, perms('HOUSEKEEPER'), 'ORGANIZATION', ORG, props)).toBe(false);
        (0, vitest_1.expect)((0, grant_1.canGrant)(managerAtA, perms('OWNER'), 'ORGANIZATION', ORG, props)).toBe(false);
        (0, vitest_1.expect)((0, grant_1.canGrant)(groupManager, perms('OWNER'), 'ORGANIZATION', ORG, props)).toBe(false);
    });
    (0, vitest_1.it)('the Owner role at one property only equals what the manager already holds there', () => {
        (0, vitest_1.expect)((0, grant_1.canGrant)(managerAtA, perms('OWNER'), 'PROPERTY', A, props)).toBe(true);
        (0, vitest_1.expect)((0, grant_1.canGrant)(managerAtA, perms('OWNER'), 'PROPERTY', B, props)).toBe(false);
    });
    (0, vitest_1.it)('a group manager covers the group and its properties, not outside it', () => {
        (0, vitest_1.expect)((0, grant_1.canGrant)(groupManager, perms('FRONT_DESK'), 'GROUP', G, props)).toBe(true);
        (0, vitest_1.expect)((0, grant_1.canGrant)(groupManager, perms('FRONT_DESK'), 'PROPERTY', B, props)).toBe(true);
        (0, vitest_1.expect)((0, grant_1.canGrant)(groupManager, perms('FRONT_DESK'), 'PROPERTY', C, props)).toBe(false);
    });
    (0, vitest_1.it)('a manager at only one property of a group cannot grant on the whole group', () => {
        (0, vitest_1.expect)((0, grant_1.canGrant)(managerAtA, perms('FRONT_DESK'), 'GROUP', G, props)).toBe(false);
    });
    (0, vitest_1.it)('an empty group needs organization-wide access (properties added later would inherit it)', () => {
        (0, vitest_1.expect)((0, grant_1.canGrant)(groupManager, perms('FRONT_DESK'), 'GROUP', 'empty-group', props)).toBe(false);
        (0, vitest_1.expect)((0, grant_1.canGrant)(owner, perms('FRONT_DESK'), 'GROUP', 'empty-group', props)).toBe(true);
    });
    (0, vitest_1.it)('front desk cannot hand out manager or supervisor roles', () => {
        (0, vitest_1.expect)((0, grant_1.canGrant)(frontDesk, perms('GENERAL_MANAGER'), 'PROPERTY', A, props)).toBe(false);
        (0, vitest_1.expect)((0, grant_1.canGrant)(frontDesk, perms('HOUSEKEEPING_SUPERVISOR'), 'PROPERTY', A, props)).toBe(false);
        (0, vitest_1.expect)((0, grant_1.canGrant)(frontDesk, ['property.read'], 'PROPERTY', A, props)).toBe(true);
    });
    (0, vitest_1.it)('an unknown permission can never be granted (fails closed)', () => {
        (0, vitest_1.expect)((0, grant_1.canGrant)(owner, ['finance.view_everything'], 'PROPERTY', A, props)).toBe(false);
    });
});
//# sourceMappingURL=grant.spec.js.map