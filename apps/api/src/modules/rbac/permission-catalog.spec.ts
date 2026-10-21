import { ALL_PERMISSION_KEYS, OPERATIONAL_ROLE_KEYS, PERMISSION_CATALOG, PERMISSION_LEVEL, SYSTEM_ROLE_TEMPLATES } from '@pms/types';
import { describe, expect, it } from 'vitest';

const role = (key: string) => {
  const found = SYSTEM_ROLE_TEMPLATES.find((r) => r.key === key);
  if (!found) throw new Error(`missing role ${key}`);
  return found;
};

describe('permission catalog', () => {
  it('has unique keys and every key has a level', () => {
    expect(new Set(ALL_PERMISSION_KEYS).size).toBe(PERMISSION_CATALOG.length);
    for (const key of ALL_PERMISSION_KEYS) expect(['ORGANIZATION', 'PROPERTY']).toContain(PERMISSION_LEVEL[key]);
  });
});

describe('system roles', () => {
  it('only reference permissions that exist', () => {
    for (const r of SYSTEM_ROLE_TEMPLATES) for (const p of r.permissions) expect(ALL_PERMISSION_KEYS).toContain(p);
  });

  it('role keys are unique and all 12 expected roles exist', () => {
    const keys = SYSTEM_ROLE_TEMPLATES.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toHaveLength(12);
  });

  it('Owner and Super Admin hold every permission', () => {
    expect(role('OWNER').permissions).toEqual(ALL_PERMISSION_KEYS);
    expect(role('SUPER_ADMIN').permissions).toEqual(ALL_PERMISSION_KEYS);
  });

  it('operational roles never receive administration permissions', () => {
    const forbiddenPrefixes = ['staff.', 'role.', 'audit.', 'organization.', 'property_group.'];
    const forbiddenExact = ['property.create', 'property.update', 'property.delete', 'room.manage', 'room_type.manage', 'rate.manage', 'folio.adjust', 'payment.refund', 'folio.override_checkout', 'tax.manage'];
    for (const key of OPERATIONAL_ROLE_KEYS) {
      for (const p of role(key).permissions) {
        expect(forbiddenPrefixes.some((prefix) => p.startsWith(prefix)), `${key} must not have ${p}`).toBe(false);
        expect(forbiddenExact, `${key} must not have ${p}`).not.toContain(p);
      }
    }
  });

  it('Housekeeping cannot access unassigned room data before room-level assignments exist', () => {
    for (const key of ['HOUSEKEEPER', 'HOUSEKEEPING_SUPERVISOR']) {
      expect([...role(key).permissions]).toEqual(['property.read']);
    }
  });

  it('only owners and managers can manage rooms and room types', () => {
    const allowed = ['OWNER', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'PROPERTY_MANAGER'];
    for (const r of SYSTEM_ROLE_TEMPLATES) {
      for (const p of ['room.manage', 'room_type.manage'] as const) {
        expect(r.permissions.includes(p), `${r.key} / ${p}`).toBe(allowed.includes(r.key));
      }
    }
  });

  it('housekeeping and maintenance cannot access modules that are not ready for their scopes', () => {
    for (const key of ['HOUSEKEEPER', 'HOUSEKEEPING_SUPERVISOR', 'MAINTENANCE']) {
      expect([...role(key).permissions]).toEqual(['property.read']);
    }
  });

  it('cashier can reach folios through reservations but cannot manage stays or view rates', () => {
    expect(role('CASHIER').permissions).toContain('reservation.read');
    for (const p of ['guest.read', 'guest.manage', 'reservation.manage', 'reservation.check_in', 'rate.read', 'rate.manage'] as const) {
      expect(role('CASHIER').permissions, `CASHIER must not have ${p}`).not.toContain(p);
    }
    for (const p of ['guest.read', 'guest.manage', 'reservation.read', 'reservation.manage', 'reservation.check_in', 'rate.read', 'rate.manage'] as const) {
      const key = 'INVENTORY_MANAGER';
        expect(role(key).permissions, `${key} must not have ${p}`).not.toContain(p);
    }
  });

  it('front desk can take reservations and check guests in, but cannot change rates', () => {
    for (const key of ['FRONT_DESK', 'RECEPTIONIST']) {
      for (const p of ['guest.read', 'guest.manage', 'reservation.read', 'reservation.manage', 'reservation.check_in', 'rate.read'] as const) {
        expect(role(key).permissions).toContain(p);
      }
      expect(role(key).permissions).not.toContain('rate.manage');
    }
  });

  it('only owners and managers can change rates', () => {
    const allowed = ['OWNER', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'PROPERTY_MANAGER'];
    for (const r of SYSTEM_ROLE_TEMPLATES) expect(r.permissions.includes('rate.manage'), r.key).toBe(allowed.includes(r.key));
  });

  it('an accountant has read-only access to financial records without guest or reservation access', () => {
    expect([...role('ACCOUNTANT').permissions].sort()).toEqual(['folio.read', 'property.read']);
    for (const p of ['reservation.read', 'reservation.manage', 'reservation.check_in', 'rate.read', 'rate.manage', 'guest.read', 'guest.manage'] as const) {
      expect(role('ACCOUNTANT').permissions).not.toContain(p);
    }
  });

  it('front desk can take payments and post charges, but cannot discount, refund, override or change taxes', () => {
    for (const key of ['FRONT_DESK', 'RECEPTIONIST']) {
      for (const p of ['folio.read', 'folio.charge', 'payment.take'] as const) expect(role(key).permissions).toContain(p);
      for (const p of ['folio.adjust', 'payment.refund', 'folio.override_checkout', 'tax.manage'] as const) expect(role(key).permissions, `${key} must not have ${p}`).not.toContain(p);
    }
  });

  it('only owners and managers can refund, adjust, override a check-out or set taxes', () => {
    const allowed = ['OWNER', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'PROPERTY_MANAGER'];
    for (const r of SYSTEM_ROLE_TEMPLATES) {
      for (const p of ['folio.adjust', 'payment.refund', 'folio.override_checkout', 'tax.manage'] as const) {
        expect(r.permissions.includes(p), `${r.key} / ${p}`).toBe(allowed.includes(r.key));
      }
    }
  });

  it('a cashier can take payments and see folios only; an accountant can read but not touch money', () => {
    expect([...role('CASHIER').permissions].sort()).toEqual(['folio.read', 'payment.take', 'property.read', 'reservation.read']);
    for (const p of ['payment.take', 'folio.charge', 'payment.refund', 'folio.adjust'] as const) expect(role('ACCOUNTANT').permissions).not.toContain(p);
    expect(role('ACCOUNTANT').permissions).toContain('folio.read');
  });

  it('housekeeping, maintenance and inventory staff have no billing access at all', () => {
    for (const key of ['HOUSEKEEPER', 'HOUSEKEEPING_SUPERVISOR', 'MAINTENANCE', 'INVENTORY_MANAGER']) {
      expect(role(key).permissions.filter((p) => p.startsWith('folio.') || p.startsWith('payment.') || p.startsWith('tax.')), key).toEqual([]);
    }
  });

  it('only managers can currently update room status until room-level assignments exist', () => {
    const allowed = ['OWNER', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'PROPERTY_MANAGER'];
    for (const r of SYSTEM_ROLE_TEMPLATES) {
      expect(r.permissions.includes('room.update_status'), r.key).toBe(allowed.includes(r.key));
    }
    for (const key of ['FRONT_DESK', 'RECEPTIONIST', 'HOUSEKEEPING_SUPERVISOR', 'HOUSEKEEPER', 'MAINTENANCE']) {
      expect(role(key).permissions).not.toContain('room.update_status');
    }
  });

  it('only Owner and Super Admin can manage roles or create/archive properties', () => {
    for (const r of SYSTEM_ROLE_TEMPLATES) {
      const admin = r.key === 'OWNER' || r.key === 'SUPER_ADMIN';
      for (const p of ['role.manage', 'property.create', 'property.delete'] as const) {
        expect(r.permissions.includes(p), `${r.key} / ${p}`).toBe(admin);
      }
    }
  });

  it('Branch Manager is property-scoped and can manage branch staff and billing adjustments', () => {
    const branchManager = role('PROPERTY_MANAGER');
    expect(branchManager.name).toBe('Branch Manager');
    for (const p of ['staff.manage', 'role.assign', 'folio.adjust', 'payment.refund', 'rate.manage'] as const) {
      expect(branchManager.permissions).toContain(p);
    }
    for (const p of ['organization.update', 'property.create', 'property.delete', 'role.manage'] as const) {
      expect(branchManager.permissions).not.toContain(p);
    }
  });

  it('Front Desk cannot change room status, rates, discounts, or refunds', () => {
    for (const key of ['FRONT_DESK', 'RECEPTIONIST']) {
      for (const p of ['room.update_status', 'rate.manage', 'folio.adjust', 'payment.refund'] as const) {
        expect(role(key).permissions).not.toContain(p);
      }
    }
  });
});
