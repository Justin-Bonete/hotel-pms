import type { RoomStatus } from './rooms';
import type { ReservationView } from './reservations';

// ================================================================== housekeeping
export const HOUSEKEEPING_TASK_TYPES = ['CHECKOUT_CLEAN', 'STAYOVER', 'DEEP_CLEAN'] as const;
export type HousekeepingTaskType = (typeof HOUSEKEEPING_TASK_TYPES)[number];

export const TASK_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const HOUSEKEEPING_STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'CLEANED', 'DONE', 'CANCELLED'] as const;
export type HousekeepingStatus = (typeof HOUSEKEEPING_STATUSES)[number];

export const HOUSEKEEPING_ACTIONS = ['assign', 'unassign', 'start', 'finish', 'inspect_pass', 'inspect_fail', 'cancel'] as const;
export type HousekeepingAction = (typeof HOUSEKEEPING_ACTIONS)[number];

export const OPEN_HOUSEKEEPING_STATUSES: readonly HousekeepingStatus[] = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'CLEANED'];

export const HK_ACTION_FROM: Record<HousekeepingAction, readonly HousekeepingStatus[]> = {
  assign: ['OPEN', 'ASSIGNED'],
  unassign: ['ASSIGNED'],
  start: ['ASSIGNED'],
  finish: ['IN_PROGRESS'],
  inspect_pass: ['CLEANED'],
  inspect_fail: ['CLEANED'],
  cancel: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'CLEANED'],
};

/** The task status after an action. A stayover has no inspection step, so finishing it completes it. */
export function housekeepingResult(type: HousekeepingTaskType, action: HousekeepingAction): HousekeepingStatus {
  switch (action) {
    case 'assign': return 'ASSIGNED';
    case 'unassign': return 'OPEN';
    case 'start': return 'IN_PROGRESS';
    case 'finish': return type === 'STAYOVER' ? 'DONE' : 'CLEANED';
    case 'inspect_pass': return 'DONE';
    case 'inspect_fail': return 'ASSIGNED';
    case 'cancel': return 'CANCELLED';
  }
}

export interface RoomEffect {
  /** the room must currently be in one of these stored states for the change to apply */
  from: readonly RoomStatus[];
  to: RoomStatus;
}

/**
 * How a task action moves the ROOM. Only turnover cleans change the room's stored status; a stayover
 * (guest still in the room) never does. Returns null when the room is untouched.
 */
export function housekeepingRoomEffect(type: HousekeepingTaskType, action: HousekeepingAction): RoomEffect | null {
  if (type === 'STAYOVER') return null;
  switch (action) {
    case 'start': return { from: ['DIRTY'], to: 'CLEANING' };
    case 'finish': return { from: ['CLEANING', 'DIRTY'], to: 'CLEAN' };
    case 'inspect_pass': return { from: ['CLEAN', 'INSPECTED'], to: 'AVAILABLE' };
    case 'inspect_fail': return { from: ['CLEAN', 'INSPECTED'], to: 'DIRTY' };
    default: return null;
  }
}

export interface HousekeepingTaskView {
  id: string;
  propertyId: string;
  roomId: string;
  roomNumber: string;
  roomTypeName: string;
  roomStatus: RoomStatus;
  floorLabel: string | null;
  type: HousekeepingTaskType;
  status: HousekeepingStatus;
  priority: TaskPriority;
  assignedToId: string | null;
  assignedToName: string | null;
  estimatedMinutes: number | null;
  notes: string | null;
  createdAt: string;
  startedAt: string | null;
  cleanedAt: string | null;
  completedAt: string | null;
}

export interface AssignableStaff {
  id: string;
  name: string;
}

// ================================================================== maintenance
export const MAINTENANCE_CATEGORIES = ['AIRCON', 'PLUMBING', 'ELECTRICAL', 'FURNITURE', 'INTERNET', 'APPLIANCE', 'STRUCTURAL', 'OTHER'] as const;
export type MaintenanceCategory = (typeof MAINTENANCE_CATEGORIES)[number];

export const MAINTENANCE_STATUSES = ['REPORTED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_PARTS', 'RESOLVED', 'CLOSED'] as const;
export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number];

export const MAINTENANCE_ACTIONS = ['assign', 'start', 'wait_parts', 'resume', 'resolve', 'close', 'reopen'] as const;
export type MaintenanceAction = (typeof MAINTENANCE_ACTIONS)[number];

export const OPEN_MAINTENANCE_STATUSES: readonly MaintenanceStatus[] = ['REPORTED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_PARTS'];

export const MT_ACTION_FROM: Record<MaintenanceAction, readonly MaintenanceStatus[]> = {
  assign: ['REPORTED', 'ASSIGNED'],
  start: ['REPORTED', 'ASSIGNED'],
  wait_parts: ['IN_PROGRESS'],
  resume: ['WAITING_PARTS'],
  resolve: ['IN_PROGRESS', 'WAITING_PARTS'],
  close: ['RESOLVED'],
  reopen: ['RESOLVED', 'CLOSED'],
};

export const MT_ACTION_RESULT: Record<MaintenanceAction, MaintenanceStatus> = {
  assign: 'ASSIGNED',
  start: 'IN_PROGRESS',
  wait_parts: 'WAITING_PARTS',
  resume: 'IN_PROGRESS',
  resolve: 'RESOLVED',
  close: 'CLOSED',
  reopen: 'IN_PROGRESS',
};

export interface MaintenanceTicketView {
  id: string;
  propertyId: string;
  roomId: string | null;
  roomNumber: string | null;
  title: string;
  description: string | null;
  category: MaintenanceCategory;
  priority: TaskPriority;
  status: MaintenanceStatus;
  blocksRoom: boolean;
  assignedToId: string | null;
  assignedToName: string | null;
  reportedByName: string | null;
  costMinor: number;
  minutesSpent: number;
  partsUsed: string | null;
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

// ================================================================== front desk
export interface FrontDeskItem extends ReservationView {
  guestIsVip: boolean;
  /** Positive = guest owes money. Only filled for in-house guests. */
  balanceDueMinor: number | null;
}

export interface FrontDeskView {
  today: string;
  propertyId: string;
  counts: { rooms: number; inHouse: number; arrivals: number; departures: number; dirty: number; outOfOrder: number };
  arrivals: FrontDeskItem[];
  departures: FrontDeskItem[];
  inHouse: FrontDeskItem[];
  /** Confirmed/pending arrivals in the next 3 days. */
  expected: FrontDeskItem[];
  /** In-house guests whose departure date has passed. */
  overstays: FrontDeskItem[];
  vips: FrontDeskItem[];
  paymentsDue: FrontDeskItem[];
}

// ================================================================== staff
export interface StaffAssignmentView {
  id: string;
  roleKey: string;
  roleName: string;
  scopeType: 'ORGANIZATION' | 'GROUP' | 'PROPERTY';
  scopeId: string;
  scopeLabel: string;
}

export interface StaffView {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  status: 'INVITED' | 'ACTIVE' | 'DISABLED';
  emailVerified: boolean;
  lastLoginAt: string | null;
  assignments: StaffAssignmentView[];
  /** The caller may change or disable this person (they hold at least this person's access). */
  manageable: boolean;
}

// ================================================================== realtime
export const REALTIME_EVENTS = ['room.changed', 'reservation.changed', 'housekeeping.changed', 'maintenance.changed', 'folio.changed'] as const;
export type RealtimeEventType = (typeof REALTIME_EVENTS)[number];

/** Deliberately tiny: ids only, never guest or money details. Clients refetch what they are allowed to see. */
export interface RealtimeEvent {
  type: RealtimeEventType;
  propertyId: string;
  ids: string[];
  at: string;
}
