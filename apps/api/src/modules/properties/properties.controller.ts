import { Controller, Get, Query } from '@nestjs/common';
import { paginationSchema } from '@pms/validation';
import type { PaginationInput } from '@pms/validation';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PropertiesService } from './properties.service';

// TODO(step 5): add @RequirePermission('property.read') and property-scope filtering.
@Controller('properties')
export class PropertiesController {
  constructor(private readonly properties: PropertiesService) {}

  @Get()
  list(@Query(new ZodValidationPipe(paginationSchema)) query: PaginationInput) {
    return this.properties.list(query);
  }
}
