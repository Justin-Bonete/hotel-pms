import { type ScopeType } from '@pms/types';
import type { AccessContext, PropertyRef } from './access-context';
/**
 * "You can't give someone more access than you have."
 *
 * May `access` assign a role holding `permissions` at the given scope?
 *  - ORGANIZATION: the assigner must hold every permission across the whole organization.
 *  - GROUP: the assigner must hold every property-level permission at EVERY property of the group
 *    (an empty group needs organization-wide access, because properties added later would inherit it).
 *  - PROPERTY: the assigner must hold every property-level permission at that property.
 * Organization-level permissions have no effect when granted below organization scope, so they need no check there.
 * An unknown permission key can never be granted (fail closed).
 */
export declare function canGrant(access: AccessContext, permissions: readonly string[], scopeType: ScopeType, scopeId: string, properties: readonly PropertyRef[]): boolean;
