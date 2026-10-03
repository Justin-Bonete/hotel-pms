import { ExecutionContext, HttpStatus, SetMetadata, createParamDecorator } from '@nestjs/common';
import type { PermissionKey } from '@pms/types';
import type { AccessContext } from '../../../common/access/access-context';
import { AppException } from '../../../common/http/app-exception';
import type { AuthenticatedRequest } from '../../../common/context/request-context';

export const REQUIRE_PERMISSION = 'requirePermission';
export const AUTHENTICATED_ONLY = 'authenticatedOnly';

/** The caller must hold ALL listed permissions (for the property chosen in the switcher, if any). */
export const RequirePermission = (...permissions: PermissionKey[]) => SetMetadata(REQUIRE_PERMISSION, permissions);

/** Any signed-in user may call this (profile, own devices). Makes the "no rule = denied" default explicit. */
export const Authenticated = () => SetMetadata(AUTHENTICATED_ONLY, true);

/** Injects the caller's AccessContext. Only available on routes that use @RequirePermission. */
export const Access = createParamDecorator((_data: unknown, ctx: ExecutionContext): AccessContext => {
  const access = ctx.switchToHttp().getRequest<AuthenticatedRequest>().access;
  if (!access) {
    throw new AppException('ACCESS_NOT_LOADED', 'This route did not declare a permission.', HttpStatus.INTERNAL_SERVER_ERROR);
  }
  return access;
});
