import { CanActivate, ExecutionContext, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PermissionKey } from '@pms/types';
import { AppException } from '../../../common/http/app-exception';
import type { AuthenticatedRequest } from '../../../common/context/request-context';
import { IS_PUBLIC } from '../../auth/decorators/public.decorator';
import { AUTHENTICATED_ONLY, REQUIRE_PERMISSION } from '../decorators/access.decorators';
import { RbacService } from '../rbac.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Global guard, runs after JwtAuthGuard. DENY BY DEFAULT: every route must be @Public(),
 * @Authenticated() or @RequirePermission(...). A route with none of these is refused, so forgetting
 * a rule can never silently expose data.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly rbac: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC, targets)) return true;

    const required = this.reflector.getAllAndOverride<PermissionKey[] | undefined>(REQUIRE_PERMISSION, targets) ?? [];
    const authenticatedOnly = this.reflector.getAllAndOverride<boolean | undefined>(AUTHENTICATED_ONLY, targets) ?? false;

    if (required.length === 0 && !authenticatedOnly) {
      this.logger.error(`No access rule on ${context.getClass().name}.${context.getHandler().name}. Add @RequirePermission, @Authenticated or @Public.`);
      throw new AppException('ROUTE_NOT_CONFIGURED', 'This endpoint has no access rule and is blocked.', HttpStatus.FORBIDDEN);
    }

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!req.auth) throw new AppException('UNAUTHENTICATED', 'Please sign in to continue.', HttpStatus.UNAUTHORIZED);

    const header = req.header('x-property-id');
    const propertyId = parsePropertyHeader(header);

    // Routes that only need a login and no property context skip the database lookup.
    if (required.length === 0 && propertyId === null) return true;

    const access = await this.rbac.loadAccess(req.auth.userId, req.auth.organizationId);

    if (propertyId !== null) {
      if (!access.canSeeProperty(propertyId)) {
        throw new AppException('PROPERTY_NOT_ACCESSIBLE', 'You do not have access to this property.', HttpStatus.FORBIDDEN);
      }
      access.setActiveProperty(propertyId);
    }

    for (const permission of required) {
      if (!access.can(permission, propertyId ?? undefined)) {
        throw new AppException('FORBIDDEN', 'You do not have permission to do this.', HttpStatus.FORBIDDEN);
      }
    }

    req.access = access;
    return true;
  }
}

/** X-Property-Id: absent or "ALL" = all properties; otherwise a property UUID. */
function parsePropertyHeader(value: string | undefined): string | null {
  if (value === undefined || value === '' || value.toUpperCase() === 'ALL') return null;
  if (!UUID.test(value)) {
    throw new AppException('INVALID_PROPERTY_HEADER', 'X-Property-Id must be "ALL" or a property id.', HttpStatus.BAD_REQUEST);
  }
  return value;
}
