import { z } from 'zod';
export declare const roomTypeSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodString;
    maxOccupancy: z.ZodNumber;
    bedConfiguration: z.ZodString;
    amenities: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    description: string;
    name: string;
    maxOccupancy: number;
    bedConfiguration: string;
    amenities: string[];
}, {
    description: string;
    name: string;
    maxOccupancy: number;
    bedConfiguration: string;
    amenities: string[];
}>;
export declare const updateRoomTypeSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    maxOccupancy: z.ZodOptional<z.ZodNumber>;
    bedConfiguration: z.ZodOptional<z.ZodString>;
    amenities: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    description?: string | undefined;
    name?: string | undefined;
    maxOccupancy?: number | undefined;
    bedConfiguration?: string | undefined;
    amenities?: string[] | undefined;
}, {
    description?: string | undefined;
    name?: string | undefined;
    maxOccupancy?: number | undefined;
    bedConfiguration?: string | undefined;
    amenities?: string[] | undefined;
}>;
export declare const roomSchema: z.ZodObject<{
    number: z.ZodString;
    roomTypeId: z.ZodString;
    floorId: z.ZodUnion<[z.ZodLiteral<"">, z.ZodString]>;
    notes: z.ZodString;
}, "strip", z.ZodTypeAny, {
    number: string;
    notes: string;
    roomTypeId: string;
    floorId: string;
}, {
    number: string;
    notes: string;
    roomTypeId: string;
    floorId: string;
}>;
export declare const updateRoomSchema: z.ZodObject<{
    number: z.ZodOptional<z.ZodString>;
    roomTypeId: z.ZodOptional<z.ZodString>;
    floorId: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<"">, z.ZodString]>>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    number?: string | undefined;
    notes?: string | undefined;
    roomTypeId?: string | undefined;
    floorId?: string | undefined;
}, {
    number?: string | undefined;
    notes?: string | undefined;
    roomTypeId?: string | undefined;
    floorId?: string | undefined;
}>;
export declare const roomStatusSchema: z.ZodObject<{
    status: z.ZodEnum<["AVAILABLE", "DIRTY", "CLEANING", "CLEAN", "INSPECTED", "OUT_OF_ORDER", "OUT_OF_SERVICE", "MAINTENANCE"]>;
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "MAINTENANCE" | "AVAILABLE" | "DIRTY" | "CLEANING" | "CLEAN" | "INSPECTED" | "OUT_OF_ORDER" | "OUT_OF_SERVICE";
    note?: string | undefined;
}, {
    status: "MAINTENANCE" | "AVAILABLE" | "DIRTY" | "CLEANING" | "CLEAN" | "INSPECTED" | "OUT_OF_ORDER" | "OUT_OF_SERVICE";
    note?: string | undefined;
}>;
export declare const roomsQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
    status: z.ZodOptional<z.ZodEnum<["AVAILABLE", "DIRTY", "CLEANING", "CLEAN", "INSPECTED", "OUT_OF_ORDER", "OUT_OF_SERVICE", "MAINTENANCE"]>>;
    roomTypeId: z.ZodOptional<z.ZodString>;
    floorId: z.ZodOptional<z.ZodString>;
    search: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    status?: "MAINTENANCE" | "AVAILABLE" | "DIRTY" | "CLEANING" | "CLEAN" | "INSPECTED" | "OUT_OF_ORDER" | "OUT_OF_SERVICE" | undefined;
    search?: string | undefined;
    roomTypeId?: string | undefined;
    floorId?: string | undefined;
}, {
    status?: "MAINTENANCE" | "AVAILABLE" | "DIRTY" | "CLEANING" | "CLEAN" | "INSPECTED" | "OUT_OF_ORDER" | "OUT_OF_SERVICE" | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    search?: string | undefined;
    roomTypeId?: string | undefined;
    floorId?: string | undefined;
}>;
export type RoomTypeInput = z.infer<typeof roomTypeSchema>;
export type UpdateRoomTypeInput = z.infer<typeof updateRoomTypeSchema>;
export type RoomInput = z.infer<typeof roomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
export type RoomStatusInput = z.infer<typeof roomStatusSchema>;
export type RoomsQuery = z.infer<typeof roomsQuerySchema>;
