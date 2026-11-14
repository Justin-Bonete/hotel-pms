"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.badRequest = exports.conflict = exports.notFound = void 0;
const common_1 = require("@nestjs/common");
const app_exception_1 = require("./app-exception");
const notFound = (what) => new app_exception_1.AppException('NOT_FOUND', `${what} was not found.`, common_1.HttpStatus.NOT_FOUND);
exports.notFound = notFound;
const conflict = (code, message) => new app_exception_1.AppException(code, message, common_1.HttpStatus.CONFLICT);
exports.conflict = conflict;
const badRequest = (code, message) => new app_exception_1.AppException(code, message, common_1.HttpStatus.BAD_REQUEST);
exports.badRequest = badRequest;
//# sourceMappingURL=errors.js.map