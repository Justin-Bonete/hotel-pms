"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertCan = assertCan;
const common_1 = require("@nestjs/common");
const app_exception_1 = require("../http/app-exception");
/**
 * For routes that name a property in the URL. A property the user cannot see at all answers 404
 * (so its existence is not revealed); a visible property without the permission answers 403.
 */
function assertCan(access, permission, propertyId) {
    if (!access.canSeeProperty(propertyId)) {
        throw new app_exception_1.AppException('NOT_FOUND', 'The requested record was not found.', common_1.HttpStatus.NOT_FOUND);
    }
    if (!access.can(permission, propertyId)) {
        throw new app_exception_1.AppException('FORBIDDEN', 'You do not have permission to do this at this property.', common_1.HttpStatus.FORBIDDEN);
    }
}
//# sourceMappingURL=assert-access.js.map