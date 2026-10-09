"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACTION_RESULT = exports.ACTION_FROM = exports.RESERVATION_ACTIONS = exports.CREATABLE_STATUSES = exports.EDITABLE_STATUSES = exports.HOLDING_STATUSES = exports.RESERVATION_SOURCES = exports.RESERVATION_STATUSES = void 0;
exports.RESERVATION_STATUSES = ['INQUIRY', 'PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW'];
exports.RESERVATION_SOURCES = ['WALK_IN', 'PHONE', 'WEBSITE', 'OTA', 'GROUP', 'CORPORATE', 'TRAVEL_AGENT', 'OTHER'];
/** Statuses that hold inventory: these block the room type's (and the assigned room's) availability. */
exports.HOLDING_STATUSES = ['PENDING', 'CONFIRMED', 'CHECKED_IN'];
exports.EDITABLE_STATUSES = ['INQUIRY', 'PENDING', 'CONFIRMED'];
/** Statuses a new reservation may be created in. */
exports.CREATABLE_STATUSES = ['INQUIRY', 'PENDING', 'CONFIRMED'];
exports.RESERVATION_ACTIONS = ['confirm', 'cancel', 'no_show', 'check_in', 'check_out', 'assign_room', 'unassign_room'];
exports.ACTION_FROM = {
    confirm: ['INQUIRY', 'PENDING'],
    cancel: ['INQUIRY', 'PENDING', 'CONFIRMED'],
    no_show: ['PENDING', 'CONFIRMED'],
    check_in: ['CONFIRMED'],
    check_out: ['CHECKED_IN'],
    assign_room: ['PENDING', 'CONFIRMED', 'CHECKED_IN'],
    unassign_room: ['PENDING', 'CONFIRMED'],
};
exports.ACTION_RESULT = {
    confirm: 'CONFIRMED',
    cancel: 'CANCELLED',
    no_show: 'NO_SHOW',
    check_in: 'CHECKED_IN',
    check_out: 'CHECKED_OUT',
};
