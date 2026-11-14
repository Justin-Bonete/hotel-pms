import type { PermissionKey } from '@pms/types';
export declare const REQUIRE_PERMISSION = "requirePermission";
export declare const AUTHENTICATED_ONLY = "authenticatedOnly";
/** The caller must hold ALL listed permissions (for the property chosen in the switcher, if any). */
export declare const RequirePermission: (...permissions: PermissionKey[]) => import("@nestjs/common").CustomDecorator<string>;
/** Any signed-in user may call this (profile, own devices). Makes the "no rule = denied" default explicit. */
export declare const Authenticated: () => import("@nestjs/common").CustomDecorator<string>;
/** Injects the caller's AccessContext. Only available on routes that use @RequirePermission. */
export declare const Access: (...dataOrPipes: unknown[]) => ParameterDecorator;
