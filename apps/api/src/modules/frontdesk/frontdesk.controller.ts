import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import type { AccessContext } from '../../common/access/access-context';
import { Access, RequirePermission } from '../rbac/decorators/access.decorators';
import { FrontDeskService } from './frontdesk.service';

@Controller()
export class FrontDeskController {
  constructor(private readonly frontDesk: FrontDeskService) {}

  @RequirePermission('reservation.read')
  @Get('properties/:propertyId/front-desk')
  get(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Access() access: AccessContext) {
    return this.frontDesk.get(propertyId, access);
  }
}
