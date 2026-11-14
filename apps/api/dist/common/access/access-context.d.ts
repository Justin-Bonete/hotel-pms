import { type AccessSummary, type PermissionKey, type ScopeType } from '@pms/types';
export type PropertyScope = {
    readonly all: true;
} | {
    readonly all: false;
    readonly ids: ReadonlySet<string>;
};
export interface RoleGrant {
    roleKey: string;
    scopeType: ScopeType;
    scopeId: string;
    permissions: readonly string[];
}
export interface PropertyRef {
    id: string;
    groupId: string | null;
}
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
export declare class AccessContext {
    readonly userId: string;
    readonly organizationId: string;
    readonly grants: readonly RoleGrant[];
    private readonly scopes;
    private readonly visible;
    private active;
    constructor(userId: string, organizationId: string, grants: readonly RoleGrant[], properties: readonly PropertyRef[]);
    get activePropertyId(): string | null;
    /** Set by the guard from the X-Property-Id header after it verified access. null = all properties. */
    setActiveProperty(propertyId: string | null): void;
    /** Does the user hold this permission (optionally: for this property)? */
    can(permission: PermissionKey, propertyId?: string): boolean;
    /** Every property where the permission applies. Ignores the property switcher: use for pickers and lists. */
    scopeOf(permission: PermissionKey): PropertyScope;
    /** Like scopeOf, but narrowed to the property chosen in the switcher (if any). Use for data screens. */
    scopeInActive(permission: PermissionKey): PropertyScope;
    /** Can the user see this property at all, through any role? */
    canSeeProperty(propertyId: string): boolean;
    toSummary(): AccessSummary;
}
