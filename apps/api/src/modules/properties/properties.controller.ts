import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { createPropertySchema, paginationSchema, updatePropertySchema } from '@pms/validation';
import type { CreatePropertyInput, PaginationInput, UpdatePropertyInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Access, RequirePermission } from '../rbac/decorators/access.decorators';
import { PropertiesService } from './properties.service';

@Controller('properties')
export class PropertiesController {
  constructor(private readonly properties: PropertiesService) {}

  @RequirePermission('property.read')
  @Get()
  list(@Query(new ZodValidationPipe(paginationSchema)) query: PaginationInput, @Access() access: AccessContext) {
    // scopeOf (not scopeInActive): the property switcher needs the FULL list you may pick from.
    return this.properties.list(query, access.scopeOf('property.read'));
  }

  @RequirePermission('property.read')
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext) {
    return this.properties.get(id, access);
  }

  @RequirePermission('property.create')
  @Post()
  create(@Body(new ZodValidationPipe(createPropertySchema)) dto: CreatePropertyInput, @Access() access: AccessContext) {
    return this.properties.create(dto, access);
  }

  @RequirePermission('property.update')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updatePropertySchema)) dto: UpdatePropertyInput,
    @Access() access: AccessContext,
  ) {
    return this.properties.update(id, dto, access);
  }

  @RequirePermission('property.delete')
  @HttpCode(200)
  @Delete(':id')
  async archive(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext) {
    await this.properties.archive(id, access);
    return null;
  }
}
