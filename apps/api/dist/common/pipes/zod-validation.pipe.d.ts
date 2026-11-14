import { PipeTransform } from '@nestjs/common';
import type { ZodTypeAny } from 'zod';
/** Usage: @Body(new ZodValidationPipe(createPropertySchema)) dto: CreatePropertyInput */
export declare class ZodValidationPipe implements PipeTransform {
    private readonly schema;
    constructor(schema: ZodTypeAny);
    transform(value: unknown): unknown;
}
