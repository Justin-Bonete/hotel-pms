import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RbacService } from '../rbac.service';
/**
 * Global guard, runs after JwtAuthGuard. DENY BY DEFAULT: every route must be @Public(),
 * @Authenticated() or @RequirePermission(...). A route with none of these is refused, so forgetting
 * a rule can never silently expose data.
 */
export declare class PermissionsGuard implements CanActivate {
    private readonly reflector;
    private readonly rbac;
    private readonly logger;
    constructor(reflector: Reflector, rbac: RbacService);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
