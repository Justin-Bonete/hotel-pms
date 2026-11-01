import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { inviteStaffSchema, scopeSchema, staffQuerySchema } from '@pms/validation';
import type { InviteStaffInput, ScopeInput, StaffQuery } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Access, RequirePermission } from '../rbac/decorators/access.decorators';
import { StaffService } from './staff.service';

@Controller('staff')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @RequirePermission('staff.read')
  @Get()
  list(@Query(new ZodValidationPipe(staffQuerySchema)) query: StaffQuery, @Access() access: AccessContext) {
    return this.staff.list(query, access);
  }

  @RequirePermission('staff.manage')
  @Post()
  invite(@Body(new ZodValidationPipe(inviteStaffSchema)) dto: InviteStaffInput, @Access() access: AccessContext) {
    return this.staff.invite(dto, access);
  }

  @RequirePermission('staff.manage')
  @HttpCode(200)
  @Post(':id/resend-invite')
  async resend(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext) {
    await this.staff.resendInvite(id, access);
    return { message: 'Invitation sent again.' };
  }

  @RequirePermission('role.assign')
  @Post(':id/assignments')
  add(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(scopeSchema)) dto: ScopeInput, @Access() access: AccessContext) {
    return this.staff.addAssignment(id, dto, access);
  }

  @RequirePermission('role.assign')
  @HttpCode(200)
  @Delete(':id/assignments/:assignmentId')
  remove(@Param('id', ParseUUIDPipe) id: string, @Param('assignmentId', ParseUUIDPipe) assignmentId: string, @Access() access: AccessContext) {
    return this.staff.removeAssignment(id, assignmentId, access);
  }

  @RequirePermission('staff.manage')
  @HttpCode(200)
  @Post(':id/disable')
  disable(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext) {
    return this.staff.setActive(id, false, access);
  }

  @RequirePermission('staff.manage')
  @HttpCode(200)
  @Post(':id/enable')
  enable(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext) {
    return this.staff.setActive(id, true, access);
  }
}
