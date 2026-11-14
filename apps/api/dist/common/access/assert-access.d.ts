import type { PermissionKey } from '@pms/types';
import type { AccessContext } from './access-context';
/**
 * For routes that name a property in the URL. A property the user cannot see at all answers 404
 * (so its existence is not revealed); a visible property without the permission answers 403.
 */
export declare function assertCan(access: AccessContext, permission: PermissionKey, propertyId: string): void;
