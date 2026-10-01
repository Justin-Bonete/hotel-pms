/**
 * Seed (dev/demo). Idempotent: safe to run repeatedly.
 * Runs with DATABASE_URL (owner role), so it is not subject to RLS.
 *
 * Seeds:
 *  1. Phase 1 permissions (code-defined source of truth)
 *  2. System roles + their permissions
 *  3. Demo organization "ABC Hospitality" with 3 properties and departments
 *  4. One Owner user (credentials from env, dev only)
 *
 * Only real Phase 1 data is created. No reservations, revenue, etc.
 */
import { PrismaClient, PropertyType, ScopeType, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const PERMISSIONS: Array<{ key: string; module: string; description: string }> = [
  { key: 'organization.read', module: 'organization', description: 'View organization profile' },
  { key: 'organization.update', module: 'organization', description: 'Edit organization profile' },
  { key: 'property_group.read', module: 'property', description: 'View property groups' },
  { key: 'property_group.manage', module: 'property', description: 'Create, edit, delete property groups' },
  { key: 'property.read', module: 'property', description: 'View properties' },
  { key: 'property.create', module: 'property', description: 'Create properties' },
  { key: 'property.update', module: 'property', description: 'Edit properties' },
  { key: 'property.delete', module: 'property', description: 'Archive properties' },
  { key: 'staff.read', module: 'staff', description: 'View staff accounts' },
  { key: 'staff.manage', module: 'staff', description: 'Create, edit, disable staff accounts' },
  { key: 'role.read', module: 'rbac', description: 'View roles and permissions' },
  { key: 'role.manage', module: 'rbac', description: 'Create and edit custom roles' },
  { key: 'role.assign', module: 'rbac', description: 'Assign roles to staff (within own scope)' },
  { key: 'audit.read', module: 'audit', description: 'View audit logs' },
];

const ALL = PERMISSIONS.map((p) => p.key);

// Phase 1 only has org/property/staff/RBAC/audit permissions. Operational roles
// (front desk, housekeeping, cashier...) receive their real permissions in the phase
// that introduces those modules; for now they can only see properties.
const SYSTEM_ROLES: Array<{ key: string; name: string; description: string; permissions: string[] }> = [
  { key: 'OWNER', name: 'Owner', description: 'Full access to the organization', permissions: ALL },
  { key: 'SUPER_ADMIN', name: 'Super Admin', description: 'Full administrative access', permissions: ALL },
  {
    key: 'GENERAL_MANAGER',
    name: 'General Manager',
    description: 'Manages properties and staff',
    permissions: ['organization.read', 'property_group.read', 'property.read', 'property.update',
      'staff.read', 'staff.manage', 'role.read', 'role.assign', 'audit.read'],
  },
  {
    key: 'PROPERTY_MANAGER',
    name: 'Property Manager',
    description: 'Manages assigned properties',
    permissions: ['property.read', 'property.update', 'staff.read', 'role.read'],
  },
  ...[
    ['FRONT_DESK', 'Front Desk'],
    ['RECEPTIONIST', 'Receptionist'],
    ['HOUSEKEEPING_SUPERVISOR', 'Housekeeping Supervisor'],
    ['HOUSEKEEPER', 'Housekeeper'],
    ['MAINTENANCE', 'Maintenance'],
    ['CASHIER', 'Cashier'],
    ['ACCOUNTANT', 'Accountant'],
    ['INVENTORY_MANAGER', 'Inventory Manager'],
  ].map(([key, name]) => ({
    key: key as string,
    name: name as string,
    description: `${name} (operational permissions arrive with their modules)`,
    permissions: ['property.read'],
  })),
];

const DEMO_PROPERTIES: Array<{
  name: string; slug: string; type: PropertyType; group: string; city: string; region: string;
}> = [
  { name: 'Manila Grand Hotel', slug: 'manila-grand', type: PropertyType.HOTEL, group: 'City & Highland', city: 'Manila', region: 'NCR' },
  { name: 'Baguio Mountain Lodge', slug: 'baguio-lodge', type: PropertyType.INN, group: 'City & Highland', city: 'Baguio', region: 'Benguet' },
  { name: 'La Union Beach Resort', slug: 'la-union-resort', type: PropertyType.RESORT, group: 'Coastal', city: 'San Juan', region: 'La Union' },
];

const DEPARTMENTS = ['Front Desk', 'Housekeeping', 'Maintenance', 'Food & Beverage', 'Accounting'];

async function seedPermissionsAndRoles() {
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({ where: { key: p.key }, update: p, create: p });
  }
  const permissionByKey = new Map((await prisma.permission.findMany()).map((p) => [p.key, p.id]));

  for (const r of SYSTEM_ROLES) {
    // Compound unique with NULL organizationId can't be used in upsert; find-then-write.
    const existing = await prisma.role.findFirst({ where: { organizationId: null, key: r.key } });
    const role = existing
      ? await prisma.role.update({ where: { id: existing.id }, data: { name: r.name, description: r.description } })
      : await prisma.role.create({
          data: { organizationId: null, key: r.key, name: r.name, description: r.description, isSystem: true },
        });

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: r.permissions.map((k) => ({ roleId: role.id, permissionId: permissionByKey.get(k)! })),
    });
  }
}

async function seedDemoOrganization() {
  const org = await prisma.organization.upsert({
    where: { slug: 'abc-hospitality' },
    update: {},
    create: { name: 'ABC Hospitality', slug: 'abc-hospitality' },
  });

  const groups = new Map<string, string>();
  for (const name of new Set(DEMO_PROPERTIES.map((p) => p.group))) {
    const g = await prisma.propertyGroup.upsert({
      where: { organizationId_name: { organizationId: org.id, name } },
      update: {},
      create: { organizationId: org.id, name },
    });
    groups.set(name, g.id);
  }

  for (const p of DEMO_PROPERTIES) {
    const property = await prisma.property.upsert({
      where: { organizationId_slug: { organizationId: org.id, slug: p.slug } },
      update: {},
      create: {
        organizationId: org.id,
        groupId: groups.get(p.group),
        name: p.name,
        slug: p.slug,
        type: p.type,
        city: p.city,
        region: p.region,
      },
    });
    for (const name of DEPARTMENTS) {
      await prisma.department.upsert({
        where: { propertyId_name: { propertyId: property.id, name } },
        update: {},
        create: { organizationId: org.id, propertyId: property.id, name },
      });
    }
  }

  const email = (process.env.SEED_OWNER_EMAIL ?? 'owner@abc-hospitality.test').toLowerCase();
  const password = process.env.SEED_OWNER_PASSWORD;
  if (!password) throw new Error('SEED_OWNER_PASSWORD is not set (see .env.example)');

  const owner = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      organizationId: org.id,
      email,
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      firstName: 'Demo',
      lastName: 'Owner',
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
  });

  const ownerRole = await prisma.role.findFirstOrThrow({ where: { organizationId: null, key: 'OWNER' } });
  await prisma.userRoleAssignment.upsert({
    where: {
      userId_roleId_scopeType_scopeId: {
        userId: owner.id, roleId: ownerRole.id, scopeType: ScopeType.ORGANIZATION, scopeId: org.id,
      },
    },
    update: {},
    create: {
      organizationId: org.id, userId: owner.id, roleId: ownerRole.id,
      scopeType: ScopeType.ORGANIZATION, scopeId: org.id,
    },
  });

  return { org, email };
}

async function main() {
  await seedPermissionsAndRoles();
  const { org, email } = await seedDemoOrganization();
  console.log(`Seeded organization "${org.name}". Owner login: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
