import type { ReservationView } from '@pms/types';

/**
 * What a reservation event tells the outside world. Deliberately small: no email, phone, notes or special requests.
 * A receiver that needs more can look the booking up by its code.
 */
export function reservationEventData(r: ReservationView): Record<string, unknown> {
  return {
    reservationId: r.id,
    code: r.code,
    status: r.status,
    source: r.source,
    propertyId: r.propertyId,
    propertyName: r.propertyName,
    guest: { id: r.guestId, name: r.guestName },
    roomType: r.roomTypeName,
    roomNumber: r.roomNumber,
    arrivalDate: r.arrivalDate,
    departureDate: r.departureDate,
    nights: r.nights,
    adults: r.adults,
    children: r.children,
    totalMinor: r.totalMinor,
    currency: r.currency,
  };
}
