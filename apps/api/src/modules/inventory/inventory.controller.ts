import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { inventoryItemSchema, movementSchema, transferSchema, updateInventoryItemSchema } from '@pms/validation';
import type { InventoryItemInput, MovementInput, TransferInput, UpdateInventoryItemInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Access, RequirePermission } from '../rbac/decorators/access.decorators';
import { InventoryService } from './inventory.service';

@Controller()
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @RequirePermission('inventory.read')
  @Get('properties/:propertyId/inventory')
  list(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Access() access: AccessContext) {
    return this.inventory.list(propertyId, access);
  }

  @RequirePermission('inventory.read')
  @Get('properties/:propertyId/inventory/:itemId/movements')
  movements(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Param('itemId', ParseUUIDPipe) itemId: string, @Access() access: AccessContext) {
    return this.inventory.movements(propertyId, itemId, access);
  }

  @RequirePermission('inventory.manage')
  @Post('properties/:propertyId/inventory/movements')
  record(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Body(new ZodValidationPipe(movementSchema)) dto: MovementInput, @Access() access: AccessContext) {
    return this.inventory.record(propertyId, dto, access);
  }

  @RequirePermission('inventory.manage')
  @Post('inventory/transfers')
  transfer(@Body(new ZodValidationPipe(transferSchema)) dto: TransferInput, @Access() access: AccessContext) {
    return this.inventory.transfer(dto, access);
  }

  // The item catalog is shared by the organization; the caller must hold inventory.manage somewhere.
  @RequirePermission('inventory.manage')
  @Post('inventory/items')
  createItem(@Body(new ZodValidationPipe(inventoryItemSchema)) dto: InventoryItemInput, @Access() access: AccessContext) {
    return this.inventory.createItem(dto, access);
  }

  @RequirePermission('inventory.manage')
  @Patch('inventory/items/:id')
  updateItem(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(updateInventoryItemSchema)) dto: UpdateInventoryItemInput, @Access() access: AccessContext) {
    return this.inventory.updateItem(id, dto, access);
  }

  @RequirePermission('inventory.manage')
  @HttpCode(200)
  @Delete('inventory/items/:id')
  async archiveItem(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext) {
    await this.inventory.archiveItem(id, access);
    return null;
  }
}
