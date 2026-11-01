import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { createTicketSchema, ticketActionSchema, ticketWorkSchema, ticketsQuerySchema } from '@pms/validation';
import type { CreateTicketInput, TicketActionInput, TicketWorkInput, TicketsQuery } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Access, RequirePermission } from '../rbac/decorators/access.decorators';
import { MaintenanceService } from './maintenance.service';

@Controller()
export class MaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}

  @RequirePermission('maintenance.read')
  @Get('properties/:propertyId/maintenance/tickets')
  list(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Query(new ZodValidationPipe(ticketsQuerySchema)) query: TicketsQuery, @Access() access: AccessContext) {
    return this.maintenance.list(propertyId, query, access);
  }

  @RequirePermission('maintenance.manage')
  @Get('properties/:propertyId/maintenance/staff')
  staff(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Access() access: AccessContext) {
    return this.maintenance.staff(propertyId, access);
  }

  @RequirePermission('maintenance.report')
  @Post('properties/:propertyId/maintenance/tickets')
  create(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Body(new ZodValidationPipe(createTicketSchema)) dto: CreateTicketInput, @Access() access: AccessContext) {
    return this.maintenance.create(propertyId, dto, access);
  }

  @RequirePermission('maintenance.read')
  @HttpCode(200)
  @Post('maintenance/tickets/:id/action')
  action(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(ticketActionSchema)) dto: TicketActionInput, @Access() access: AccessContext) {
    return this.maintenance.action(id, dto, access);
  }

  @RequirePermission('maintenance.read')
  @Patch('maintenance/tickets/:id')
  logWork(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(ticketWorkSchema)) dto: TicketWorkInput, @Access() access: AccessContext) {
    return this.maintenance.logWork(id, dto, access);
  }
}
