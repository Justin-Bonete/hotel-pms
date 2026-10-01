import { HttpStatus, PipeTransform } from '@nestjs/common';
import type { ZodTypeAny } from 'zod';
import { AppException } from '../http/app-exception';

/** Usage: @Body(new ZodValidationPipe(createPropertySchema)) dto: CreatePropertyInput */
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodTypeAny) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new AppException(
        'VALIDATION_ERROR',
        'Some fields need attention.',
        HttpStatus.BAD_REQUEST,
        result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      );
    }
    return result.data;
  }
}
