import type { RoomStatus } from './rooms';
import type { ReservationView } from './reservations';
export declare const HOUSEKEEPING_TASK_TYPES: readonly ["CHECKOUT_CLEAN", "STAYOVER", "DEEP_CLEAN"];
export type HousekeepingTaskType = (typeof HOUSEKEEPING_TASK_TYPES)[number];
export declare const TASK_PRIORITIES: readonly ["LOW", "NORMAL", "HIGH", "URGENT"];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export declare const HOUSEKEEPING_STATUSES: readonly ["OPEN", "ASSIGNED", "IN_PROGRESS", "CLEANED", "DONE", "CANCELLED"];
export type HousekeepingStatus = (typeof HOUSEKEEPING_STATUSES)[number];
export declare const HOUSEKEEPING_ACTIONS: readonly ["assign", "unassign", "start", "finish", "inspect_pass", "inspect_fail", "cancel"];
export type HousekeepingAction = (typeof HOUSEKEEPING_ACTIONS)[number];
export declare const OPEN_HOUSEKEEPING_STATUSES: readonly HousekeepingStatus[];
export declare const HK_ACTION_FROM: Record<HousekeepingAction, readonly HousekeepingStatus[]>;
/** The task status after an action. A stayover has no inspection step, so finishing it completes it. */
export declare function housekeepingResult(type: HousekeepingTaskType, action: HousekeepingAction): HousekeepingStatus;
export interface RoomEffect {
    /** the room must currently be in one of these stored states for the change to apply */
    from: readonly RoomStatus[];
    to: RoomStatus;
}
/**
 * How a task action moves the ROOM. Only turnover cleans change the room's stored status; a stayover
 * (guest still in the room) never does. Returns null when the room is untouched.
 */
export declare function housekeepingRoomEffect(type: HousekeepingTaskType, action: HousekeepingAction): RoomEffect | null;
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
export declare const MAINTENANCE_CATEGORIES: readonly ["AIRCON", "PLUMBING", "ELECTRICAL", "FURNITURE", "INTERNET", "APPLIANCE", "STRUCTURAL", "OTHER"];
export type MaintenanceCategory = (typeof MAINTENANCE_CATEGORIES)[number];
export declare const MAINTENANCE_STATUSES: readonly ["REPORTED", "ASSIGNED", "IN_PROGRESS", "WAITING_PARTS", "RESOLVED", "CLOSED"];
export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number];
export declare const MAINTENANCE_ACTIONS: readonly ["assign", "start", "wait_parts", "resume", "resolve", "close", "reopen"];
export type MaintenanceAction = (typeof MAINTENANCE_ACTIONS)[number];
export declare const OPEN_MAINTENANCE_STATUSES: readonly MaintenanceStatus[];
export declare const MT_ACTION_FROM: Record<MaintenanceAction, readonly MaintenanceStatus[]>;
export declare const MT_ACTION_RESULT: Record<MaintenanceAction, MaintenanceStatus>;
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
export interface FrontDeskItem extends ReservationView {
    guestIsVip: boolean;
    /** Positive = guest owes money. Only filled for in-house guests. */
    balanceDueMinor: number | null;
}
export interface FrontDeskView {
    today: string;
    propertyId: string;
    counts: {
        rooms: number;
        inHouse: number;
        arrivals: number;
        departures: number;
        dirty: number;
        outOfOrder: number;
    };
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
export declare const REALTIME_EVENTS: readonly ["room.changed", "reservation.changed", "housekeeping.changed", "maintenance.changed", "folio.changed"];
export type RealtimeEventType = (typeof REALTIME_EVENTS)[number];
/** Deliberately tiny: ids only, never guest or money details. Clients refetch what they are allowed to see. */
export interface RealtimeEvent {
    type: RealtimeEventType;
    propertyId: string;
    ids: string[];
    at: string;
}
