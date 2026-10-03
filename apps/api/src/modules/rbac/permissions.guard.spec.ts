import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { AccessContext, type RoleGrant } from '../../common/access/access-context';
import { Public } from '../auth/decorators/public.decorator';
import { Authenticated, RequirePermission } from './decorators/access.decorators';
import { PermissionsGuard } from './guards/permissions.guard';
import type { RbacService } from './rbac.service';

const ORG = '00000000-0000-4000-8000-0000000000f0';
const P1 = '00000000-0000-4000-8000-000000000001';
const P2 = '00000000-0000-4000-8000-000000000002';

class Demo {
  @Public() open() {}
  @Authenticated() mine() {}
  @RequirePermission('property.read') read() {}
  @RequirePermission('property.update') update() {}
  @RequirePermission('role.manage') manageRoles() {}
  naked() {}
}

function setup(grants: RoleGrant[]) {
  const access = new AccessContext('u1', ORG, grants, [
    { id: P1, groupId: null },
    { id: P2, groupId: null },
  ]);
  let loads = 0;
  const rbac = { loadAccess: async () => (loads++, access) } as unknown as RbacService;
  const guard = new PermissionsGuard(new Reflector(), rbac);

  const run = (handler: keyof Demo, headers: Record<string, string> = {}, signedIn = true) => {
    const req: Record<string, unknown> = {
      auth: signedIn ? { userId: 'u1', organizationId: ORG, familyId: 'f1' } : undefined,
      header: (name: string) => headers[name.toLowerCase()],
    };
    const ctx = {
      getHandler: () => Demo.prototype[handler],
      getClass: () => Demo,
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
    return { result: guard.canActivate(ctx), req, loads: () => loads };
  };
  return { run, access };
}

const manager: RoleGrant = { roleKey: 'PROPERTY_MANAGER', scopeType: 'PROPERTY', scopeId: P1, permissions: ['property.read', 'property.update'] };
const owner: RoleGrant = { roleKey: 'OWNER', scopeType: 'ORGANIZATION', scopeId: ORG, permissions: ['property.read', 'property.update', 'role.manage'] };

describe('PermissionsGuard', () => {
  it('lets @Public routes through without any lookup', async () => {
    const t = setup([]);
    const { result, loads } = t.run('open', {}, false);
    await expect(result).resolves.toBe(true);
    expect(loads()).toBe(0);
  });

  it('DENIES routes that declare no rule (deny by default)', async () => {
    await expect(setup([owner]).run('naked').result).rejects.toMatchObject({ code: 'ROUTE_NOT_CONFIGURED' });
  });

  it('@Authenticated needs a login but no database lookup', async () => {
    const t = setup([]);
    const { result, loads } = t.run('mine');
    await expect(result).resolves.toBe(true);
    expect(loads()).toBe(0);
  });

  it('allows a user holding the permission and exposes access on the request', async () => {
    const { result, req } = setup([owner]).run('read');
    await expect(result).resolves.toBe(true);
    expect(req.access).toBeInstanceOf(AccessContext);
  });

  it('refuses a user lacking the permission', async () => {
    await expect(setup([manager]).run('manageRoles').result).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('a housekeeper-style grant cannot update properties', async () => {
    const housekeeper: RoleGrant = { roleKey: 'HOUSEKEEPER', scopeType: 'PROPERTY', scopeId: P1, permissions: ['property.read'] };
    await expect(setup([housekeeper]).run('update').result).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('X-Property-Id of a property the user cannot see is refused', async () => {
    await expect(setup([manager]).run('read', { 'x-property-id': P2 }).result).rejects.toMatchObject({ code: 'PROPERTY_NOT_ACCESSIBLE' });
  });

  it('X-Property-Id of an allowed property passes and becomes the active property', async () => {
    const { result, req } = setup([manager]).run('update', { 'x-property-id': P1 });
    await expect(result).resolves.toBe(true);
    expect((req.access as AccessContext).activePropertyId).toBe(P1);
  });

  it('a permission held only at property A is refused when property B is selected', async () => {
    const both: RoleGrant[] = [manager, { roleKey: 'FRONT_DESK', scopeType: 'PROPERTY', scopeId: P2, permissions: ['property.read'] }];
    await expect(setup(both).run('update', { 'x-property-id': P2 }).result).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects a malformed X-Property-Id', async () => {
    await expect(setup([owner]).run('read', { 'x-property-id': 'not-a-uuid' }).result).rejects.toMatchObject({ code: 'INVALID_PROPERTY_HEADER' });
  });

  it('"ALL" means no specific property', async () => {
    const { result, req } = setup([manager]).run('read', { 'x-property-id': 'ALL' });
    await expect(result).resolves.toBe(true);
    expect((req.access as AccessContext).activePropertyId).toBeNull();
  });
});
