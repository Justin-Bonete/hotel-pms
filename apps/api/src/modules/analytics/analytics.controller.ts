import { Controller, Get, Query } from '@nestjs/common';
import { analyticsQuerySchema } from '@pms/validation';
import type { AnalyticsQuery } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Access, RequirePermission } from '../rbac/decorators/access.decorators';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  /** Without propertyId: every property the caller may see. */
  @RequirePermission('analytics.read')
  @Get('overview')
  overview(@Query(new ZodValidationPipe(analyticsQuerySchema)) query: AnalyticsQuery, @Access() access: AccessContext) {
    return this.analytics.overview(query, access);
  }
}
