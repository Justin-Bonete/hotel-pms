"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canTransition = exports.ROOM_STATUS_TRANSITIONS = exports.RESTRICTED_ROOM_STATUSES = exports.DERIVED_ROOM_STATUSES = exports.ROOM_STATUSES = exports.PROPERTY_TYPES = void 0;
exports.PROPERTY_TYPES = ['HOTEL', 'RESORT', 'BOUTIQUE', 'INN', 'HOSTEL', 'SERVICED_APARTMENT', 'VACATION_RENTAL'];
/**
 * Room statuses STORED in the database. OCCUPIED, RESERVED and DUE_OUT are derived from reservations,
 * so they only appear once Phase 3 exists.
 */
exports.ROOM_STATUSES = ['AVAILABLE', 'DIRTY', 'CLEANING', 'INSPECTED', 'OUT_OF_ORDER', 'OUT_OF_SERVICE', 'MAINTENANCE'];
exports.DERIVED_ROOM_STATUSES = ['OCCUPIED', 'RESERVED', 'DUE_OUT'];
/** Moving a room into or out of these needs the room.manage permission (housekeeping can't do it). */
exports.RESTRICTED_ROOM_STATUSES = ['OUT_OF_ORDER', 'OUT_OF_SERVICE'];
/** Housekeeping flow: DIRTY -> CLEANING -> INSPECTED -> AVAILABLE (ready). */
exports.ROOM_STATUS_TRANSITIONS = {
    AVAILABLE: ['DIRTY', 'MAINTENANCE', 'OUT_OF_ORDER', 'OUT_OF_SERVICE'],
    DIRTY: ['CLEANING', 'MAINTENANCE', 'OUT_OF_ORDER', 'OUT_OF_SERVICE'],
    CLEANING: ['INSPECTED', 'AVAILABLE', 'DIRTY', 'MAINTENANCE'],
    INSPECTED: ['AVAILABLE', 'DIRTY', 'MAINTENANCE'],
    MAINTENANCE: ['DIRTY', 'AVAILABLE', 'OUT_OF_ORDER', 'OUT_OF_SERVICE'],
    OUT_OF_ORDER: ['DIRTY', 'AVAILABLE', 'MAINTENANCE'],
    OUT_OF_SERVICE: ['DIRTY', 'AVAILABLE', 'MAINTENANCE'],
};
const canTransition = (from, to) => exports.ROOM_STATUS_TRANSITIONS[from].includes(to);
exports.canTransition = canTransition;
