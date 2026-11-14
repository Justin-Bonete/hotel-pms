import { Body, Controller, Delete, Get, Headers, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { createPosOrderSchema, outletSchema, posItemSchema, posOrdersQuerySchema, updateOutletSchema, updatePosItemSchema, voidPosOrderSchema } from '@pms/validation';
import type { CreatePosOrderInput, OutletInput, PosItemInput, PosOrdersQuery, UpdateOutletInput, UpdatePosItemInput, VoidPosOrderInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Access, RequirePermission } from '../rbac/decorators/access.decorators';
import { PosService } from './pos.service';

@Controller()
export class PosController {
  constructor(private readonly pos: PosService) {}

  @RequirePermission('pos.read')
  @Get('properties/:propertyId/pos/menu')
  menu(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Access() access: AccessContext) {
    return this.pos.menu(propertyId, access);
  }

  @RequirePermission('pos.manage')
  @Post('properties/:propertyId/pos/outlets')
  createOutlet(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Body(new ZodValidationPipe(outletSchema)) dto: OutletInput, @Access() access: AccessContext) {
    return this.pos.createOutlet(propertyId, dto, access);
  }

  @RequirePermission('pos.manage')
  @Patch('pos/outlets/:id')
  updateOutlet(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(updateOutletSchema)) dto: UpdateOutletInput, @Access() access: AccessContext) {
    return this.pos.updateOutlet(id, dto, access);
  }

  @RequirePermission('pos.manage')
  @HttpCode(200)
  @Delete('pos/outlets/:id')
  async archiveOutlet(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext) {
    await this.pos.archiveOutlet(id, access);
    return null;
  }

  @RequirePermission('pos.manage')
  @Post('pos/items')
  createItem(@Body(new ZodValidationPipe(posItemSchema)) dto: PosItemInput, @Access() access: AccessContext) {
    return this.pos.createItem(dto, access);
  }

  @RequirePermission('pos.manage')
  @Patch('pos/items/:id')
  updateItem(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(updatePosItemSchema)) dto: UpdatePosItemInput, @Access() access: AccessContext) {
    return this.pos.updateItem(id, dto, access);
  }

  @RequirePermission('pos.manage')
  @HttpCode(200)
  @Delete('pos/items/:id')
  async archiveItem(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext) {
    await this.pos.archiveItem(id, access);
    return null;
  }

  @RequirePermission('pos.sell')
  @Post('properties/:propertyId/pos/orders')
  create(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body(new ZodValidationPipe(createPosOrderSchema)) dto: CreatePosOrderInput,
    @Headers('idempotency-key') key: string | undefined,
    @Access() access: AccessContext,
  ) {
    return this.pos.create(propertyId, dto, key?.slice(0, 100), access);
  }

  @RequirePermission('pos.read')
  @Get('properties/:propertyId/pos/orders')
  list(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Query(new ZodValidationPipe(posOrdersQuerySchema)) query: PosOrdersQuery, @Access() access: AccessContext) {
    return this.pos.list(propertyId, query, access);
  }

  @RequirePermission('pos.read')
  @Get('properties/:propertyId/pos/summary')
  summary(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Query(new ZodValidationPipe(posOrdersQuerySchema)) query: PosOrdersQuery, @Access() access: AccessContext) {
    return this.pos.summary(propertyId, query, access);
  }

  @RequirePermission('pos.void')
  @HttpCode(200)
  @Post('pos/orders/:id/void')
  void(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(voidPosOrderSchema)) dto: VoidPosOrderInput, @Access() access: AccessContext) {
    return this.pos.void(id, dto, access);
  }
}
