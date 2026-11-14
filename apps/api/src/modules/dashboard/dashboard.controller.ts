import { Controller, Get, ParseUUIDPipe, Query } from '@nestjs/common';
import type { AccessContext } from '../../common/access/access-context';
import { Access, RequirePermission } from '../rbac/decorators/access.decorators';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  /** Without propertyId: every property the caller can see. With it: that one property. */
  @RequirePermission('reservation.read')
  @Get('today')
  today(@Query('propertyId', new ParseUUIDPipe({ optional: true })) propertyId: string | undefined, @Access() access: AccessContext) {
    return this.dashboard.today(propertyId, access);
  }
}
