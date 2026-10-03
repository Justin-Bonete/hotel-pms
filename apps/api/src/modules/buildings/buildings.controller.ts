import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { buildingSchema, floorSchema } from '@pms/validation';
import type { BuildingInput, FloorInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Access, RequirePermission } from '../rbac/decorators/access.decorators';
import { BuildingsService } from './buildings.service';

@Controller('properties/:propertyId')
export class BuildingsController {
  constructor(private readonly buildings: BuildingsService) {}

  @RequirePermission('property.read')
  @Get('structure')
  structure(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Access() access: AccessContext) {
    return this.buildings.structure(propertyId, access);
  }

  @RequirePermission('property.update')
  @Post('buildings')
  addBuilding(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body(new ZodValidationPipe(buildingSchema)) dto: BuildingInput,
    @Access() access: AccessContext,
  ) {
    return this.buildings.addBuilding(propertyId, dto, access);
  }

  @RequirePermission('property.update')
  @Post('buildings/:buildingId/floors')
  addFloor(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('buildingId', ParseUUIDPipe) buildingId: string,
    @Body(new ZodValidationPipe(floorSchema)) dto: FloorInput,
    @Access() access: AccessContext,
  ) {
    return this.buildings.addFloor(propertyId, buildingId, dto, access);
  }
}
