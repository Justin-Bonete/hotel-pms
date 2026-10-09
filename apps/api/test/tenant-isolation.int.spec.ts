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
let typeA = '';
let guestA = '';
let guestB = '';
let resB = '';

const stay = (organizationId: string, propertyId: string, guestId: string, roomTypeId: string, roomId: string | null, code: string, arrival: string, departure: string, status: 'CONFIRMED' | 'CHECKED_IN' | 'CANCELLED' | 'CHECKED_OUT' = 'CONFIRMED') => ({
  organizationId, propertyId, guestId, roomTypeId, roomId, code, status, nights: 2, totalMinor: 100000, currency: 'PHP',
  arrivalDate: new Date(`${arrival}T00:00:00.000Z`), departureDate: new Date(`${departure}T00:00:00.000Z`),
});

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
  const typeAFull = await owner.roomType.create({ data: { organizationId: orgA, propertyId: propA, name: 'Std' } });
  const typeB = await owner.roomType.create({ data: { organizationId: orgB, propertyId: propB, name: 'Std' } });
  typeA = typeAFull.id;
  roomA = (await owner.room.create({ data: { organizationId: orgA, propertyId: propA, roomTypeId: typeA, number: '101' } })).id;
  roomB = (await owner.room.create({ data: { organizationId: orgB, propertyId: propB, roomTypeId: typeB.id, number: '101' } })).id;
  guestA = (await owner.guest.create({ data: { organizationId: orgA, firstName: 'Ann', lastName: 'A', email: `ann-${suffix}@example.com` } })).id;
  guestB = (await owner.guest.create({ data: { organizationId: orgB, firstName: 'Bob', lastName: 'B' } })).id;
  resB = (await owner.reservation.create({ data: { ...stay(orgB, propB, guestB, typeB.id, roomB, 'RB1', '2026-11-01', '2026-11-03') } })).id;
});

afterAll(async () => {
  await owner.auditLog.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
  await owner.reservation.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
  await owner.guest.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
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

  it('organization A cannot see or change organization B reservations or guests', async () => {
    const seen = await asTenant(orgA, (tx) => tx.reservation.findMany({ where: { id: resB }, select: { id: true } }));
    expect(seen).toHaveLength(0);
    const guests = await asTenant(orgA, (tx) => tx.guest.findMany({ where: { id: { in: [guestA, guestB] } }, select: { id: true } }));
    expect(guests.map((g) => g.id)).toEqual([guestA]);
    const changed = await asTenant(orgA, (tx) => tx.reservation.updateMany({ where: { id: resB }, data: { status: 'CANCELLED' } }));
    expect(changed.count).toBe(0);
  });

  describe('double-booking is refused by the database itself', () => {
    const book = (code: string, arrival: string, departure: string, status: 'CONFIRMED' | 'CHECKED_IN' | 'CANCELLED' | 'CHECKED_OUT' = 'CONFIRMED') =>
      owner.reservation.create({ data: stay(orgA, propA, guestA, typeA, roomA, code, arrival, departure, status) });

    it('two active stays on the same room cannot overlap', async () => {
      await book('RA1', '2026-12-01', '2026-12-05');
      await expect(book('RA2', '2026-12-03', '2026-12-07')).rejects.toThrow();
      await expect(book('RA3', '2026-12-01', '2026-12-02', 'CHECKED_IN')).rejects.toThrow();
    });

    it('same-day turnover is allowed (departure day = next arrival day)', async () => {
      await expect(book('RA4', '2026-12-05', '2026-12-08')).resolves.toBeTruthy();
    });

    it('cancelled and checked-out stays do not block the room', async () => {
      await expect(book('RA5', '2026-12-01', '2026-12-05', 'CANCELLED')).resolves.toBeTruthy();
      await expect(book('RA6', '2026-12-02', '2026-12-04', 'CHECKED_OUT')).resolves.toBeTruthy();
    });

    it('rejects a stay whose departure is not after arrival', async () => {
      await expect(book('RA7', '2027-01-05', '2027-01-05')).rejects.toThrow();
    });
  });

  it('two live guests cannot share an email, regardless of capitals', async () => {
    await expect(owner.guest.create({ data: { organizationId: orgA, firstName: 'Dup', lastName: 'Ann', email: `ANN-${suffix}@EXAMPLE.com` } })).rejects.toThrow();
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
