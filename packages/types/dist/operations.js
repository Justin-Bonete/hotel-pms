"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REALTIME_EVENTS = exports.MT_ACTION_RESULT = exports.MT_ACTION_FROM = exports.OPEN_MAINTENANCE_STATUSES = exports.MAINTENANCE_ACTIONS = exports.MAINTENANCE_STATUSES = exports.MAINTENANCE_CATEGORIES = exports.HK_ACTION_FROM = exports.OPEN_HOUSEKEEPING_STATUSES = exports.HOUSEKEEPING_ACTIONS = exports.HOUSEKEEPING_STATUSES = exports.TASK_PRIORITIES = exports.HOUSEKEEPING_TASK_TYPES = void 0;
exports.housekeepingResult = housekeepingResult;
exports.housekeepingRoomEffect = housekeepingRoomEffect;
// ================================================================== housekeeping
exports.HOUSEKEEPING_TASK_TYPES = ['CHECKOUT_CLEAN', 'STAYOVER', 'DEEP_CLEAN'];
exports.TASK_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
exports.HOUSEKEEPING_STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'CLEANED', 'DONE', 'CANCELLED'];
exports.HOUSEKEEPING_ACTIONS = ['assign', 'unassign', 'start', 'finish', 'inspect_pass', 'inspect_fail', 'cancel'];
exports.OPEN_HOUSEKEEPING_STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'CLEANED'];
exports.HK_ACTION_FROM = {
    assign: ['OPEN', 'ASSIGNED'],
    unassign: ['ASSIGNED'],
    start: ['ASSIGNED'],
    finish: ['IN_PROGRESS'],
    inspect_pass: ['CLEANED'],
    inspect_fail: ['CLEANED'],
    cancel: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'CLEANED'],
};
/** The task status after an action. A stayover has no inspection step, so finishing it completes it. */
function housekeepingResult(type, action) {
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
/**
 * How a task action moves the ROOM. Only turnover cleans change the room's stored status; a stayover
 * (guest still in the room) never does. Returns null when the room is untouched.
 */
function housekeepingRoomEffect(type, action) {
    if (type === 'STAYOVER')
        return null;
    switch (action) {
        case 'start': return { from: ['DIRTY'], to: 'CLEANING' };
        case 'finish': return { from: ['CLEANING', 'DIRTY'], to: 'CLEAN' };
        case 'inspect_pass': return { from: ['CLEAN', 'INSPECTED'], to: 'AVAILABLE' };
        case 'inspect_fail': return { from: ['CLEAN', 'INSPECTED'], to: 'DIRTY' };
        default: return null;
    }
}
// ================================================================== maintenance
exports.MAINTENANCE_CATEGORIES = ['AIRCON', 'PLUMBING', 'ELECTRICAL', 'FURNITURE', 'INTERNET', 'APPLIANCE', 'STRUCTURAL', 'OTHER'];
exports.MAINTENANCE_STATUSES = ['REPORTED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_PARTS', 'RESOLVED', 'CLOSED'];
exports.MAINTENANCE_ACTIONS = ['assign', 'start', 'wait_parts', 'resume', 'resolve', 'close', 'reopen'];
exports.OPEN_MAINTENANCE_STATUSES = ['REPORTED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_PARTS'];
exports.MT_ACTION_FROM = {
    assign: ['REPORTED', 'ASSIGNED'],
    start: ['REPORTED', 'ASSIGNED'],
    wait_parts: ['IN_PROGRESS'],
    resume: ['WAITING_PARTS'],
    resolve: ['IN_PROGRESS', 'WAITING_PARTS'],
    close: ['RESOLVED'],
    reopen: ['RESOLVED', 'CLOSED'],
};
exports.MT_ACTION_RESULT = {
    assign: 'ASSIGNED',
    start: 'IN_PROGRESS',
    wait_parts: 'WAITING_PARTS',
    resume: 'IN_PROGRESS',
    resolve: 'RESOLVED',
    close: 'CLOSED',
    reopen: 'IN_PROGRESS',
};
// ================================================================== realtime
exports.REALTIME_EVENTS = ['room.changed', 'reservation.changed', 'housekeeping.changed', 'maintenance.changed', 'folio.changed'];
//# sourceMappingURL=operations.js.map