/**
 * Room nights in date order, each tax line directly under the charge it was calculated on, voids next to
 * the lines they cancel, and extras (no service date) last. Lines saved in one batch share a timestamp,
 * so database order alone is not enough.
 */
export declare function orderForDisplay<T extends {
    id: string;
    parentItemId: string | null;
    serviceDate: Date | null;
    createdAt: Date;
    reversesItemId: string | null;
}>(items: readonly T[]): T[];
