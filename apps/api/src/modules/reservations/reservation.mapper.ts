import type { Prisma } from '@prisma/client';
import { toDateString, type ReservationView } from '@pms/types';

export const reservationInclude = {
  property: { select: { name: true } },
  guest: { select: { firstName: true, lastName: true } },
  roomType: { select: { name: true } },
  room: { select: { number: true } },
  ratePlan: { select: { name: true } },
} satisfies Prisma.ReservationInclude;

/** Same as reservationInclude, plus the property's timezone (needed for "today" rules). */
export const reservationDetailInclude = {
  ...reservationInclude,
  property: { select: { name: true, timezone: true } },
} satisfies Prisma.ReservationInclude;

export type ReservationRow = Prisma.ReservationGetPayload<{ include: typeof reservationInclude }>;

export const toReservationView = (r: ReservationRow): ReservationView => ({
  id: r.id,
  code: r.code,
  propertyId: r.propertyId,
  propertyName: r.property.name,
  status: r.status,
  source: r.source,
  guestId: r.guestId,
  guestName: `${r.guest.firstName} ${r.guest.lastName}`,
  roomTypeId: r.roomTypeId,
  roomTypeName: r.roomType.name,
  roomId: r.roomId,
  roomNumber: r.room?.number ?? null,
  ratePlanId: r.ratePlanId,
  ratePlanName: r.ratePlan?.name ?? null,
  arrivalDate: toDateString(r.arrivalDate),
  departureDate: toDateString(r.departureDate),
  nights: r.nights,
  adults: r.adults,
  children: r.children,
  totalMinor: r.totalMinor,
  currency: r.currency,
  specialRequests: r.specialRequests,
  notes: r.notes,
  cancelReason: r.cancelReason,
  checkedInAt: r.checkedInAt?.toISOString() ?? null,
  checkedOutAt: r.checkedOutAt?.toISOString() ?? null,
  createdAt: r.createdAt.toISOString(),
});
