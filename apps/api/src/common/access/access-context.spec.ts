import { describe, expect, it } from 'vitest';
import { AccessContext, type PropertyRef, type RoleGrant } from './access-context';

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const C = '00000000-0000-4000-8000-00000000000c';
const GROUP_1 = '00000000-0000-4000-8000-0000000000a1';
const ORG = '00000000-0000-4000-8000-0000000000f0';

const properties: PropertyRef[] = [
  { id: A, groupId: GROUP_1 },
  { id: B, groupId: GROUP_1 },
  { id: C, groupId: null },
];

const grant = (scopeType: RoleGrant['scopeType'], scopeId: string, permissions: string[], roleKey = 'R'): RoleGrant => ({
  roleKey,
  scopeType,
  scopeId,
  permissions,
});
const make = (grants: RoleGrant[]) => new AccessContext('u1', ORG, grants, properties);

describe('AccessContext', () => {
  it('a user with no roles can do nothing and sees nothing', () => {
    const ctx = make([]);
    expect(ctx.can('property.read')).toBe(false);
    expect(ctx.canSeeProperty(A)).toBe(false);
    expect(ctx.scopeOf('property.read')).toEqual({ all: false, ids: new Set() });
  });

  it('organization scope applies to every property', () => {
    const ctx = make([grant('ORGANIZATION', ORG, ['property.read', 'property.create'])]);
    expect(ctx.can('property.read', A)).toBe(true);
    expect(ctx.can('property.read', C)).toBe(true);
    expect(ctx.can('property.create')).toBe(true);
    expect(ctx.scopeOf('property.read').all).toBe(true);
  });

  it('property scope applies to that property only', () => {
    const ctx = make([grant('PROPERTY', A, ['property.read', 'property.update'])]);
    expect(ctx.can('property.update', A)).toBe(true);
    expect(ctx.can('property.update', B)).toBe(false);
    expect(ctx.canSeeProperty(A)).toBe(true);
    expect(ctx.canSeeProperty(B)).toBe(false);
  });

  it('group scope applies to the properties of that group', () => {
    const ctx = make([grant('GROUP', GROUP_1, ['property.read'])]);
    expect(ctx.can('property.read', A)).toBe(true);
    expect(ctx.can('property.read', B)).toBe(true);
    expect(ctx.can('property.read', C)).toBe(false);
  });

  it('organization-level permissions are ignored unless granted at organization scope', () => {
    const ctx = make([grant('PROPERTY', A, ['property.read', 'property.create', 'role.manage'])]);
    expect(ctx.can('property.read', A)).toBe(true);
    expect(ctx.can('property.create')).toBe(false);
    expect(ctx.can('role.manage')).toBe(false);
  });

  it('combines several assignments (manager of A, front desk at B)', () => {
    const ctx = make([
      grant('PROPERTY', A, ['property.read', 'property.update'], 'PROPERTY_MANAGER'),
      grant('PROPERTY', B, ['property.read'], 'FRONT_DESK'),
    ]);
    expect(ctx.can('property.update', A)).toBe(true);
    expect(ctx.can('property.update', B)).toBe(false);
    expect(ctx.can('property.read', B)).toBe(true);
  });

  it('a grant on a deleted/unknown property gives nothing (fail closed)', () => {
    const ctx = make([grant('PROPERTY', '00000000-0000-4000-8000-0000000000ff', ['property.read'])]);
    expect(ctx.can('property.read')).toBe(false);
  });

  it('unknown permission keys grant nothing', () => {
    const ctx = make([grant('ORGANIZATION', ORG, ['finance.view_everything'])]);
    expect(ctx.toSummary().permissions).toEqual({});
  });

  it('the property switcher narrows data scope but not the picker list', () => {
    const ctx = make([grant('ORGANIZATION', ORG, ['property.read'])]);
    ctx.setActiveProperty(B);
    expect(ctx.scopeOf('property.read').all).toBe(true);
    expect(ctx.scopeInActive('property.read')).toEqual({ all: false, ids: new Set([B]) });
  });

  it('switching to a property you lack the permission for yields an empty scope', () => {
    const ctx = make([grant('PROPERTY', A, ['property.update'])]);
    ctx.setActiveProperty(B);
    expect(ctx.scopeInActive('property.update')).toEqual({ all: false, ids: new Set() });
  });
});
