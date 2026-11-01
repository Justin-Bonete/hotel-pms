import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { createTaskSchema, taskActionSchema, tasksQuerySchema } from '@pms/validation';
import type { CreateTaskInput, TaskActionInput, TasksQuery } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Access, RequirePermission } from '../rbac/decorators/access.decorators';
import { HousekeepingService } from './housekeeping.service';

@Controller()
export class HousekeepingController {
  constructor(private readonly housekeeping: HousekeepingService) {}

  @RequirePermission('housekeeping.read')
  @Get('properties/:propertyId/housekeeping/tasks')
  list(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Query(new ZodValidationPipe(tasksQuerySchema)) query: TasksQuery, @Access() access: AccessContext) {
    return this.housekeeping.list(propertyId, query, access);
  }

  @RequirePermission('housekeeping.manage')
  @Get('properties/:propertyId/housekeeping/staff')
  staff(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Access() access: AccessContext) {
    return this.housekeeping.staff(propertyId, access);
  }

  @RequirePermission('housekeeping.manage')
  @Post('properties/:propertyId/housekeeping/tasks')
  create(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Body(new ZodValidationPipe(createTaskSchema)) dto: CreateTaskInput, @Access() access: AccessContext) {
    return this.housekeeping.create(propertyId, dto, access);
  }

  @RequirePermission('housekeeping.manage')
  @HttpCode(200)
  @Post('properties/:propertyId/housekeeping/generate-stayovers')
  generate(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Access() access: AccessContext) {
    return this.housekeeping.generateStayovers(propertyId, access);
  }

  /** Housekeepers start and finish their own tasks; supervisors do the rest. The service checks which. */
  @RequirePermission('housekeeping.read')
  @HttpCode(200)
  @Post('housekeeping/tasks/:id/action')
  action(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(taskActionSchema)) dto: TaskActionInput, @Access() access: AccessContext) {
    return this.housekeeping.action(id, dto, access);
  }
}
