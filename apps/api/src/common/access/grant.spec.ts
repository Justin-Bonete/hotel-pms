import { SYSTEM_ROLE_TEMPLATES } from '@pms/types';
import { describe, expect, it } from 'vitest';
import { AccessContext, type PropertyRef, type RoleGrant } from './access-context';
import { canGrant } from './grant';

const ORG = '00000000-0000-4000-8000-0000000000f0';
const A = 'prop-a';
const B = 'prop-b';
const C = 'prop-c';
const G = 'group-1';
const props: PropertyRef[] = [{ id: A, groupId: G }, { id: B, groupId: G }, { id: C, groupId: null }];
const perms = (key: string) => SYSTEM_ROLE_TEMPLATES.find((r) => r.key === key)!.permissions;
const who = (grants: RoleGrant[]) => new AccessContext('u', ORG, grants, props);
const grant = (roleKey: string, scopeType: RoleGrant['scopeType'], scopeId: string): RoleGrant => ({ roleKey, scopeType, scopeId, permissions: perms(roleKey) });

const owner = who([grant('OWNER', 'ORGANIZATION', ORG)]);
const managerAtA = who([grant('GENERAL_MANAGER', 'PROPERTY', A)]);
const groupManager = who([grant('GENERAL_MANAGER', 'GROUP', G)]);
const frontDesk = who([grant('FRONT_DESK', 'PROPERTY', A)]);

describe('canGrant: nobody can give more access than they hold', () => {
  it('an owner can grant any role anywhere', () => {
    for (const key of ['OWNER', 'GENERAL_MANAGER', 'HOUSEKEEPER', 'FRONT_DESK']) {
      expect(canGrant(owner, perms(key), 'ORGANIZATION', ORG, props)).toBe(true);
      expect(canGrant(owner, perms(key), 'PROPERTY', A, props)).toBe(true);
    }
  });

  it('a property manager can staff their own property but no other', () => {
    expect(canGrant(managerAtA, perms('HOUSEKEEPER'), 'PROPERTY', A, props)).toBe(true);
    expect(canGrant(managerAtA, perms('FRONT_DESK'), 'PROPERTY', A, props)).toBe(true);
    expect(canGrant(managerAtA, perms('HOUSEKEEPER'), 'PROPERTY', B, props)).toBe(false);
    expect(canGrant(managerAtA, perms('HOUSEKEEPER'), 'PROPERTY', C, props)).toBe(false);
  });

  it('nobody below organization level can grant organization-wide access or the Owner role organization-wide', () => {
    expect(canGrant(managerAtA, perms('HOUSEKEEPER'), 'ORGANIZATION', ORG, props)).toBe(false);
    expect(canGrant(managerAtA, perms('OWNER'), 'ORGANIZATION', ORG, props)).toBe(false);
    expect(canGrant(groupManager, perms('OWNER'), 'ORGANIZATION', ORG, props)).toBe(false);
  });

  it('the Owner role at one property only equals what the manager already holds there', () => {
    expect(canGrant(managerAtA, perms('OWNER'), 'PROPERTY', A, props)).toBe(true);
    expect(canGrant(managerAtA, perms('OWNER'), 'PROPERTY', B, props)).toBe(false);
  });

  it('a group manager covers the group and its properties, not outside it', () => {
    expect(canGrant(groupManager, perms('FRONT_DESK'), 'GROUP', G, props)).toBe(true);
    expect(canGrant(groupManager, perms('FRONT_DESK'), 'PROPERTY', B, props)).toBe(true);
    expect(canGrant(groupManager, perms('FRONT_DESK'), 'PROPERTY', C, props)).toBe(false);
  });

  it('a manager at only one property of a group cannot grant on the whole group', () => {
    expect(canGrant(managerAtA, perms('FRONT_DESK'), 'GROUP', G, props)).toBe(false);
  });

  it('an empty group needs organization-wide access (properties added later would inherit it)', () => {
    expect(canGrant(groupManager, perms('FRONT_DESK'), 'GROUP', 'empty-group', props)).toBe(false);
    expect(canGrant(owner, perms('FRONT_DESK'), 'GROUP', 'empty-group', props)).toBe(true);
  });

  it('front desk cannot hand out manager or supervisor roles', () => {
    expect(canGrant(frontDesk, perms('GENERAL_MANAGER'), 'PROPERTY', A, props)).toBe(false);
    expect(canGrant(frontDesk, perms('HOUSEKEEPING_SUPERVISOR'), 'PROPERTY', A, props)).toBe(false);
    expect(canGrant(frontDesk, ['property.read'], 'PROPERTY', A, props)).toBe(true);
  });

  it('an unknown permission can never be granted (fails closed)', () => {
    expect(canGrant(owner, ['finance.view_everything'], 'PROPERTY', A, props)).toBe(false);
  });
});
