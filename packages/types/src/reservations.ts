export const RESERVATION_STATUSES = ['INQUIRY', 'PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW'] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const RESERVATION_SOURCES = ['WALK_IN', 'PHONE', 'WEBSITE', 'OTA', 'GROUP', 'CORPORATE', 'TRAVEL_AGENT', 'OTHER'] as const;
export type ReservationSource = (typeof RESERVATION_SOURCES)[number];

/** Statuses that hold inventory: these block the room type's (and the assigned room's) availability. */
export const HOLDING_STATUSES: readonly ReservationStatus[] = ['PENDING', 'CONFIRMED', 'CHECKED_IN'];
export const EDITABLE_STATUSES: readonly ReservationStatus[] = ['INQUIRY', 'PENDING', 'CONFIRMED'];
/** Statuses a new reservation may be created in. */
export const CREATABLE_STATUSES = ['INQUIRY', 'PENDING', 'CONFIRMED'] as const;

export const RESERVATION_ACTIONS = ['confirm', 'cancel', 'no_show', 'check_in', 'check_out', 'assign_room', 'unassign_room'] as const;
export type ReservationAction = (typeof RESERVATION_ACTIONS)[number];

export const ACTION_FROM: Record<ReservationAction, readonly ReservationStatus[]> = {
  confirm: ['INQUIRY', 'PENDING'],
  cancel: ['INQUIRY', 'PENDING', 'CONFIRMED'],
  no_show: ['PENDING', 'CONFIRMED'],
  check_in: ['CONFIRMED'],
  check_out: ['CHECKED_IN'],
  assign_room: ['PENDING', 'CONFIRMED', 'CHECKED_IN'],
  unassign_room: ['PENDING', 'CONFIRMED'],
};

export const ACTION_RESULT: Partial<Record<ReservationAction, ReservationStatus>> = {
  confirm: 'CONFIRMED',
  cancel: 'CANCELLED',
  no_show: 'NO_SHOW',
  check_in: 'CHECKED_IN',
  check_out: 'CHECKED_OUT',
};

export interface GuestView {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  country: string | null;
  isVip: boolean;
  /** Completed stays across the whole organization. 0 = new guest. */
  stayCount: number;
}

export interface GuestDetail extends GuestView {
  notes: string | null;
  preferences: string | null;
  createdAt: string;
  stays: ReservationView[];
}

export interface RatePlanRateView {
  roomTypeId: string;
  roomTypeName: string;
  nightlyRateMinor: number;
  weekendRateMinor: number | null;
}

export interface RatePlanView {
  id: string;
  propertyId: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  currency: string;
  rates: RatePlanRateView[];
}

export interface ReservationView {
  id: string;
  code: string;
  propertyId: string;
  propertyName: string;
  status: ReservationStatus;
  source: ReservationSource;
  guestId: string;
  guestName: string;
  roomTypeId: string;
  roomTypeName: string;
  roomId: string | null;
  roomNumber: string | null;
  ratePlanId: string | null;
  ratePlanName: string | null;
  /** YYYY-MM-DD */
  arrivalDate: string;
  departureDate: string;
  nights: number;
  adults: number;
  children: number;
  totalMinor: number;
  currency: string;
  specialRequests: string | null;
  notes: string | null;
  cancelReason: string | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  createdAt: string;
}

export interface CalendarRoom {
  id: string;
  number: string;
  roomTypeId: string;
  roomTypeName: string;
  floorLevel: number | null;
}

export interface CalendarReservation {
  id: string;
  code: string;
  status: ReservationStatus;
  guestName: string;
  roomId: string | null;
  roomTypeId: string;
  roomTypeName: string;
  arrivalDate: string;
  departureDate: string;
  adults: number;
  children: number;
}

export interface CalendarView {
  from: string;
  days: number;
  today: string;
  rooms: CalendarRoom[];
  reservations: CalendarReservation[];
}

export interface AvailabilityRow {
  roomTypeId: string;
  roomTypeName: string;
  totalRooms: number;
  nights: Array<{ date: string; available: number }>;
}

export interface AvailabilityView {
  from: string;
  days: number;
  roomTypes: AvailabilityRow[];
}
