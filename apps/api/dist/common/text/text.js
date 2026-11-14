"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.slugify = slugify;
exports.emptyToNull = emptyToNull;
function slugify(name) {
    const base = name
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40);
    return base || 'item';
}
/** Forms send '' for empty optional text. undefined = leave alone, '' / whitespace = clear (null). */
function emptyToNull(value) {
    if (value === undefined)
        return undefined;
    if (value === null)
        return null;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
}
//# sourceMappingURL=text.js.map