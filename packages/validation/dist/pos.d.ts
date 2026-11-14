import { z } from 'zod';
export declare const outletSchema: z.ZodObject<{
    name: z.ZodString;
    type: z.ZodEnum<["RESTAURANT", "BAR", "CAFE", "ROOM_SERVICE", "MINIBAR", "SPA", "LAUNDRY", "OTHER"]>;
}, "strip", z.ZodTypeAny, {
    type: "OTHER" | "RESTAURANT" | "BAR" | "CAFE" | "ROOM_SERVICE" | "MINIBAR" | "SPA" | "LAUNDRY";
    name: string;
}, {
    type: "OTHER" | "RESTAURANT" | "BAR" | "CAFE" | "ROOM_SERVICE" | "MINIBAR" | "SPA" | "LAUNDRY";
    name: string;
}>;
export declare const updateOutletSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodEnum<["RESTAURANT", "BAR", "CAFE", "ROOM_SERVICE", "MINIBAR", "SPA", "LAUNDRY", "OTHER"]>>;
}, "strip", z.ZodTypeAny, {
    type?: "OTHER" | "RESTAURANT" | "BAR" | "CAFE" | "ROOM_SERVICE" | "MINIBAR" | "SPA" | "LAUNDRY" | undefined;
    name?: string | undefined;
}, {
    type?: "OTHER" | "RESTAURANT" | "BAR" | "CAFE" | "ROOM_SERVICE" | "MINIBAR" | "SPA" | "LAUNDRY" | undefined;
    name?: string | undefined;
}>;
export declare const posItemSchema: z.ZodObject<{
    outletId: z.ZodString;
    name: z.ZodString;
    category: z.ZodString;
    priceMinor: z.ZodNumber;
    taxable: z.ZodBoolean;
    /** Selling it uses up this stock item. */
    inventoryItemId: z.ZodOptional<z.ZodString>;
    inventoryQuantity: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    name: string;
    taxable: boolean;
    category: string;
    outletId: string;
    priceMinor: number;
    inventoryQuantity: number;
    inventoryItemId?: string | undefined;
}, {
    name: string;
    taxable: boolean;
    category: string;
    outletId: string;
    priceMinor: number;
    inventoryQuantity: number;
    inventoryItemId?: string | undefined;
}>;
export declare const updatePosItemSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodString>;
    priceMinor: z.ZodOptional<z.ZodNumber>;
    taxable: z.ZodOptional<z.ZodBoolean>;
    inventoryItemId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    inventoryQuantity: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    taxable?: boolean | undefined;
    category?: string | undefined;
    priceMinor?: number | undefined;
    inventoryItemId?: string | null | undefined;
    inventoryQuantity?: number | undefined;
}, {
    name?: string | undefined;
    taxable?: boolean | undefined;
    category?: string | undefined;
    priceMinor?: number | undefined;
    inventoryItemId?: string | null | undefined;
    inventoryQuantity?: number | undefined;
}>;
/** Prices are NOT sent by the client: the server uses the menu price at the moment of sale. */
export declare const createPosOrderSchema: z.ZodEffects<z.ZodObject<{
    outletId: z.ZodString;
    lines: z.ZodArray<z.ZodObject<{
        itemId: z.ZodString;
        quantity: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        quantity: number;
        itemId: string;
    }, {
        quantity: number;
        itemId: string;
    }>, "many">;
    settlement: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        type: z.ZodLiteral<"PAY_NOW">;
        method: z.ZodEnum<["CASH", "CARD", "BANK_TRANSFER", "E_WALLET", "OTHER"]>;
    }, "strip", z.ZodTypeAny, {
        type: "PAY_NOW";
        method: "OTHER" | "CASH" | "CARD" | "BANK_TRANSFER" | "E_WALLET";
    }, {
        type: "PAY_NOW";
        method: "OTHER" | "CASH" | "CARD" | "BANK_TRANSFER" | "E_WALLET";
    }>, z.ZodObject<{
        type: z.ZodLiteral<"ROOM_CHARGE">;
        reservationId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "ROOM_CHARGE";
        reservationId: string;
    }, {
        type: "ROOM_CHARGE";
        reservationId: string;
    }>]>;
    tableLabel: z.ZodString;
    note: z.ZodString;
}, "strip", z.ZodTypeAny, {
    note: string;
    lines: {
        quantity: number;
        itemId: string;
    }[];
    outletId: string;
    settlement: {
        type: "PAY_NOW";
        method: "OTHER" | "CASH" | "CARD" | "BANK_TRANSFER" | "E_WALLET";
    } | {
        type: "ROOM_CHARGE";
        reservationId: string;
    };
    tableLabel: string;
}, {
    note: string;
    lines: {
        quantity: number;
        itemId: string;
    }[];
    outletId: string;
    settlement: {
        type: "PAY_NOW";
        method: "OTHER" | "CASH" | "CARD" | "BANK_TRANSFER" | "E_WALLET";
    } | {
        type: "ROOM_CHARGE";
        reservationId: string;
    };
    tableLabel: string;
}>, {
    note: string;
    lines: {
        quantity: number;
        itemId: string;
    }[];
    outletId: string;
    settlement: {
        type: "PAY_NOW";
        method: "OTHER" | "CASH" | "CARD" | "BANK_TRANSFER" | "E_WALLET";
    } | {
        type: "ROOM_CHARGE";
        reservationId: string;
    };
    tableLabel: string;
}, {
    note: string;
    lines: {
        quantity: number;
        itemId: string;
    }[];
    outletId: string;
    settlement: {
        type: "PAY_NOW";
        method: "OTHER" | "CASH" | "CARD" | "BANK_TRANSFER" | "E_WALLET";
    } | {
        type: "ROOM_CHARGE";
        reservationId: string;
    };
    tableLabel: string;
}>;
export declare const voidPosOrderSchema: z.ZodObject<{
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
}, {
    reason: string;
}>;
export declare const posOrdersQuerySchema: z.ZodObject<{
    date: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
}, "strip", z.ZodTypeAny, {
    date?: string | undefined;
}, {
    date?: string | undefined;
}>;
export type OutletInput = z.infer<typeof outletSchema>;
export type UpdateOutletInput = z.infer<typeof updateOutletSchema>;
export type PosItemInput = z.infer<typeof posItemSchema>;
export type UpdatePosItemInput = z.infer<typeof updatePosItemSchema>;
export type CreatePosOrderInput = z.infer<typeof createPosOrderSchema>;
export type VoidPosOrderInput = z.infer<typeof voidPosOrderSchema>;
export type PosOrdersQuery = z.infer<typeof posOrdersQuerySchema>;
