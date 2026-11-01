import {
  HOUSEKEEPING_ACTIONS, HOUSEKEEPING_TASK_TYPES, MAINTENANCE_ACTIONS, MAINTENANCE_CATEGORIES, TASK_PRIORITIES,
} from '@pms/types';
import { z } from 'zod';
import { dateSchema } from './reservations';

const note = z.string().trim().max(500);

// ---------------------------------------------------------------- housekeeping
export const createTaskSchema = z.object({
  roomId: z.string().uuid('Choose a room'),
  type: z.enum(HOUSEKEEPING_TASK_TYPES),
  priority: z.enum(TASK_PRIORITIES),
  estimatedMinutes: z.number().int('Whole minutes').min(1).max(600).optional(),
  notes: note,
  assignedToId: z.string().uuid().optional(),
});

export const taskActionSchema = z.object({
  action: z.enum(HOUSEKEEPING_ACTIONS),
  assignedToId: z.string().uuid().optional(),
  note: note.optional(),
});

export const tasksQuerySchema = z.object({
  status: z.enum(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'CLEANED', 'DONE', 'CANCELLED']).optional(),
  mine: z.enum(['true', 'false']).optional(),
  open: z.enum(['true', 'false']).optional(),
});

// ---------------------------------------------------------------- maintenance
export const createTicketSchema = z.object({
  title: z.string().trim().min(3, 'Describe the problem briefly').max(120),
  description: note,
  category: z.enum(MAINTENANCE_CATEGORIES),
  priority: z.enum(TASK_PRIORITIES),
  roomId: z.string().uuid().optional(),
  /** Take the room out of the available pool while it is fixed. */
  blocksRoom: z.boolean(),
});

export const ticketActionSchema = z.object({
  action: z.enum(MAINTENANCE_ACTIONS),
  assignedToId: z.string().uuid().optional(),
  note: note.optional(),
});

export const ticketWorkSchema = z.object({
  costMinor: z.number().int().min(0).max(1_000_000_000).optional(),
  minutesSpent: z.number().int().min(0).max(100_000).optional(),
  partsUsed: z.string().trim().max(300).optional(),
  resolutionNote: z.string().trim().max(500).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
});

export const ticketsQuerySchema = z.object({
  status: z.enum(['REPORTED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_PARTS', 'RESOLVED', 'CLOSED']).optional(),
  open: z.enum(['true', 'false']).optional(),
  mine: z.enum(['true', 'false']).optional(),
});

// ---------------------------------------------------------------- front desk
export const extendStaySchema = z.object({ departureDate: dateSchema });

// ---------------------------------------------------------------- staff
export const scopeSchema = z.object({
  roleId: z.string().uuid('Choose a role'),
  scopeType: z.enum(['ORGANIZATION', 'GROUP', 'PROPERTY']),
  scopeId: z.string().uuid(),
});

export const inviteStaffSchema = z.object({
  firstName: z.string().trim().min(1, 'Enter a first name').max(80),
  lastName: z.string().trim().min(1, 'Enter a last name').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email').max(254),
  assignment: scopeSchema,
});

export const staffQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(80).optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type TaskActionInput = z.infer<typeof taskActionSchema>;
export type TasksQuery = z.infer<typeof tasksQuerySchema>;
export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type TicketActionInput = z.infer<typeof ticketActionSchema>;
export type TicketWorkInput = z.infer<typeof ticketWorkSchema>;
export type TicketsQuery = z.infer<typeof ticketsQuerySchema>;
export type ExtendStayInput = z.infer<typeof extendStaySchema>;
export type ScopeInput = z.infer<typeof scopeSchema>;
export type InviteStaffInput = z.infer<typeof inviteStaffSchema>;
export type StaffQuery = z.infer<typeof staffQuerySchema>;
