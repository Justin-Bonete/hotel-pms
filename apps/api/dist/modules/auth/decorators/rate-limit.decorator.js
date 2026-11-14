"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimit = exports.RATE_LIMIT = void 0;
const common_1 = require("@nestjs/common");
exports.RATE_LIMIT = 'rateLimit';
const RateLimit = (options) => (0, common_1.SetMetadata)(exports.RATE_LIMIT, options);
exports.RateLimit = RateLimit;
//# sourceMappingURL=rate-limit.decorator.js.map