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
  const orgs = { organizationId: { in: [orgA, orgB] } };
  await owner.expense.deleteMany({ where: orgs });
  await owner.supplierInvoice.deleteMany({ where: orgs });
  await owner.stockMovement.deleteMany({ where: orgs });
  await owner.purchaseOrderLine.deleteMany({ where: orgs });
  await owner.purchaseOrder.deleteMany({ where: orgs });
  await owner.inventoryItem.deleteMany({ where: orgs });
  await owner.supplier.deleteMany({ where: orgs });
  await owner.housekeepingTask.deleteMany({ where: orgs });
  await owner.maintenanceTicket.deleteMany({ where: orgs });
  await owner.refund.deleteMany({ where: orgs });
  await owner.payment.deleteMany({ where: orgs });
  await owner.folioItem.deleteMany({ where: orgs });
  await owner.folio.deleteMany({ where: orgs });
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

  describe('money ledger', () => {
    let folioId = '';
    let itemId = '';
    let paymentId = '';
    let resId = '';

    beforeAll(async () => {
      resId = (await owner.reservation.create({ data: stay(orgA, propA, guestA, typeA, null, 'RF1', '2028-01-01', '2028-01-03') })).id;
      folioId = (await owner.folio.create({ data: { organizationId: orgA, propertyId: propA, reservationId: resId, currency: 'PHP' } })).id;
      itemId = (await owner.folioItem.create({ data: { organizationId: orgA, folioId, type: 'ROOM_CHARGE', description: 'Room', quantity: 1, unitAmountMinor: 100000, amountMinor: 100000 } })).id;
      paymentId = (await owner.payment.create({ data: { organizationId: orgA, folioId, amountMinor: 50000, method: 'CASH' } })).id;
    });

    it('is isolated per organization', async () => {
      expect(await asTenant(orgB, (tx) => tx.folio.count({ where: { id: folioId } }))).toBe(0);
      expect(await asTenant(orgB, (tx) => tx.payment.count({ where: { id: paymentId } }))).toBe(0);
      expect(await asTenant(orgA, (tx) => tx.folioItem.count({ where: { id: itemId } }))).toBe(1);
    });

    it('the application can ADD ledger lines but can never change or delete them', async () => {
      await expect(asTenant(orgA, (tx) => tx.folioItem.updateMany({ where: { id: itemId }, data: { amountMinor: 1, unitAmountMinor: 1 } }))).rejects.toThrow();
      await expect(asTenant(orgA, (tx) => tx.folioItem.deleteMany({ where: { id: itemId } }))).rejects.toThrow();
      await expect(asTenant(orgA, (tx) => tx.payment.updateMany({ where: { id: paymentId }, data: { amountMinor: 1 } }))).rejects.toThrow();
      await expect(asTenant(orgA, (tx) => tx.payment.deleteMany({ where: { id: paymentId } }))).rejects.toThrow();
      const added = await asTenant(orgA, (tx) => tx.folioItem.create({ data: { organizationId: orgA, folioId, type: 'EXTRA_CHARGE', description: 'Laundry', quantity: 2, unitAmountMinor: 500, amountMinor: 1000 }, select: { id: true } }));
      expect(added.id).toBeTruthy();
    });

    it('refunds are append-only too, and a folio can never be deleted', async () => {
      const refund = await asTenant(orgA, (tx) => tx.refund.create({ data: { organizationId: orgA, paymentId, amountMinor: 1000, reason: 'test' }, select: { id: true } }));
      await expect(asTenant(orgA, (tx) => tx.refund.updateMany({ where: { id: refund.id }, data: { amountMinor: 1 } }))).rejects.toThrow();
      await expect(asTenant(orgA, (tx) => tx.refund.deleteMany({ where: { id: refund.id } }))).rejects.toThrow();
      await expect(asTenant(orgA, (tx) => tx.folio.deleteMany({ where: { id: folioId } }))).rejects.toThrow();
    });

    it('a line must equal quantity x unit price', async () => {
      await expect(owner.folioItem.create({ data: { organizationId: orgA, folioId, type: 'EXTRA_CHARGE', description: 'Bad maths', quantity: 3, unitAmountMinor: 100, amountMinor: 999 } })).rejects.toThrow();
    });

    it('payments and refunds must be above zero', async () => {
      await expect(owner.payment.create({ data: { organizationId: orgA, folioId, amountMinor: 0, method: 'CASH' } })).rejects.toThrow();
      await expect(owner.payment.create({ data: { organizationId: orgA, folioId, amountMinor: -500, method: 'CASH' } })).rejects.toThrow();
      await expect(owner.refund.create({ data: { organizationId: orgA, paymentId, amountMinor: 0, reason: 'zero' } })).rejects.toThrow();
    });

    it('a line can be reversed only once', async () => {
      const target = await owner.folioItem.create({ data: { organizationId: orgA, folioId, type: 'EXTRA_CHARGE', description: 'Spa', quantity: 1, unitAmountMinor: 800, amountMinor: 800 } });
      const reverse = () => owner.folioItem.create({ data: { organizationId: orgA, folioId, type: 'REVERSAL', description: 'VOID: Spa', quantity: 1, unitAmountMinor: -800, amountMinor: -800, reversesItemId: target.id } });
      await expect(reverse()).resolves.toBeTruthy();
      await expect(reverse()).rejects.toThrow();
    });

    it('one folio per reservation', async () => {
      await expect(owner.folio.create({ data: { organizationId: orgA, propertyId: propA, reservationId: resId, currency: 'PHP' } })).rejects.toThrow();
    });

    it('an idempotency key can be used only once per organization', async () => {
      const key = `idem-${suffix}`;
      await owner.payment.create({ data: { organizationId: orgA, folioId, amountMinor: 100, method: 'CASH', idempotencyKey: key } });
      await expect(owner.payment.create({ data: { organizationId: orgA, folioId, amountMinor: 100, method: 'CASH', idempotencyKey: key } })).rejects.toThrow();
    });
  });

  describe('operations (housekeeping and maintenance)', () => {
    let taskId = '';

    beforeAll(async () => {
      taskId = (await owner.housekeepingTask.create({ data: { organizationId: orgA, propertyId: propA, roomId: roomA, type: 'CHECKOUT_CLEAN' } })).id;
    });

    it('is isolated per organization', async () => {
      expect(await asTenant(orgB, (tx) => tx.housekeepingTask.count({ where: { id: taskId } }))).toBe(0);
      expect(await asTenant(orgA, (tx) => tx.housekeepingTask.count({ where: { id: taskId } }))).toBe(1);
      const sneaky = asTenant(orgB, (tx) => tx.maintenanceTicket.create({ data: { organizationId: orgA, propertyId: propA, title: 'x', category: 'OTHER' } }));
      await expect(sneaky).rejects.toThrow();
    });

    it('only one open cleaning task of a kind can exist per room', async () => {
      await expect(owner.housekeepingTask.create({ data: { organizationId: orgA, propertyId: propA, roomId: roomA, type: 'CHECKOUT_CLEAN' } })).rejects.toThrow();
      // a different kind is fine, and once the first is done a new one is allowed
      await expect(owner.housekeepingTask.create({ data: { organizationId: orgA, propertyId: propA, roomId: roomA, type: 'DEEP_CLEAN' } })).resolves.toBeTruthy();
      await owner.housekeepingTask.update({ where: { id: taskId }, data: { status: 'DONE' } });
      await expect(owner.housekeepingTask.create({ data: { organizationId: orgA, propertyId: propA, roomId: roomA, type: 'CHECKOUT_CLEAN' } })).resolves.toBeTruthy();
    });

    it('createMany with skipDuplicates (used by check-out automation) never fails on a duplicate', async () => {
      const again = await owner.housekeepingTask.createMany({ data: [{ organizationId: orgA, propertyId: propA, roomId: roomA, type: 'CHECKOUT_CLEAN' }], skipDuplicates: true });
      expect(again.count).toBe(0);
    });

    it('maintenance cost and time can never be negative; estimated minutes must be positive', async () => {
      await expect(owner.maintenanceTicket.create({ data: { organizationId: orgA, propertyId: propA, title: 'neg', category: 'OTHER', costMinor: -1 } })).rejects.toThrow();
      await expect(owner.maintenanceTicket.create({ data: { organizationId: orgA, propertyId: propA, title: 'neg', category: 'OTHER', minutesSpent: -5 } })).rejects.toThrow();
      await expect(owner.housekeepingTask.create({ data: { organizationId: orgA, propertyId: propA, roomId: roomB, type: 'STAYOVER', estimatedMinutes: 0 } })).rejects.toThrow();
    });

    it('tasks and tickets can never be deleted by the application role', async () => {
      await expect(asTenant(orgA, (tx) => tx.housekeepingTask.deleteMany({ where: { id: taskId } }))).rejects.toThrow();
    });
  });

  describe('inventory, purchasing and expenses', () => {
    let supplierId = '';
    let itemId = '';
    let movementId = '';
    let orderId = '';

    beforeAll(async () => {
      supplierId = (await owner.supplier.create({ data: { organizationId: orgA, name: `Sup ${suffix}` } })).id;
      itemId = (await owner.inventoryItem.create({ data: { organizationId: orgA, sku: `SKU-${suffix}`, name: 'Towel', category: 'LINENS', unit: 'pcs', minStock: 5, maxStock: 20 } })).id;
      movementId = (await owner.stockMovement.create({ data: { organizationId: orgA, propertyId: propA, itemId, type: 'OPENING', quantity: 10 } })).id;
      orderId = (await owner.purchaseOrder.create({ data: { organizationId: orgA, propertyId: propA, code: `PO-T${suffix}`, supplierId, currency: 'PHP', totalMinor: 1000, lines: { create: [{ organizationId: orgA, itemId, quantity: 4, unitCostMinor: 250 }] } } })).id;
    });

    it('is isolated per organization', async () => {
      expect(await asTenant(orgB, (tx) => tx.stockMovement.count({ where: { id: movementId } }))).toBe(0);
      expect(await asTenant(orgB, (tx) => tx.purchaseOrder.count({ where: { id: orderId } }))).toBe(0);
      expect(await asTenant(orgB, (tx) => tx.supplier.count({ where: { id: supplierId } }))).toBe(0);
      expect(await asTenant(orgA, (tx) => tx.purchaseOrder.count({ where: { id: orderId } }))).toBe(1);
    });

    it('the stock ledger is append-only for the application role', async () => {
      await expect(asTenant(orgA, (tx) => tx.stockMovement.updateMany({ where: { id: movementId }, data: { quantity: 999 } }))).rejects.toThrow();
      await expect(asTenant(orgA, (tx) => tx.stockMovement.deleteMany({ where: { id: movementId } }))).rejects.toThrow();
      const added = await asTenant(orgA, (tx) => tx.stockMovement.create({ data: { organizationId: orgA, propertyId: propA, itemId, type: 'USAGE', quantity: -2 }, select: { id: true } }));
      expect(added.id).toBeTruthy();
    });

    it('a stock movement of zero is refused, and on-hand is the sum of movements', async () => {
      await expect(owner.stockMovement.create({ data: { organizationId: orgA, propertyId: propA, itemId, type: 'ADJUSTMENT', quantity: 0 } })).rejects.toThrow();
      const sum = await owner.stockMovement.aggregate({ where: { propertyId: propA, itemId }, _sum: { quantity: true } });
      expect(sum._sum.quantity).toBe(8);
    });

    it('a purchase line can never receive more than was ordered, and quantities must be positive', async () => {
      const line = await owner.purchaseOrderLine.findFirstOrThrow({ where: { purchaseOrderId: orderId } });
      await expect(owner.purchaseOrderLine.update({ where: { id: line.id }, data: { receivedQuantity: 5 } })).rejects.toThrow();
      await expect(owner.purchaseOrderLine.update({ where: { id: line.id }, data: { receivedQuantity: 4 } })).resolves.toBeTruthy();
    });

    it('one invoice per purchase order, with a sensible amount and due date', async () => {
      const make = (over: object = {}) => owner.supplierInvoice.create({ data: { organizationId: orgA, propertyId: propA, purchaseOrderId: orderId, supplierId, number: 'INV-1', amountMinor: 1000, receivedValueMinor: 1000, issuedOn: new Date('2026-11-01'), dueOn: new Date('2026-11-15'), ...over } });
      await expect(make({ amountMinor: 0 })).rejects.toThrow();
      await expect(make({ dueOn: new Date('2026-10-01') })).rejects.toThrow();
      const first = await make();
      await expect(make()).rejects.toThrow();
      // paying twice would need two expenses for one invoice: refused by the unique link
      await owner.expense.create({ data: { organizationId: orgA, propertyId: propA, category: 'INVENTORY', incurredOn: new Date('2026-11-02'), amountMinor: 1000, paymentMethod: 'CASH', source: 'PURCHASING', supplierInvoiceId: first.id } });
      await expect(owner.expense.create({ data: { organizationId: orgA, propertyId: propA, category: 'INVENTORY', incurredOn: new Date('2026-11-02'), amountMinor: 1000, paymentMethod: 'CASH', source: 'PURCHASING', supplierInvoiceId: first.id } })).rejects.toThrow();
    });

    it('an expense must be above zero, and the application role can never delete one', async () => {
      await expect(owner.expense.create({ data: { organizationId: orgA, propertyId: propA, category: 'RENT', incurredOn: new Date('2026-11-02'), amountMinor: 0, paymentMethod: 'CASH' } })).rejects.toThrow();
      const e = await owner.expense.create({ data: { organizationId: orgA, propertyId: propA, category: 'RENT', incurredOn: new Date('2026-11-02'), amountMinor: 500, paymentMethod: 'CASH' } });
      await expect(asTenant(orgA, (tx) => tx.expense.deleteMany({ where: { id: e.id } }))).rejects.toThrow();
    });

    it('item codes and supplier names are unique among live records, regardless of capitals', async () => {
      await expect(owner.inventoryItem.create({ data: { organizationId: orgA, sku: `sku-${suffix}`, name: 'Dup', category: 'FOOD', unit: 'kg' } })).rejects.toThrow();
      await expect(owner.supplier.create({ data: { organizationId: orgA, name: `SUP ${suffix}` } })).rejects.toThrow();
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
