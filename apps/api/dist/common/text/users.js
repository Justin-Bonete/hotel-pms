"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userNames = userNames;
/** id -> "First Last" for records that store a user id without a relation (who requested, approved, recorded...). */
async function userNames(tx, ids) {
    const wanted = [...new Set(ids.filter((x) => Boolean(x)))];
    if (wanted.length === 0)
        return new Map();
    const users = await tx.user.findMany({ where: { id: { in: wanted } }, select: { id: true, firstName: true, lastName: true } });
    return new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
}
//# sourceMappingURL=users.js.map