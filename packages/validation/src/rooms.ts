import { ROOM_STATUSES } from '@pms/types';
import { z } from 'zod';

const uuidOrEmpty = z.union([z.literal(''), z.string().uuid()]);

export const roomTypeSchema = z.object({
  name: z.string().trim().min(2, 'Enter a name').max(80),
  description: z.string().trim().max(500),
  maxOccupancy: z.number().int('Whole number').min(1).max(20),
  bedConfiguration: z.string().trim().max(120),
  amenities: z.array(z.string().trim().min(1).max(40)).max(30),
});
export const updateRoomTypeSchema = roomTypeSchema.partial();

export const roomSchema = z.object({
  number: z.string().trim().min(1, 'Enter a room number').max(20),
  roomTypeId: z.string().uuid('Choose a room type'),
  floorId: uuidOrEmpty,
  notes: z.string().trim().max(500),
});
export const updateRoomSchema = roomSchema.partial();

export const roomStatusSchema = z.object({
  status: z.enum(ROOM_STATUSES),
  note: z.string().trim().max(300).optional(),
});

export const roomsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  status: z.enum(ROOM_STATUSES).optional(),
  roomTypeId: z.string().uuid().optional(),
  floorId: z.string().uuid().optional(),
  search: z.string().trim().max(20).optional(),
});

export type RoomTypeInput = z.infer<typeof roomTypeSchema>;
export type UpdateRoomTypeInput = z.infer<typeof updateRoomTypeSchema>;
export type RoomInput = z.infer<typeof roomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
export type RoomStatusInput = z.infer<typeof roomStatusSchema>;
export type RoomsQuery = z.infer<typeof roomsQuerySchema>;
