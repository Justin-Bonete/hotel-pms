import { PERMISSION_LEVEL, type PermissionKey, type ScopeType } from '@pms/types';
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
export function canGrant(
  access: AccessContext,
  permissions: readonly string[],
  scopeType: ScopeType,
  scopeId: string,
  properties: readonly PropertyRef[],
): boolean {
  for (const raw of permissions) {
    const key = raw as PermissionKey;
    const level = PERMISSION_LEVEL[key];
    if (!level) return false;

    if (scopeType === 'ORGANIZATION') {
      if (!access.scopeOf(key).all) return false;
      continue;
    }
    if (level === 'ORGANIZATION') continue;

    if (scopeType === 'PROPERTY') {
      if (!access.can(key, scopeId)) return false;
    } else {
      const group = properties.filter((p) => p.groupId === scopeId);
      if (group.length === 0) {
        if (!access.scopeOf(key).all) return false;
      } else if (!group.every((p) => access.can(key, p.id))) {
        return false;
      }
    }
  }
  return true;
}
