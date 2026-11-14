"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZodValidationPipe = void 0;
const common_1 = require("@nestjs/common");
const app_exception_1 = require("../http/app-exception");
/** Usage: @Body(new ZodValidationPipe(createPropertySchema)) dto: CreatePropertyInput */
class ZodValidationPipe {
    schema;
    constructor(schema) {
        this.schema = schema;
    }
    transform(value) {
        const result = this.schema.safeParse(value);
        if (!result.success) {
            throw new app_exception_1.AppException('VALIDATION_ERROR', 'Some fields need attention.', common_1.HttpStatus.BAD_REQUEST, result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
        }
        return result.data;
    }
}
exports.ZodValidationPipe = ZodValidationPipe;
//# sourceMappingURL=zod-validation.pipe.js.map