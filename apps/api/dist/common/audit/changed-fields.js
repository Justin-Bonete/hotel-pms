"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.changedFields = changedFields;
const normalise = (value) => {
    if (value instanceof Date)
        return value.toISOString();
    if (value === undefined || value === null)
        return null;
    return value;
};
/** Before/after of ONLY the fields that changed, ready for the audit log. */
function changedFields(before, after, keys) {
    const b = {};
    const a = {};
    for (const key of keys) {
        const x = normalise(before[key]);
        const y = normalise(after[key]);
        if (JSON.stringify(x) !== JSON.stringify(y)) {
            b[key] = x;
            a[key] = y;
        }
    }
    return { before: b, after: a, changed: Object.keys(a) };
}
//# sourceMappingURL=changed-fields.js.map