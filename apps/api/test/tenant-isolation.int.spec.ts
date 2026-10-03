/**
 * INTEGRATION test against the real Postgres from docker compose.
 * Proves Row-Level Security works as the runtime role (pms_app). Needs: pnpm db:up, db:migrate, db:rls.
 * Run: pnpm test:int
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const owner = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL }); // table owner: sets up/cleans up
const app = new PrismaClient({ datasourceUrl: process.env.APP_DATABASE_URL }); // what the API uses: RLS enforced

const suffix = randomUUID().slice(0, 8);
let orgA = '';
let orgB = '';
let propA = '';
let propB = '';
let roomA = '';
let roomB = '';

const asTenant = <T>(orgId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>) =>
  app.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.org_id', ${orgId}, true)`;
    return fn(tx);
  });

beforeAll(async () => {
  const a = await owner.organization.create({ data: { name: `Iso A ${suffix}`, slug: `iso-a-${suffix}` } });
  const b = await owner.organization.create({ data: { name: `Iso B ${suffix}`, slug: `iso-b-${suffix}` } });
  orgA = a.id;
  orgB = b.id;
  propA = (await owner.property.create({ data: { organizationId: orgA, name: 'A Hotel', slug: 'a-hotel' } })).id;
  propB = (await owner.property.create({ data: { organizationId: orgB, name: 'B Hotel', slug: 'b-hotel' } })).id;
  await owner.auditLog.create({ data: { organizationId: orgA, action: 'test.seed', entity: 'test' } });
  const typeA = await owner.roomType.create({ data: { organizationId: orgA, propertyId: propA, name: 'Std' } });
  const typeB = await owner.roomType.create({ data: { organizationId: orgB, propertyId: propB, name: 'Std' } });
  roomA = (await owner.room.create({ data: { organizationId: orgA, propertyId: propA, roomTypeId: typeA.id, number: '101' } })).id;
  roomB = (await owner.room.create({ data: { organizationId: orgB, propertyId: propB, roomTypeId: typeB.id, number: '101' } })).id;
});

afterAll(async () => {
  await owner.auditLog.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
  await owner.room.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
  await owner.roomType.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
  await owner.property.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
  await owner.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
  await owner.$disconnect();
  await app.$disconnect();
});

describe('tenant isolation (Row-Level Security)', () => {
  it('sees NOTHING when no tenant is set', async () => {
    const count = await app.property.count({ where: { id: { in: [propA, propB] } } });
    expect(count).toBe(0);
  });

  it('organization A sees only its own properties', async () => {
    const rows = await asTenant(orgA, (tx) => tx.property.findMany({ where: { id: { in: [propA, propB] } }, select: { id: true } }));
    expect(rows.map((r) => r.id)).toEqual([propA]);
  });

  it('organization A cannot read organization B by id', async () => {
    const row = await asTenant(orgA, (tx) => tx.property.findFirst({ where: { id: propB } }));
    expect(row).toBeNull();
  });

  it('organization A cannot insert a row that belongs to organization B', async () => {
    await expect(
      asTenant(orgA, (tx) => tx.property.create({ data: { organizationId: orgB, name: 'Sneaky', slug: `sneaky-${suffix}` } })),
    ).rejects.toThrow();
  });

  it('organization A cannot update or delete organization B rows', async () => {
    const updated = await asTenant(orgA, (tx) => tx.property.updateMany({ where: { id: propB }, data: { name: 'Hacked' } }));
    const deleted = await asTenant(orgA, (tx) => tx.property.deleteMany({ where: { id: propB } }));
    expect(updated.count).toBe(0);
    expect(deleted.count).toBe(0);
    expect((await owner.property.findUniqueOrThrow({ where: { id: propB } })).name).toBe('B Hotel');
  });

  it('organization A cannot see or change organization B rooms', async () => {
    const seen = await asTenant(orgA, (tx) => tx.room.findMany({ where: { id: { in: [roomA, roomB] } }, select: { id: true } }));
    expect(seen.map((r) => r.id)).toEqual([roomA]);
    const changed = await asTenant(orgA, (tx) => tx.room.updateMany({ where: { id: roomB }, data: { status: 'DIRTY' } }));
    expect(changed.count).toBe(0);
  });

  it('two live rooms cannot share a number at one property, but an archived number can be reused', async () => {
    const type = await owner.roomType.findFirstOrThrow({ where: { propertyId: propA } });
    await expect(owner.room.create({ data: { organizationId: orgA, propertyId: propA, roomTypeId: type.id, number: '101' } })).rejects.toThrow();
    await owner.room.update({ where: { id: roomA }, data: { deletedAt: new Date() } });
    const reused = await owner.room.create({ data: { organizationId: orgA, propertyId: propA, roomTypeId: type.id, number: '101' } });
    expect(reused.id).not.toBe(roomA);
  });

  it('the audit log is append-only for the application role', async () => {
    await expect(asTenant(orgA, (tx) => tx.auditLog.updateMany({ data: { action: 'tampered' } }))).rejects.toThrow();
    await expect(asTenant(orgA, (tx) => tx.auditLog.deleteMany({}))).rejects.toThrow();
    const insert = await asTenant(orgA, (tx) => tx.auditLog.create({ data: { organizationId: orgA, action: 'test.insert', entity: 'test' }, select: { id: true } }));
    expect(insert.id).toBeTruthy();
  });

  it('the bypass flag (used only for login/register) sees both tenants', async () => {
    const rows = await app.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
      return tx.property.findMany({ where: { id: { in: [propA, propB] } }, select: { id: true } });
    });
    expect(rows).toHaveLength(2);
  });
});
