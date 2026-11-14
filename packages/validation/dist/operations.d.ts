import { z } from 'zod';
export declare const createTaskSchema: z.ZodObject<{
    roomId: z.ZodString;
    type: z.ZodEnum<["CHECKOUT_CLEAN", "STAYOVER", "DEEP_CLEAN"]>;
    priority: z.ZodEnum<["LOW", "NORMAL", "HIGH", "URGENT"]>;
    estimatedMinutes: z.ZodOptional<z.ZodNumber>;
    notes: z.ZodString;
    assignedToId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "CHECKOUT_CLEAN" | "STAYOVER" | "DEEP_CLEAN";
    notes: string;
    roomId: string;
    priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
    estimatedMinutes?: number | undefined;
    assignedToId?: string | undefined;
}, {
    type: "CHECKOUT_CLEAN" | "STAYOVER" | "DEEP_CLEAN";
    notes: string;
    roomId: string;
    priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
    estimatedMinutes?: number | undefined;
    assignedToId?: string | undefined;
}>;
export declare const taskActionSchema: z.ZodObject<{
    action: z.ZodEnum<["assign", "unassign", "start", "finish", "inspect_pass", "inspect_fail", "cancel"]>;
    assignedToId: z.ZodOptional<z.ZodString>;
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    action: "cancel" | "assign" | "unassign" | "start" | "finish" | "inspect_pass" | "inspect_fail";
    note?: string | undefined;
    assignedToId?: string | undefined;
}, {
    action: "cancel" | "assign" | "unassign" | "start" | "finish" | "inspect_pass" | "inspect_fail";
    note?: string | undefined;
    assignedToId?: string | undefined;
}>;
export declare const tasksQuerySchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["OPEN", "ASSIGNED", "IN_PROGRESS", "CLEANED", "DONE", "CANCELLED"]>>;
    mine: z.ZodOptional<z.ZodEnum<["true", "false"]>>;
    open: z.ZodOptional<z.ZodEnum<["true", "false"]>>;
}, "strip", z.ZodTypeAny, {
    status?: "CANCELLED" | "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "CLEANED" | "DONE" | undefined;
    mine?: "true" | "false" | undefined;
    open?: "true" | "false" | undefined;
}, {
    status?: "CANCELLED" | "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "CLEANED" | "DONE" | undefined;
    mine?: "true" | "false" | undefined;
    open?: "true" | "false" | undefined;
}>;
export declare const createTicketSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodString;
    category: z.ZodEnum<["AIRCON", "PLUMBING", "ELECTRICAL", "FURNITURE", "INTERNET", "APPLIANCE", "STRUCTURAL", "OTHER"]>;
    priority: z.ZodEnum<["LOW", "NORMAL", "HIGH", "URGENT"]>;
    roomId: z.ZodOptional<z.ZodString>;
    /** Take the room out of the available pool while it is fixed. */
    blocksRoom: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    description: string;
    category: "OTHER" | "INTERNET" | "AIRCON" | "PLUMBING" | "ELECTRICAL" | "FURNITURE" | "APPLIANCE" | "STRUCTURAL";
    priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
    title: string;
    blocksRoom: boolean;
    roomId?: string | undefined;
}, {
    description: string;
    category: "OTHER" | "INTERNET" | "AIRCON" | "PLUMBING" | "ELECTRICAL" | "FURNITURE" | "APPLIANCE" | "STRUCTURAL";
    priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
    title: string;
    blocksRoom: boolean;
    roomId?: string | undefined;
}>;
export declare const ticketActionSchema: z.ZodObject<{
    action: z.ZodEnum<["assign", "start", "wait_parts", "resume", "resolve", "close", "reopen"]>;
    assignedToId: z.ZodOptional<z.ZodString>;
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    action: "assign" | "start" | "wait_parts" | "resume" | "resolve" | "close" | "reopen";
    note?: string | undefined;
    assignedToId?: string | undefined;
}, {
    action: "assign" | "start" | "wait_parts" | "resume" | "resolve" | "close" | "reopen";
    note?: string | undefined;
    assignedToId?: string | undefined;
}>;
export declare const ticketWorkSchema: z.ZodObject<{
    costMinor: z.ZodOptional<z.ZodNumber>;
    minutesSpent: z.ZodOptional<z.ZodNumber>;
    partsUsed: z.ZodOptional<z.ZodString>;
    resolutionNote: z.ZodOptional<z.ZodString>;
    priority: z.ZodOptional<z.ZodEnum<["LOW", "NORMAL", "HIGH", "URGENT"]>>;
}, "strip", z.ZodTypeAny, {
    priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT" | undefined;
    costMinor?: number | undefined;
    minutesSpent?: number | undefined;
    partsUsed?: string | undefined;
    resolutionNote?: string | undefined;
}, {
    priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT" | undefined;
    costMinor?: number | undefined;
    minutesSpent?: number | undefined;
    partsUsed?: string | undefined;
    resolutionNote?: string | undefined;
}>;
export declare const ticketsQuerySchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["REPORTED", "ASSIGNED", "IN_PROGRESS", "WAITING_PARTS", "RESOLVED", "CLOSED"]>>;
    open: z.ZodOptional<z.ZodEnum<["true", "false"]>>;
    mine: z.ZodOptional<z.ZodEnum<["true", "false"]>>;
}, "strip", z.ZodTypeAny, {
    status?: "ASSIGNED" | "IN_PROGRESS" | "REPORTED" | "WAITING_PARTS" | "RESOLVED" | "CLOSED" | undefined;
    mine?: "true" | "false" | undefined;
    open?: "true" | "false" | undefined;
}, {
    status?: "ASSIGNED" | "IN_PROGRESS" | "REPORTED" | "WAITING_PARTS" | "RESOLVED" | "CLOSED" | undefined;
    mine?: "true" | "false" | undefined;
    open?: "true" | "false" | undefined;
}>;
export declare const extendStaySchema: z.ZodObject<{
    departureDate: z.ZodEffects<z.ZodString, string, string>;
}, "strip", z.ZodTypeAny, {
    departureDate: string;
}, {
    departureDate: string;
}>;
export declare const scopeSchema: z.ZodObject<{
    roleId: z.ZodString;
    scopeType: z.ZodEnum<["ORGANIZATION", "GROUP", "PROPERTY"]>;
    scopeId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    roleId: string;
    scopeType: "GROUP" | "ORGANIZATION" | "PROPERTY";
    scopeId: string;
}, {
    roleId: string;
    scopeType: "GROUP" | "ORGANIZATION" | "PROPERTY";
    scopeId: string;
}>;
export declare const inviteStaffSchema: z.ZodObject<{
    firstName: z.ZodString;
    lastName: z.ZodString;
    email: z.ZodString;
    assignment: z.ZodObject<{
        roleId: z.ZodString;
        scopeType: z.ZodEnum<["ORGANIZATION", "GROUP", "PROPERTY"]>;
        scopeId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        roleId: string;
        scopeType: "GROUP" | "ORGANIZATION" | "PROPERTY";
        scopeId: string;
    }, {
        roleId: string;
        scopeType: "GROUP" | "ORGANIZATION" | "PROPERTY";
        scopeId: string;
    }>;
}, "strip", z.ZodTypeAny, {
    firstName: string;
    lastName: string;
    email: string;
    assignment: {
        roleId: string;
        scopeType: "GROUP" | "ORGANIZATION" | "PROPERTY";
        scopeId: string;
    };
}, {
    firstName: string;
    lastName: string;
    email: string;
    assignment: {
        roleId: string;
        scopeType: "GROUP" | "ORGANIZATION" | "PROPERTY";
        scopeId: string;
    };
}>;
export declare const staffQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
    search: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    search?: string | undefined;
}, {
    page?: number | undefined;
    pageSize?: number | undefined;
    search?: string | undefined;
}>;
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
