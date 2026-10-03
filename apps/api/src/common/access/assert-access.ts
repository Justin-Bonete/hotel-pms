import { HttpStatus } from '@nestjs/common';
import type { PermissionKey } from '@pms/types';
import { AppException } from '../http/app-exception';
import type { AccessContext } from './access-context';

/**
 * For routes that name a property in the URL. A property the user cannot see at all answers 404
 * (so its existence is not revealed); a visible property without the permission answers 403.
 */
export function assertCan(access: AccessContext, permission: PermissionKey, propertyId: string): void {
  if (!access.canSeeProperty(propertyId)) {
    throw new AppException('NOT_FOUND', 'The requested record was not found.', HttpStatus.NOT_FOUND);
  }
  if (!access.can(permission, propertyId)) {
    throw new AppException('FORBIDDEN', 'You do not have permission to do this at this property.', HttpStatus.FORBIDDEN);
  }
}
