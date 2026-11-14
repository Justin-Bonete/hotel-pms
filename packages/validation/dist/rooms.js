"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roomsQuerySchema = exports.roomStatusSchema = exports.updateRoomSchema = exports.roomSchema = exports.updateRoomTypeSchema = exports.roomTypeSchema = void 0;
const types_1 = require("@pms/types");
const zod_1 = require("zod");
const uuidOrEmpty = zod_1.z.union([zod_1.z.literal(''), zod_1.z.string().uuid()]);
exports.roomTypeSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(2, 'Enter a name').max(80),
    description: zod_1.z.string().trim().max(500),
    maxOccupancy: zod_1.z.number().int('Whole number').min(1).max(20),
    bedConfiguration: zod_1.z.string().trim().max(120),
    amenities: zod_1.z.array(zod_1.z.string().trim().min(1).max(40)).max(30),
});
exports.updateRoomTypeSchema = exports.roomTypeSchema.partial();
exports.roomSchema = zod_1.z.object({
    number: zod_1.z.string().trim().min(1, 'Enter a room number').max(20),
    roomTypeId: zod_1.z.string().uuid('Choose a room type'),
    floorId: uuidOrEmpty,
    notes: zod_1.z.string().trim().max(500),
});
exports.updateRoomSchema = exports.roomSchema.partial();
exports.roomStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(types_1.ROOM_STATUSES),
    note: zod_1.z.string().trim().max(300).optional(),
});
exports.roomsQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    pageSize: zod_1.z.coerce.number().int().min(1).max(200).default(50),
    status: zod_1.z.enum(types_1.ROOM_STATUSES).optional(),
    roomTypeId: zod_1.z.string().uuid().optional(),
    floorId: zod_1.z.string().uuid().optional(),
    search: zod_1.z.string().trim().max(20).optional(),
});
//# sourceMappingURL=rooms.js.map