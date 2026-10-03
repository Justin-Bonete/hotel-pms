export const PROPERTY_TYPES = ['HOTEL', 'RESORT', 'BOUTIQUE', 'INN', 'HOSTEL', 'SERVICED_APARTMENT', 'VACATION_RENTAL'] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

/**
 * Room statuses STORED in the database. OCCUPIED, RESERVED and DUE_OUT are derived from reservations,
 * so they only appear once Phase 3 exists.
 */
export const ROOM_STATUSES = ['AVAILABLE', 'DIRTY', 'CLEANING', 'INSPECTED', 'OUT_OF_ORDER', 'OUT_OF_SERVICE', 'MAINTENANCE'] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];

export const DERIVED_ROOM_STATUSES = ['OCCUPIED', 'RESERVED', 'DUE_OUT'] as const;

/** Moving a room into or out of these needs the room.manage permission (housekeeping can't do it). */
export const RESTRICTED_ROOM_STATUSES: readonly RoomStatus[] = ['OUT_OF_ORDER', 'OUT_OF_SERVICE'];

/** Housekeeping flow: DIRTY -> CLEANING -> INSPECTED -> AVAILABLE (ready). */
export const ROOM_STATUS_TRANSITIONS: Record<RoomStatus, readonly RoomStatus[]> = {
  AVAILABLE: ['DIRTY', 'MAINTENANCE', 'OUT_OF_ORDER', 'OUT_OF_SERVICE'],
  DIRTY: ['CLEANING', 'MAINTENANCE', 'OUT_OF_ORDER', 'OUT_OF_SERVICE'],
  CLEANING: ['INSPECTED', 'AVAILABLE', 'DIRTY', 'MAINTENANCE'],
  INSPECTED: ['AVAILABLE', 'DIRTY', 'MAINTENANCE'],
  MAINTENANCE: ['DIRTY', 'AVAILABLE', 'OUT_OF_ORDER', 'OUT_OF_SERVICE'],
  OUT_OF_ORDER: ['DIRTY', 'AVAILABLE', 'MAINTENANCE'],
  OUT_OF_SERVICE: ['DIRTY', 'AVAILABLE', 'MAINTENANCE'],
};

export const canTransition = (from: RoomStatus, to: RoomStatus): boolean => ROOM_STATUS_TRANSITIONS[from].includes(to);

export interface PropertyGroupView {
  id: string;
  name: string;
  propertyCount: number;
}

export interface FloorView {
  id: string;
  level: number;
  name: string | null;
}

export interface BuildingView {
  id: string;
  name: string;
  floors: FloorView[];
}

export interface RoomTypeView {
  id: string;
  propertyId: string;
  name: string;
  description: string | null;
  maxOccupancy: number;
  bedConfiguration: string | null;
  amenities: string[];
  roomCount: number;
}

export interface RoomView {
  id: string;
  propertyId: string;
  number: string;
  status: RoomStatus;
  statusNote: string | null;
  statusChangedAt: string;
  notes: string | null;
  roomTypeId: string;
  roomTypeName: string;
  floorId: string | null;
  floorLevel: number | null;
  floorLabel: string | null;
}
