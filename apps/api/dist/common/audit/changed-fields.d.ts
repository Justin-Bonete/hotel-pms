type Json = string | number | boolean | null | string[];
/** Before/after of ONLY the fields that changed, ready for the audit log. */
export declare function changedFields<T extends object>(before: T, after: T, keys: readonly (keyof T & string)[]): {
    before: Record<string, Json>;
    after: Record<string, Json>;
    changed: string[];
};
export {};
