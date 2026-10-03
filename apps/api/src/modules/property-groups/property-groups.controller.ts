import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { propertyGroupSchema } from '@pms/validation';
import type { PropertyGroupInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Access, RequirePermission } from '../rbac/decorators/access.decorators';
import { PropertyGroupsService } from './property-groups.service';

@Controller('property-groups')
export class PropertyGroupsController {
  constructor(private readonly groups: PropertyGroupsService) {}

  @RequirePermission('property_group.read')
  @Get()
  list() {
    return this.groups.list();
  }

  @RequirePermission('property_group.manage')
  @Post()
  create(@Body(new ZodValidationPipe(propertyGroupSchema)) dto: PropertyGroupInput, @Access() access: AccessContext) {
    return this.groups.create(dto, access);
  }

  @RequirePermission('property_group.manage')
  @Patch(':id')
  rename(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(propertyGroupSchema)) dto: PropertyGroupInput, @Access() access: AccessContext) {
    return this.groups.rename(id, dto, access);
  }

  @RequirePermission('property_group.manage')
  @HttpCode(200)
  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext) {
    await this.groups.remove(id, access);
    return null;
  }
}
