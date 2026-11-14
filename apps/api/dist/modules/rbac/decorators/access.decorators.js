"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Access = exports.Authenticated = exports.RequirePermission = exports.AUTHENTICATED_ONLY = exports.REQUIRE_PERMISSION = void 0;
const common_1 = require("@nestjs/common");
const app_exception_1 = require("../../../common/http/app-exception");
exports.REQUIRE_PERMISSION = 'requirePermission';
exports.AUTHENTICATED_ONLY = 'authenticatedOnly';
/** The caller must hold ALL listed permissions (for the property chosen in the switcher, if any). */
const RequirePermission = (...permissions) => (0, common_1.SetMetadata)(exports.REQUIRE_PERMISSION, permissions);
exports.RequirePermission = RequirePermission;
/** Any signed-in user may call this (profile, own devices). Makes the "no rule = denied" default explicit. */
const Authenticated = () => (0, common_1.SetMetadata)(exports.AUTHENTICATED_ONLY, true);
exports.Authenticated = Authenticated;
/** Injects the caller's AccessContext. Only available on routes that use @RequirePermission. */
exports.Access = (0, common_1.createParamDecorator)((_data, ctx) => {
    const access = ctx.switchToHttp().getRequest().access;
    if (!access) {
        throw new app_exception_1.AppException('ACCESS_NOT_LOADED', 'This route did not declare a permission.', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
    }
    return access;
});
//# sourceMappingURL=access.decorators.js.map