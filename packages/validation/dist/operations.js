"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.staffQuerySchema = exports.inviteStaffSchema = exports.scopeSchema = exports.extendStaySchema = exports.ticketsQuerySchema = exports.ticketWorkSchema = exports.ticketActionSchema = exports.createTicketSchema = exports.tasksQuerySchema = exports.taskActionSchema = exports.createTaskSchema = void 0;
const types_1 = require("@pms/types");
const zod_1 = require("zod");
const reservations_1 = require("./reservations");
const note = zod_1.z.string().trim().max(500);
// ---------------------------------------------------------------- housekeeping
exports.createTaskSchema = zod_1.z.object({
    roomId: zod_1.z.string().uuid('Choose a room'),
    type: zod_1.z.enum(types_1.HOUSEKEEPING_TASK_TYPES),
    priority: zod_1.z.enum(types_1.TASK_PRIORITIES),
    estimatedMinutes: zod_1.z.number().int('Whole minutes').min(1).max(600).optional(),
    notes: note,
    assignedToId: zod_1.z.string().uuid().optional(),
});
exports.taskActionSchema = zod_1.z.object({
    action: zod_1.z.enum(types_1.HOUSEKEEPING_ACTIONS),
    assignedToId: zod_1.z.string().uuid().optional(),
    note: note.optional(),
});
exports.tasksQuerySchema = zod_1.z.object({
    status: zod_1.z.enum(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'CLEANED', 'DONE', 'CANCELLED']).optional(),
    mine: zod_1.z.enum(['true', 'false']).optional(),
    open: zod_1.z.enum(['true', 'false']).optional(),
});
// ---------------------------------------------------------------- maintenance
exports.createTicketSchema = zod_1.z.object({
    title: zod_1.z.string().trim().min(3, 'Describe the problem briefly').max(120),
    description: note,
    category: zod_1.z.enum(types_1.MAINTENANCE_CATEGORIES),
    priority: zod_1.z.enum(types_1.TASK_PRIORITIES),
    roomId: zod_1.z.string().uuid().optional(),
    /** Take the room out of the available pool while it is fixed. */
    blocksRoom: zod_1.z.boolean(),
});
exports.ticketActionSchema = zod_1.z.object({
    action: zod_1.z.enum(types_1.MAINTENANCE_ACTIONS),
    assignedToId: zod_1.z.string().uuid().optional(),
    note: note.optional(),
});
exports.ticketWorkSchema = zod_1.z.object({
    costMinor: zod_1.z.number().int().min(0).max(1_000_000_000).optional(),
    minutesSpent: zod_1.z.number().int().min(0).max(100_000).optional(),
    partsUsed: zod_1.z.string().trim().max(300).optional(),
    resolutionNote: zod_1.z.string().trim().max(500).optional(),
    priority: zod_1.z.enum(types_1.TASK_PRIORITIES).optional(),
});
exports.ticketsQuerySchema = zod_1.z.object({
    status: zod_1.z.enum(['REPORTED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_PARTS', 'RESOLVED', 'CLOSED']).optional(),
    open: zod_1.z.enum(['true', 'false']).optional(),
    mine: zod_1.z.enum(['true', 'false']).optional(),
});
// ---------------------------------------------------------------- front desk
exports.extendStaySchema = zod_1.z.object({ departureDate: reservations_1.dateSchema });
// ---------------------------------------------------------------- staff
exports.scopeSchema = zod_1.z.object({
    roleId: zod_1.z.string().uuid('Choose a role'),
    scopeType: zod_1.z.enum(['ORGANIZATION', 'GROUP', 'PROPERTY']),
    scopeId: zod_1.z.string().uuid(),
});
exports.inviteStaffSchema = zod_1.z.object({
    firstName: zod_1.z.string().trim().min(1, 'Enter a first name').max(80),
    lastName: zod_1.z.string().trim().min(1, 'Enter a last name').max(80),
    email: zod_1.z.string().trim().toLowerCase().email('Enter a valid email').max(254),
    assignment: exports.scopeSchema,
});
exports.staffQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    pageSize: zod_1.z.coerce.number().int().min(1).max(100).default(25),
    search: zod_1.z.string().trim().max(80).optional(),
});
//# sourceMappingURL=operations.js.map