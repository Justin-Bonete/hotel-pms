"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppException = void 0;
const common_1 = require("@nestjs/common");
/** Domain error with a stable machine-readable code and a human-readable message. */
class AppException extends common_1.HttpException {
    code;
    details;
    constructor(code, message, status = common_1.HttpStatus.BAD_REQUEST, details) {
        super({ code, message, details }, status);
        this.code = code;
        this.details = details;
    }
}
exports.AppException = AppException;
//# sourceMappingURL=app-exception.js.map