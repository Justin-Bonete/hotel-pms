export declare const RESERVATION_STATUSES: readonly ["INQUIRY", "PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED", "NO_SHOW"];
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];
export declare const RESERVATION_SOURCES: readonly ["WALK_IN", "PHONE", "WEBSITE", "OTA", "GROUP", "CORPORATE", "TRAVEL_AGENT", "OTHER"];
export type ReservationSource = (typeof RESERVATION_SOURCES)[number];
/** Statuses that hold inventory: these block the room type's (and the assigned room's) availability. */
export declare const HOLDING_STATUSES: readonly ReservationStatus[];
export declare const EDITABLE_STATUSES: readonly ReservationStatus[];
/** Statuses a new reservation may be created in. */
export declare const CREATABLE_STATUSES: readonly ["INQUIRY", "PENDING", "CONFIRMED"];
export declare const RESERVATION_ACTIONS: readonly ["confirm", "cancel", "no_show", "check_in", "check_out", "assign_room", "unassign_room"];
export type ReservationAction = (typeof RESERVATION_ACTIONS)[number];
export declare const ACTION_FROM: Record<ReservationAction, readonly ReservationStatus[]>;
export declare const ACTION_RESULT: Partial<Record<ReservationAction, ReservationStatus>>;
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
    nights: Array<{
        date: string;
        available: number;
    }>;
}
export interface AvailabilityView {
    from: string;
    days: number;
    roomTypes: AvailabilityRow[];
}
