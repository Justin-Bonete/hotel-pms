"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccessContext = void 0;
const types_1 = require("@pms/types");
const NONE = { all: false, ids: new Set() };
const EVERYTHING = { all: true };
/**
 * What one user may do, and on which properties. Built from role assignments, so a user can be
 * Owner of the company, Manager of one group and Front Desk at one property at the same time.
 *
 * Rules
 *  - ORGANIZATION-level permissions count only through an ORGANIZATION-scope assignment.
 *  - PROPERTY-level permissions count everywhere (org scope), in a group's properties (group scope),
 *    or at one property (property scope).
 *  - Unknown permission keys and stale grants (deleted property) grant nothing: fail closed.
 */
class AccessContext {
    userId;
    organizationId;
    grants;
    scopes = new Map();
    visible;
    active = null;
    constructor(userId, organizationId, grants, properties) {
        this.userId = userId;
        this.organizationId = organizationId;
        this.grants = grants;
        const existing = new Set(properties.map((p) => p.id));
        const building = new Map();
        let visibleAll = false;
        const visibleIds = new Set();
        for (const grant of grants) {
            const covered = coverage(grant, properties, existing);
            if (covered === 'ALL')
                visibleAll = true;
            else
                covered.forEach((id) => visibleIds.add(id));
            for (const raw of grant.permissions) {
                const key = raw;
                const level = types_1.PERMISSION_LEVEL[key];
                if (!level)
                    continue;
                if (grant.scopeType === 'ORGANIZATION') {
                    building.set(key, { all: true, ids: building.get(key)?.ids ?? new Set() });
                }
                else if (level === 'PROPERTY' && covered !== 'ALL' && covered.length > 0) {
                    const entry = building.get(key) ?? { all: false, ids: new Set() };
                    covered.forEach((id) => entry.ids.add(id));
                    building.set(key, entry);
                }
                // ORGANIZATION-level permission through group/property scope: ignored on purpose.
            }
        }
        for (const [key, entry] of building)
            this.scopes.set(key, entry.all ? EVERYTHING : { all: false, ids: entry.ids });
        this.visible = visibleAll ? EVERYTHING : { all: false, ids: visibleIds };
    }
    get activePropertyId() {
        return this.active;
    }
    /** Set by the guard from the X-Property-Id header after it verified access. null = all properties. */
    setActiveProperty(propertyId) {
        this.active = propertyId;
    }
    /** Does the user hold this permission (optionally: for this property)? */
    can(permission, propertyId) {
        const scope = this.scopes.get(permission);
        if (!scope)
            return false;
        if (propertyId === undefined)
            return true;
        return scope.all || scope.ids.has(propertyId);
    }
    /** Every property where the permission applies. Ignores the property switcher: use for pickers and lists. */
    scopeOf(permission) {
        return this.scopes.get(permission) ?? NONE;
    }
    /** Like scopeOf, but narrowed to the property chosen in the switcher (if any). Use for data screens. */
    scopeInActive(permission) {
        const scope = this.scopeOf(permission);
        if (this.active === null)
            return scope;
        return this.can(permission, this.active) ? { all: false, ids: new Set([this.active]) } : NONE;
    }
    /** Can the user see this property at all, through any role? */
    canSeeProperty(propertyId) {
        return this.visible.all || this.visible.ids.has(propertyId);
    }
    toSummary() {
        const permissions = {};
        for (const [key, scope] of this.scopes) {
            permissions[key] = scope.all ? { all: true, propertyIds: [] } : { all: false, propertyIds: [...scope.ids] };
        }
        return {
            roles: this.grants.map((g) => ({ key: g.roleKey, scopeType: g.scopeType, scopeId: g.scopeId })),
            permissions,
            visibleProperties: this.visible.all ? 'ALL' : [...this.visible.ids],
        };
    }
}
exports.AccessContext = AccessContext;
function coverage(grant, properties, existing) {
    switch (grant.scopeType) {
        case 'ORGANIZATION':
            return 'ALL';
        case 'GROUP':
            return properties.filter((p) => p.groupId === grant.scopeId).map((p) => p.id);
        case 'PROPERTY':
            return existing.has(grant.scopeId) ? [grant.scopeId] : [];
    }
}
//# sourceMappingURL=access-context.js.map