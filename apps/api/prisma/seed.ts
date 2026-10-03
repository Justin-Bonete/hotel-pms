/**
 * Seed (dev/demo). Idempotent: safe to run repeatedly.
 * Runs with DATABASE_URL (owner role), so it is not subject to RLS.
 *
 * Seeds:
 *  1. Permissions (from the shared catalog in packages/types)
 *  2. System roles + their permissions
 *  3. Demo organization "ABC Hospitality" with 3 properties and departments
 *  4. One Owner user (credentials from env, dev only)
 *
 * Only real Phase 1 data is created. No reservations, revenue, etc.
 */
import { PrismaClient, PropertyType, RoomStatus, ScopeType, UserStatus } from '@prisma/client';
import { PERMISSION_CATALOG, SYSTEM_ROLE_TEMPLATES } from '@pms/types';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

// Permissions and system roles come from the shared catalog (@pms/types), the same one the API enforces.
const PERMISSIONS = PERMISSION_CATALOG.map(({ key, module, description }) => ({ key, module, description }));
const SYSTEM_ROLES = SYSTEM_ROLE_TEMPLATES;

const DEMO_PROPERTIES: Array<{
  name: string; slug: string; type: PropertyType; group: string; city: string; region: string;
}> = [
  { name: 'Manila Grand Hotel', slug: 'manila-grand', type: PropertyType.HOTEL, group: 'City & Highland', city: 'Manila', region: 'NCR' },
  { name: 'Baguio Mountain Lodge', slug: 'baguio-lodge', type: PropertyType.INN, group: 'City & Highland', city: 'Baguio', region: 'Benguet' },
  { name: 'La Union Beach Resort', slug: 'la-union-resort', type: PropertyType.RESORT, group: 'Coastal', city: 'San Juan', region: 'La Union' },
];

const DEPARTMENTS = ['Front Desk', 'Housekeeping', 'Maintenance', 'Food & Beverage', 'Accounting'];


// ---------------------------------------------------------------- demo rooms (demo organization only)
const STATUS_CYCLE: Array<{ status: RoomStatus; note?: string }> = [
  { status: 'AVAILABLE' }, { status: 'AVAILABLE' }, { status: 'AVAILABLE' }, { status: 'DIRTY' },
  { status: 'CLEANING' }, { status: 'INSPECTED' }, { status: 'AVAILABLE' },
  { status: 'MAINTENANCE', note: 'Aircon not cooling' }, { status: 'AVAILABLE' }, { status: 'AVAILABLE' },
  { status: 'OUT_OF_ORDER', note: 'Water damage in bathroom' }, { status: 'DIRTY' },
];

interface RoomPlan {
  building: string;
  floors: Array<{ level: number; name?: string }>;
  types: Array<{ name: string; maxOccupancy: number; bed: string; amenities: string[] }>;
  rooms: Array<{ number: string; type: string; floor: number }>;
}

const nums = (count: number) => Array.from({ length: count }, (_, i) => i + 1);

const ROOM_PLANS: Record<string, RoomPlan> = {
  'manila-grand': {
    building: 'Main Tower',
    floors: nums(4).map((level) => ({ level })),
    types: [
      { name: 'Standard', maxOccupancy: 2, bed: '1 Queen bed', amenities: ['Wi-Fi', 'Air conditioning', 'TV'] },
      { name: 'Deluxe', maxOccupancy: 3, bed: '1 King bed', amenities: ['Wi-Fi', 'Air conditioning', 'TV', 'Mini bar'] },
      { name: 'Suite', maxOccupancy: 4, bed: '1 King bed + sofa bed', amenities: ['Wi-Fi', 'Air conditioning', 'TV', 'Mini bar', 'Bathtub'] },
    ],
    rooms: nums(4).flatMap((f) => nums(5).map((n) => ({ number: `${f}0${n}`, floor: f, type: n === 5 ? 'Suite' : n === 4 ? 'Deluxe' : 'Standard' }))),
  },
  'baguio-lodge': {
    building: 'Lodge',
    floors: nums(2).map((level) => ({ level })),
    types: [
      { name: 'Standard', maxOccupancy: 2, bed: '1 Double bed', amenities: ['Wi-Fi', 'Heater'] },
      { name: 'Family Room', maxOccupancy: 5, bed: '2 Double beds', amenities: ['Wi-Fi', 'Heater', 'Fireplace'] },
    ],
    rooms: nums(2).flatMap((f) => nums(5).map((n) => ({ number: `${f}0${n}`, floor: f, type: n === 5 ? 'Family Room' : 'Standard' }))),
  },
  'la-union-resort': {
    building: 'Beachfront',
    floors: [{ level: 1, name: 'Villas' }],
    types: [
      { name: 'Villa', maxOccupancy: 4, bed: '1 King bed + 2 single beds', amenities: ['Wi-Fi', 'Air conditioning', 'Private pool'] },
      { name: 'Garden Suite', maxOccupancy: 2, bed: '1 King bed', amenities: ['Wi-Fi', 'Air conditioning', 'Garden view'] },
    ],
    rooms: nums(8).map((n) => ({ number: `V0${n}`, floor: 1, type: n > 6 ? 'Garden Suite' : 'Villa' })),
  },
};

/** Seeds buildings, floors, room types and rooms ONLY for a property that has no rooms yet. */
async function seedRooms(organizationId: string, propertyId: string, slug: string) {
  const plan = ROOM_PLANS[slug];
  if (!plan) return;
  if ((await prisma.room.count({ where: { propertyId } })) > 0) return;

  const building = await prisma.building.upsert({
    where: { propertyId_name: { propertyId, name: plan.building } },
    update: {},
    create: { organizationId, propertyId, name: plan.building },
  });
  const floorIds = new Map<number, string>();
  for (const f of plan.floors) {
    const floor = await prisma.floor.upsert({
      where: { buildingId_level: { buildingId: building.id, level: f.level } },
      update: {},
      create: { organizationId, buildingId: building.id, level: f.level, name: f.name ?? null },
    });
    floorIds.set(f.level, floor.id);
  }
  const typeIds = new Map<string, string>();
  for (const t of plan.types) {
    const existing = await prisma.roomType.findFirst({ where: { propertyId, name: t.name, deletedAt: null } });
    const type =
      existing ??
      (await prisma.roomType.create({
        data: { organizationId, propertyId, name: t.name, maxOccupancy: t.maxOccupancy, bedConfiguration: t.bed, amenities: t.amenities },
      }));
    typeIds.set(t.name, type.id);
  }
  let i = 0;
  for (const r of plan.rooms) {
    const s = STATUS_CYCLE[i % STATUS_CYCLE.length]!;
    i++;
    await prisma.room.create({
      data: {
        organizationId,
        propertyId,
        roomTypeId: typeIds.get(r.type)!,
        floorId: floorIds.get(r.floor) ?? null,
        number: r.number,
        status: s.status,
        statusNote: s.note ?? null,
      },
    });
  }
}

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
    await seedRooms(org.id, property.id, p.slug);
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
