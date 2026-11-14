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
import { Prisma, PrismaClient, PropertyType, ReservationSource, ReservationStatus, RoomStatus, ScopeType, UserStatus } from '@prisma/client';
import { PERMISSION_CATALOG, SYSTEM_ROLE_TEMPLATES, addDays, calcTaxMinor, eachNight, formatRate, nightlyRatesFrom, nightsBetween, parseDate, quoteStay, toDateString, todayIn, posLineTotals } from '@pms/types';
import { randomUUID } from 'node:crypto';
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
  { status: 'CLEANING' }, { status: 'CLEAN' }, { status: 'INSPECTED' }, { status: 'AVAILABLE' },
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

// ---------------------------------------------------------------- demo guests, rates, reservations
const DEMO_GUESTS: Array<{ firstName: string; lastName: string; email: string; phone: string; country: string; isVip?: boolean }> = [
  { firstName: 'Juan', lastName: 'Dela Cruz', email: 'juan.delacruz@example.com', phone: '+63 917 100 0001', country: 'PH' },
  { firstName: 'Maria', lastName: 'Santos', email: 'maria.santos@example.com', phone: '+63 917 100 0002', country: 'PH', isVip: true },
  { firstName: 'Jose', lastName: 'Reyes', email: 'jose.reyes@example.com', phone: '+63 917 100 0003', country: 'PH' },
  { firstName: 'Ana', lastName: 'Garcia', email: 'ana.garcia@example.com', phone: '+63 917 100 0004', country: 'PH' },
  { firstName: 'Carlos', lastName: 'Mendoza', email: 'carlos.mendoza@example.com', phone: '+63 917 100 0005', country: 'PH' },
  { firstName: 'Sofia', lastName: 'Ramos', email: 'sofia.ramos@example.com', phone: '+63 917 100 0006', country: 'PH' },
  { firstName: 'Miguel', lastName: 'Torres', email: 'miguel.torres@example.com', phone: '+63 917 100 0007', country: 'PH' },
  { firstName: 'Isabella', lastName: 'Cruz', email: 'isabella.cruz@example.com', phone: '+63 917 100 0008', country: 'PH', isVip: true },
  { firstName: 'Daniel', lastName: 'Lee', email: 'daniel.lee@example.com', phone: '+82 10 5555 0009', country: 'KR' },
  { firstName: 'Emma', lastName: 'Wilson', email: 'emma.wilson@example.com', phone: '+1 415 555 0010', country: 'US' },
  { firstName: 'Kenji', lastName: 'Tanaka', email: 'kenji.tanaka@example.com', phone: '+81 90 5555 0011', country: 'JP' },
  { firstName: 'Liam', lastName: 'Brown', email: 'liam.brown@example.com', phone: '+61 400 555 012', country: 'AU' },
];

// Nightly / weekend rates in PESOS per room type (stored as centavos).
const DEMO_RATES: Record<string, Record<string, [number, number]>> = {
  'manila-grand': { Standard: [3500, 4000], Deluxe: [4500, 5200], Suite: [7500, 8500] },
  'baguio-lodge': { Standard: [2800, 3200], 'Family Room': [4800, 5400] },
  'la-union-resort': { Villa: [6500, 7200], 'Garden Suite': [5200, 5800] },
};

/** [status, offset of arrival from today, nights, roomType, assign room?, adults, children, source] */
type DemoStay = [ReservationStatus, number, number, string, boolean, number, number, ReservationSource];
const demoStays = (types: string[]): DemoStay[] => {
  const [a, b, c = a] = types as [string, string, string?];
  return [
    ['CHECKED_IN', -2, 3, a, true, 2, 0, 'WALK_IN'],
    ['CHECKED_IN', -1, 2, b, true, 2, 1, 'PHONE'],
    ['CHECKED_IN', -3, 3, a, true, 1, 0, 'WEBSITE'],
    ['CONFIRMED', 0, 2, a, true, 2, 0, 'PHONE'],
    ['CONFIRMED', 0, 3, c, false, 3, 0, 'OTA'],
    ['CONFIRMED', 1, 2, b, false, 2, 0, 'WEBSITE'],
    ['CONFIRMED', 2, 4, a, true, 2, 1, 'CORPORATE'],
    ['CONFIRMED', 5, 3, c, false, 2, 0, 'TRAVEL_AGENT'],
    ['PENDING', 3, 2, b, false, 2, 0, 'PHONE'],
    ['INQUIRY', 9, 2, a, false, 2, 0, 'WEBSITE'],
    ['CHECKED_OUT', -9, 2, a, true, 2, 0, 'WALK_IN'],
    ['CHECKED_OUT', -7, 3, b, true, 2, 0, 'OTA'],
    ['CHECKED_OUT', -5, 2, a, true, 1, 0, 'PHONE'],
    ['CANCELLED', 4, 2, a, false, 2, 0, 'WEBSITE'],
  ];
};

/** Seeds rate plan, guests and reservations ONLY for a property that has none. Needs its rooms to exist. */
async function seedReservations(organizationId: string, propertyId: string, slug: string, currency: string, timezone: string) {
  const rates = DEMO_RATES[slug];
  if (!rates) return;
  if ((await prisma.reservation.count({ where: { propertyId } })) > 0) return;

  const types = await prisma.roomType.findMany({ where: { propertyId, deletedAt: null }, orderBy: { name: 'asc' } });
  const typeByName = new Map(types.map((t) => [t.name, t]));

  const plan =
    (await prisma.ratePlan.findFirst({ where: { propertyId, deletedAt: null, isDefault: true } })) ??
    (await prisma.ratePlan.create({
      data: {
        organizationId, propertyId, name: 'Standard rate', description: 'Public rate, higher on Friday and Saturday nights', isDefault: true,
        rates: { create: Object.entries(rates).map(([name, [nightly, weekend]]) => ({ organizationId, roomTypeId: typeByName.get(name)!.id, nightlyRateMinor: nightly * 100, weekendRateMinor: weekend * 100 })) },
      },
    }));
  const rateRows = await prisma.ratePlanRate.findMany({ where: { ratePlanId: plan.id } });

  const guests: string[] = [];
  for (const g of DEMO_GUESTS) {
    const existing = await prisma.guest.findFirst({ where: { organizationId, email: g.email } });
    guests.push((existing ?? (await prisma.guest.create({ data: { organizationId, ...g } }))).id);
  }

  const today = todayIn(timezone);
  const rooms = await prisma.room.findMany({ where: { propertyId, deletedAt: null, status: { in: ['AVAILABLE', 'INSPECTED'] } }, orderBy: { number: 'asc' } });
  const roomsByType = new Map<string, typeof rooms>();
  for (const r of rooms) roomsByType.set(r.roomTypeId, [...(roomsByType.get(r.roomTypeId) ?? []), r]);

  const typeNames = types.map((t) => t.name);
  let n = 0;
  for (const [status, offset, nights, typeName, assign, adults, children, source] of demoStays(typeNames)) {
    const type = typeByName.get(typeName)!;
    const rate = rateRows.find((r) => r.roomTypeId === type.id);
    if (!rate) continue;
    const arrival = addDays(today, offset);
    const departure = addDays(arrival, nights);
    const quote = quoteStay(arrival, departure, { nightlyRateMinor: rate.nightlyRateMinor, weekendRateMinor: rate.weekendRateMinor });

    let roomId: string | null = null;
    if (assign) {
      const free = (roomsByType.get(type.id) ?? []).shift();
      roomId = free?.id ?? null;
    }
    if (status === 'CHECKED_IN' && !roomId) continue; // an in-house guest must have a room
    n++;
    await prisma.reservation.create({
      data: {
        organizationId, propertyId, code: `D${slug.slice(0, 2).toUpperCase()}${String(n).padStart(4, '0')}`,
        guestId: guests[(n * 5) % guests.length]!, roomTypeId: type.id, roomId, ratePlanId: plan.id, status, source,
        arrivalDate: new Date(`${arrival}T00:00:00.000Z`), departureDate: new Date(`${departure}T00:00:00.000Z`),
        adults: Math.min(adults, type.maxOccupancy), children, nights: nightsBetween(arrival, departure), totalMinor: quote.totalMinor, currency,
        checkedInAt: status === 'CHECKED_IN' || status === 'CHECKED_OUT' ? new Date(`${arrival}T06:00:00.000Z`) : null,
        checkedOutAt: status === 'CHECKED_OUT' ? new Date(`${departure}T03:00:00.000Z`) : null,
        cancelledAt: status === 'CANCELLED' ? new Date() : null, cancelReason: status === 'CANCELLED' ? 'Guest changed plans' : null,
      },
    });
  }
}

// ---------------------------------------------------------------- demo taxes, folios, deposits
const DEMO_TAXES: Record<string, Array<{ name: string; rateBps: number; room: boolean; extras: boolean }>> = {
  'manila-grand': [{ name: 'VAT', rateBps: 1200, room: true, extras: true }, { name: 'Service charge', rateBps: 1000, room: true, extras: false }],
  'baguio-lodge': [{ name: 'VAT', rateBps: 1200, room: true, extras: true }],
  'la-union-resort': [{ name: 'VAT', rateBps: 1200, room: true, extras: true }, { name: 'Service charge', rateBps: 1000, room: true, extras: true }],
};

async function seedTaxes(organizationId: string, propertyId: string, slug: string) {
  for (const t of DEMO_TAXES[slug] ?? []) {
    const existing = await prisma.tax.findFirst({ where: { propertyId, name: t.name, deletedAt: null } });
    if (!existing) await prisma.tax.create({ data: { organizationId, propertyId, name: t.name, rateBps: t.rateBps, appliesToRoom: t.room, appliesToExtras: t.extras } });
  }
}

/** In-house and past stays get a folio with room charges + taxes; past stays are paid in full and closed. */
async function seedFolios(organizationId: string, propertyId: string, currency: string) {
  const taxes = await prisma.tax.findMany({ where: { propertyId, isActive: true, deletedAt: null } });
  const stays = await prisma.reservation.findMany({
    where: { propertyId, status: { in: ['CHECKED_IN', 'CHECKED_OUT'] }, folio: null },
    include: { room: true, roomType: true },
    orderBy: { arrivalDate: 'asc' },
  });
  let firstInHouse = true;
  for (const r of stays) {
    const closed = r.status === 'CHECKED_OUT';
    const folio = await prisma.folio.create({
      data: { organizationId, propertyId, reservationId: r.id, currency, status: closed ? 'CLOSED' : 'OPEN', roomChargesPostedAt: r.checkedInAt ?? new Date(), closedAt: closed ? r.checkedOutAt : null },
    });
    const nights = eachNight(toDateString(r.arrivalDate), toDateString(r.departureDate));
    const rates = nightlyRatesFrom(r.nightlyRates, nights.length, r.totalMinor);
    const rows: Prisma.FolioItemCreateManyInput[] = [];
    let total = 0;
    const push = (row: Prisma.FolioItemCreateManyInput) => { rows.push(row); total += row.amountMinor; };

    nights.forEach((night, i) => {
      const amount = rates[i] ?? 0;
      const id = randomUUID();
      push({ id, organizationId, folioId: folio.id, type: 'ROOM_CHARGE', description: `Room ${r.room?.number ?? ''} · ${r.roomType.name}`, serviceDate: parseDate(night), quantity: 1, unitAmountMinor: amount, amountMinor: amount, source: 'SYSTEM' });
      for (const t of taxes.filter((x) => x.appliesToRoom)) {
        const tax = calcTaxMinor(amount, t.rateBps);
        if (tax > 0) push({ id: randomUUID(), organizationId, folioId: folio.id, type: 'TAX', description: `${t.name} (${formatRate(t.rateBps)})`, serviceDate: parseDate(night), quantity: 1, unitAmountMinor: tax, amountMinor: tax, parentItemId: id, taxId: t.id, source: 'SYSTEM' });
      }
    });

    if (!closed && firstInHouse) {
      firstInHouse = false;
      const id = randomUUID();
      push({ id, organizationId, folioId: folio.id, type: 'EXTRA_CHARGE', description: 'Minibar', quantity: 1, unitAmountMinor: 45000, amountMinor: 45000, source: 'FRONT_DESK' });
      for (const t of taxes.filter((x) => x.appliesToExtras)) {
        const tax = calcTaxMinor(45000, t.rateBps);
        if (tax > 0) push({ id: randomUUID(), organizationId, folioId: folio.id, type: 'TAX', description: `${t.name} (${formatRate(t.rateBps)})`, quantity: 1, unitAmountMinor: tax, amountMinor: tax, parentItemId: id, taxId: t.id, source: 'SYSTEM' });
      }
    }
    await prisma.folioItem.createMany({ data: rows });

    if (closed) {
      const deposit = Math.floor(total * 0.3);
      await prisma.payment.create({ data: { organizationId, folioId: folio.id, amountMinor: deposit, method: 'CASH', reference: 'Deposit' } });
      await prisma.payment.create({ data: { organizationId, folioId: folio.id, amountMinor: total - deposit, method: 'CARD', reference: 'Settlement at check-out' } });
    } else {
      await prisma.payment.create({ data: { organizationId, folioId: folio.id, amountMinor: Math.floor(total / 2), method: 'CARD', reference: 'Deposit at check-in' } });
    }
  }
}

/** Every other upcoming confirmed booking has paid a one-night deposit. */
async function seedDeposits(organizationId: string, propertyId: string, currency: string) {
  const upcoming = await prisma.reservation.findMany({ where: { propertyId, status: 'CONFIRMED', folio: null }, orderBy: { arrivalDate: 'asc' } });
  for (const [i, r] of upcoming.entries()) {
    if (i % 2 !== 0) continue;
    const firstNight = nightlyRatesFrom(r.nightlyRates, r.nights, r.totalMinor)[0] ?? 0;
    if (firstNight <= 0) continue;
    const folio = await prisma.folio.create({ data: { organizationId, propertyId, reservationId: r.id, currency } });
    await prisma.payment.create({ data: { organizationId, folioId: folio.id, amountMinor: firstNight, method: 'BANK_TRANSFER', reference: 'Booking deposit' } });
  }
}

// ---------------------------------------------------------------- demo staff, housekeeping tasks, maintenance tickets
const DEMO_STAFF: Array<{ key: string; first: string; last: string; role: string; slugs: string[] }> = [
  { key: 'manager', first: 'Maya', last: 'Manager', role: 'PROPERTY_MANAGER', slugs: ['manila-grand'] },
  { key: 'frontdesk', first: 'Fiona', last: 'Front', role: 'FRONT_DESK', slugs: ['manila-grand'] },
  { key: 'supervisor', first: 'Sam', last: 'Supervisor', role: 'HOUSEKEEPING_SUPERVISOR', slugs: ['manila-grand', 'baguio-lodge'] },
  { key: 'housekeeper1', first: 'Hana', last: 'Cruz', role: 'HOUSEKEEPER', slugs: ['manila-grand'] },
  { key: 'housekeeper2', first: 'Hugo', last: 'Reyes', role: 'HOUSEKEEPER', slugs: ['manila-grand'] },
  { key: 'maintenance', first: 'Mario', last: 'Tech', role: 'MAINTENANCE', slugs: ['manila-grand'] },
];

/** Demo logins (same password as the owner): manager@, frontdesk@, supervisor@, housekeeper1@, housekeeper2@, maintenance@ abc-hospitality.test */
async function seedStaff(organizationId: string, propertyIds: Map<string, string>, password: string): Promise<Map<string, string>> {
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const ids = new Map<string, string>();
  for (const d of DEMO_STAFF) {
    const email = `${d.key}@abc-hospitality.test`;
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { organizationId, email, passwordHash, firstName: d.first, lastName: d.last, status: UserStatus.ACTIVE, emailVerifiedAt: new Date() },
    });
    ids.set(d.key, user.id);
    const role = await prisma.role.findFirstOrThrow({ where: { organizationId: null, key: d.role } });
    for (const slug of d.slugs) {
      const scopeId = propertyIds.get(slug);
      if (!scopeId) continue;
      const exists = await prisma.userRoleAssignment.findFirst({ where: { userId: user.id, roleId: role.id, scopeType: ScopeType.PROPERTY, scopeId } });
      if (!exists) await prisma.userRoleAssignment.create({ data: { organizationId, userId: user.id, roleId: role.id, scopeType: ScopeType.PROPERTY, scopeId } });
    }
  }
  return ids;
}

/** Tasks for rooms that need cleaning and tickets for rooms that are broken. Only for properties that have none yet. */
async function seedOperations(organizationId: string, propertyId: string, slug: string, staff: Map<string, string>) {
  const rooms = await prisma.room.findMany({ where: { propertyId, deletedAt: null }, orderBy: { number: 'asc' } });

  if ((await prisma.housekeepingTask.count({ where: { propertyId } })) === 0) {
    const cleaners = slug === 'manila-grand' ? [staff.get('housekeeper1'), staff.get('housekeeper2')].filter((x): x is string => Boolean(x)) : [];
    let i = 0;
    for (const r of rooms) {
      if (!['DIRTY', 'CLEANING', 'CLEAN'].includes(r.status)) continue;
      const assignee = cleaners.length ? (cleaners[i++ % cleaners.length] ?? null) : null;
      const status = r.status === 'DIRTY' ? (assignee ? 'ASSIGNED' : 'OPEN') : r.status === 'CLEANING' ? (assignee ? 'IN_PROGRESS' : 'OPEN') : 'CLEANED';
      await prisma.housekeepingTask.create({
        data: {
          organizationId, propertyId, roomId: r.id, type: 'CHECKOUT_CLEAN', status, priority: i % 4 === 0 ? 'HIGH' : 'NORMAL',
          assignedToId: status === 'OPEN' ? null : assignee, assignedAt: status === 'OPEN' || !assignee ? null : new Date(),
          startedAt: status === 'IN_PROGRESS' || status === 'CLEANED' ? new Date() : null, cleanedAt: status === 'CLEANED' ? new Date() : null,
          estimatedMinutes: 30, notes: 'Turnover clean',
        },
      });
    }
  }

  if ((await prisma.maintenanceTicket.count({ where: { propertyId } })) === 0) {
    const tech = slug === 'manila-grand' ? staff.get('maintenance') ?? null : null;
    for (const r of rooms) {
      if (!['MAINTENANCE', 'OUT_OF_ORDER'].includes(r.status)) continue;
      const inProgress = r.status === 'MAINTENANCE' && tech !== null;
      await prisma.maintenanceTicket.create({
        data: {
          organizationId, propertyId, roomId: r.id, title: r.statusNote ?? 'Room out of service', category: r.status === 'MAINTENANCE' ? 'AIRCON' : 'PLUMBING',
          priority: r.status === 'OUT_OF_ORDER' ? 'HIGH' : 'NORMAL', status: inProgress ? 'IN_PROGRESS' : 'REPORTED', blocksRoom: true,
          assignedToId: inProgress ? tech : null, assignedAt: inProgress ? new Date() : null, startedAt: inProgress ? new Date() : null,
        },
      });
    }
    if (slug === 'manila-grand') {
      await prisma.maintenanceTicket.createMany({
        data: [
          { organizationId, propertyId, title: 'Lobby Wi-Fi drops in the evening', category: 'INTERNET', priority: 'NORMAL', status: 'REPORTED', blocksRoom: false },
          { organizationId, propertyId, title: 'Wobbly chair in the restaurant', category: 'FURNITURE', priority: 'LOW', status: 'REPORTED', blocksRoom: false },
        ],
      });
    }
  }
}

// ---------------------------------------------------------------- demo suppliers, stock, purchasing, expenses
const DEMO_SUPPLIERS = [
  { name: 'Metro Linen Supply', contactName: 'Rica Villanueva', email: 'sales@metrolinen.example', phone: '+63 2 8555 0101' },
  { name: 'FreshMart Foods', contactName: 'Ben Aquino', email: 'orders@freshmart.example', phone: '+63 2 8555 0102' },
  { name: 'CleanPro Trading', contactName: 'Lea Domingo', email: 'hello@cleanpro.example', phone: '+63 2 8555 0103' },
];

// [sku, name, category, unit, min, max, unit cost in PESOS]
const DEMO_ITEMS: Array<[string, string, 'FOOD' | 'BEVERAGE' | 'HOUSEKEEPING_SUPPLIES' | 'TOILETRIES' | 'LINENS' | 'OFFICE_SUPPLIES' | 'MAINTENANCE_MATERIALS', string, number, number, number]> = [
  ['TWL-BATH', 'Bath towel', 'LINENS', 'pcs', 40, 120, 180],
  ['SHT-QN', 'Bed sheet (queen)', 'LINENS', 'pcs', 30, 90, 350],
  ['TOI-SHMP', 'Shampoo sachet', 'TOILETRIES', 'pcs', 200, 800, 6],
  ['TOI-SOAP', 'Soap bar', 'TOILETRIES', 'pcs', 200, 800, 8],
  ['HK-CLEAN', 'Floor cleaner', 'HOUSEKEEPING_SUPPLIES', 'L', 10, 40, 120],
  ['FD-RICE', 'Rice', 'FOOD', 'kg', 50, 200, 55],
  ['FD-CHKN', 'Chicken', 'FOOD', 'kg', 20, 60, 190],
  ['BV-COFFEE', 'Coffee beans', 'BEVERAGE', 'kg', 5, 20, 650],
  ['BV-WATER', 'Bottled water', 'BEVERAGE', 'pcs', 100, 400, 14],
  ['OF-PAPER', 'Printer paper', 'OFFICE_SUPPLIES', 'ream', 5, 20, 260],
  ['MT-BULB', 'LED bulb', 'MAINTENANCE_MATERIALS', 'pcs', 20, 80, 95],
  ['MT-PAINT', 'Wall paint', 'MAINTENANCE_MATERIALS', 'L', 5, 20, 420],
];

/** Suppliers, items, opening stock (some low, one out), a few purchase orders in different states, and expenses. */
async function seedBusiness(organizationId: string, propertyIds: Map<string, string>, staff: Map<string, string>, ownerId: string) {
  for (const s of DEMO_SUPPLIERS) {
    if (!(await prisma.supplier.findFirst({ where: { organizationId, name: s.name, deletedAt: null } }))) await prisma.supplier.create({ data: { organizationId, ...s } });
  }
  const suppliers = new Map((await prisma.supplier.findMany({ where: { organizationId, deletedAt: null } })).map((s) => [s.name, s.id] as [string, string]));

  for (const [sku, name, category, unit, minStock, maxStock, cost] of DEMO_ITEMS) {
    if (!(await prisma.inventoryItem.findFirst({ where: { organizationId, sku, deletedAt: null } }))) {
      await prisma.inventoryItem.create({ data: { organizationId, sku, name, category, unit, minStock, maxStock, unitCostMinor: cost * 100 } });
    }
  }
  type SeedItem = { id: string; minStock: number; maxStock: number; unitCostMinor: number };
  const itemRows: Array<SeedItem & { sku: string }> = await prisma.inventoryItem.findMany({ where: { organizationId, deletedAt: null } });
  const items = new Map<string, SeedItem>(itemRows.map((i) => [i.sku, i] as [string, SeedItem]));

  // Opening stock per property: a mix of healthy, low and out.
  let p = 0;
  for (const [, propertyId] of propertyIds) {
    p++;
    if ((await prisma.stockMovement.count({ where: { propertyId } })) > 0) continue;
    let i = 0;
    for (const item of items.values()) {
      i++;
      const pattern = (i + p) % 5; // 0 = out, 1 = low, others healthy
      const qty = pattern === 0 ? 0 : pattern === 1 ? Math.max(Math.floor(item.minStock / 2), 1) : Math.floor((item.minStock + (item.maxStock || item.minStock * 2)) / 2);
      if (qty > 0) await prisma.stockMovement.create({ data: { organizationId, propertyId, itemId: item.id, type: 'OPENING', quantity: qty, note: 'Opening count', createdById: ownerId } });
    }
  }

  const manila = propertyIds.get('manila-grand');
  if (!manila) return;
  const today = todayIn('Asia/Manila');
  const requester = staff.get('manager') ?? ownerId;

  if ((await prisma.purchaseOrder.count({ where: { propertyId: manila } })) === 0) {
    const order = async (code: string, supplier: string, status: 'REQUESTED' | 'APPROVED' | 'PARTIALLY_RECEIVED' | 'RECEIVED', lines: Array<[string, number, number, number]>, daysAgo: number) => {
      const total = lines.reduce((sum, [, q, c]) => sum + q * c, 0);
      const approved = status !== 'REQUESTED';
      return prisma.purchaseOrder.create({
        data: {
          organizationId, propertyId: manila, code, supplierId: suppliers.get(supplier)!, status, currency: 'PHP', totalMinor: total, requestedById: requester,
          requestedAt: new Date(`${addDays(today, -daysAgo)}T02:00:00.000Z`), approvedById: approved ? ownerId : null, decidedAt: approved ? new Date() : null,
          lines: { create: lines.map(([sku, quantity, unitCostMinor, receivedQuantity]) => ({ organizationId, itemId: items.get(sku)!.id, quantity, unitCostMinor, receivedQuantity })) },
        },
        include: { lines: true },
      });
    };
    const receive = async (po: { id: string; lines: Array<{ itemId: string; unitCostMinor: number; receivedQuantity: number }> }, code: string) => {
      for (const l of po.lines) if (l.receivedQuantity > 0) await prisma.stockMovement.create({ data: { organizationId, propertyId: manila, itemId: l.itemId, type: 'PURCHASE_RECEIPT', quantity: l.receivedQuantity, unitCostMinor: l.unitCostMinor, purchaseOrderId: po.id, note: `Received on ${code}`, createdById: ownerId } });
    };

    await order('PO-DEMO01', 'Metro Linen Supply', 'REQUESTED', [['TWL-BATH', 60, 18000, 0], ['SHT-QN', 40, 35000, 0]], 1);
    const po2 = await order('PO-DEMO02', 'FreshMart Foods', 'PARTIALLY_RECEIVED', [['FD-RICE', 100, 5500, 60]], 3);
    await receive(po2, 'PO-DEMO02');
    const po3 = await order('PO-DEMO03', 'FreshMart Foods', 'RECEIVED', [['FD-CHKN', 40, 19000, 40]], 20);
    await receive(po3, 'PO-DEMO03');
    await prisma.supplierInvoice.create({ data: { organizationId, propertyId: manila, purchaseOrderId: po3.id, supplierId: suppliers.get('FreshMart Foods')!, number: 'FM-10231', amountMinor: 760000, receivedValueMinor: 760000, issuedOn: new Date(`${addDays(today, -18)}T00:00:00.000Z`), dueOn: new Date(`${addDays(today, -4)}T00:00:00.000Z`), createdById: ownerId } });
    const po4 = await order('PO-DEMO04', 'CleanPro Trading', 'RECEIVED', [['BV-WATER', 200, 1400, 200]], 12);
    await receive(po4, 'PO-DEMO04');
    // The supplier charged MORE than what arrived: shows the invoice variance warning. This one has been paid.
    const inv4 = await prisma.supplierInvoice.create({ data: { organizationId, propertyId: manila, purchaseOrderId: po4.id, supplierId: suppliers.get('CleanPro Trading')!, number: 'CP-5540', amountMinor: 294000, receivedValueMinor: 280000, issuedOn: new Date(`${addDays(today, -10)}T00:00:00.000Z`), dueOn: new Date(`${addDays(today, 5)}T00:00:00.000Z`), status: 'PAID', paidAt: new Date(), paidMethod: 'BANK_TRANSFER', paidReference: 'TRX-88213', createdById: ownerId } });
    await prisma.expense.create({ data: { organizationId, propertyId: manila, category: 'INVENTORY', vendor: 'CleanPro Trading', supplierId: suppliers.get('CleanPro Trading')!, incurredOn: new Date(`${addDays(today, -2)}T00:00:00.000Z`), amountMinor: 294000, paymentMethod: 'BANK_TRANSFER', reference: 'TRX-88213', note: 'Supplier invoice CP-5540 (PO-DEMO04)', source: 'PURCHASING', supplierInvoiceId: inv4.id, createdById: ownerId } });
  }

  if ((await prisma.expense.count({ where: { propertyId: manila, source: 'MANUAL' } })) === 0) {
    const manual: Array<['UTILITIES' | 'RENT' | 'INTERNET' | 'PAYROLL' | 'MARKETING' | 'TRANSPORTATION' | 'MAINTENANCE', string, number, 'CASH' | 'CARD' | 'BANK_TRANSFER', number]> = [
      ['UTILITIES', 'Meralco', 18_450_000, 'BANK_TRANSFER', 25], ['UTILITIES', 'Manila Water', 3_120_000, 'BANK_TRANSFER', 24],
      ['RENT', 'Lot lease', 25_000_000, 'BANK_TRANSFER', 28], ['INTERNET', 'PLDT Enterprise', 1_850_000, 'CARD', 20],
      ['PAYROLL', 'Payroll (1st half)', 42_000_000, 'BANK_TRANSFER', 15], ['MARKETING', 'Social media ads', 1_200_000, 'CARD', 9],
      ['TRANSPORTATION', 'Airport shuttle fuel', 350_000, 'CASH', 5], ['MAINTENANCE', 'Aircon servicing', 780_000, 'CASH', 3],
    ];
    for (const [category, vendor, amountMinor, paymentMethod, daysAgo] of manual) {
      await prisma.expense.create({ data: { organizationId, propertyId: manila, category, vendor, incurredOn: new Date(`${addDays(today, -daysAgo)}T00:00:00.000Z`), amountMinor, paymentMethod, createdById: ownerId } });
    }
  }
}

// ---------------------------------------------------------------- demo POS: outlets, menu, a few sales today
async function seedPos(organizationId: string, propertyIds: Map<string, string>, ownerId: string) {
  const manila = propertyIds.get('manila-grand');
  if (!manila) return;
  if ((await prisma.posOutlet.count({ where: { propertyId: manila } })) > 0) return;

  const water = await prisma.inventoryItem.findFirst({ where: { organizationId, sku: 'BV-WATER', deletedAt: null } });
  // [name, category, price in centavos, uses stock]
  const menus: Array<[string, 'CAFE' | 'BAR' | 'ROOM_SERVICE', Array<[string, string, number, boolean]>]> = [
    ['Grand Café', 'CAFE', [['Brewed coffee', 'Drinks', 12000, false], ['Cappuccino', 'Drinks', 15000, false], ['Club sandwich', 'Food', 28000, false], ['Chocolate cake', 'Dessert', 16000, false], ['Bottled water', 'Drinks', 5000, true]]],
    ['Skyline Bar', 'BAR', [['Local beer', 'Drinks', 12000, false], ['Margarita', 'Cocktails', 25000, false], ['Bottled water', 'Drinks', 6000, true]]],
    ['Room Service', 'ROOM_SERVICE', [['Chicken adobo meal', 'Mains', 32000, false], ['Fried rice', 'Mains', 18000, false], ['Bottled water', 'Drinks', 6000, true]]],
  ];
  const created = new Map<string, { id: string; items: Array<{ id: string; name: string; priceMinor: number }> }>();
  for (const [name, type, items] of menus) {
    const outlet = await prisma.posOutlet.create({ data: { organizationId, propertyId: manila, name, type } });
    const rows: Array<{ id: string; name: string; priceMinor: number }> = [];
    for (const [itemName, category, priceMinor, tracked] of items) {
      const row = await prisma.posItem.create({ data: { organizationId, outletId: outlet.id, name: itemName, category, priceMinor, taxable: true, inventoryItemId: tracked && water ? water.id : null, inventoryQuantity: 1 } });
      rows.push({ id: row.id, name: row.name, priceMinor: row.priceMinor });
    }
    created.set(name, { id: outlet.id, items: rows });
  }

  // Three counter sales today (none use tracked stock, so the demo stock counts stay as seeded).
  const taxes = await prisma.tax.findMany({ where: { propertyId: manila, isActive: true, deletedAt: null, appliesToExtras: true }, select: { rateBps: true } });
  const cafe = created.get('Grand Café')!;
  const sale = async (code: string, method: 'CASH' | 'CARD', picks: Array<[string, number]>) => {
    const specs = picks.map(([name, quantity]) => ({ item: cafe.items.find((i) => i.name === name)!, quantity }));
    const t = posLineTotals(specs.map((s) => ({ quantity: s.quantity, unitAmountMinor: s.item.priceMinor, taxable: true })), taxes);
    await prisma.posOrder.create({
      data: {
        organizationId, propertyId: manila, outletId: cafe.id, code, status: 'PAID', paymentMethod: method, subtotalMinor: t.subtotalMinor, taxMinor: t.taxMinor, totalMinor: t.totalMinor, currency: 'PHP', createdById: ownerId,
        lines: { create: specs.map((s, i) => ({ organizationId, posItemId: s.item.id, description: s.item.name, quantity: s.quantity, unitAmountMinor: s.item.priceMinor, amountMinor: t.lines[i]!.amountMinor, taxable: true, taxMinor: t.lines[i]!.taxMinor })) },
      },
    });
  };
  await sale('POS-DEMO01', 'CASH', [['Brewed coffee', 2], ['Chocolate cake', 1]]);
  await sale('POS-DEMO02', 'CARD', [['Club sandwich', 2], ['Cappuccino', 2]]);
  await sale('POS-DEMO03', 'CASH', [['Cappuccino', 1]]);
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
    await seedReservations(org.id, property.id, p.slug, property.currency, property.timezone);
    await seedTaxes(org.id, property.id, p.slug);
    await seedFolios(org.id, property.id, property.currency);
    await seedDeposits(org.id, property.id, property.currency);
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

  const propertyRows: Array<{ id: string; slug: string }> = await prisma.property.findMany({ where: { organizationId: org.id }, select: { id: true, slug: true } });
  const propertyIds = new Map<string, string>(propertyRows.map((p) => [p.slug, p.id] as [string, string]));
  const staff = await seedStaff(org.id, propertyIds, password);
  for (const [slug, propertyId] of propertyIds) await seedOperations(org.id, propertyId, slug, staff);
  await seedBusiness(org.id, propertyIds, staff, owner.id);
  await seedPos(org.id, propertyIds, owner.id);

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
