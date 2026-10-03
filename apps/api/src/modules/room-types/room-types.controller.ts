import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { roomTypeSchema, updateRoomTypeSchema } from '@pms/validation';
import type { RoomTypeInput, UpdateRoomTypeInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Access, RequirePermission } from '../rbac/decorators/access.decorators';
import { RoomTypesService } from './room-types.service';

@Controller()
export class RoomTypesController {
  constructor(private readonly roomTypes: RoomTypesService) {}

  @RequirePermission('room.read')
  @Get('properties/:propertyId/room-types')
  list(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Access() access: AccessContext) {
    return this.roomTypes.list(propertyId, access);
  }

  @RequirePermission('room_type.manage')
  @Post('properties/:propertyId/room-types')
  create(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body(new ZodValidationPipe(roomTypeSchema)) dto: RoomTypeInput,
    @Access() access: AccessContext,
  ) {
    return this.roomTypes.create(propertyId, dto, access);
  }

  @RequirePermission('room_type.manage')
  @Patch('room-types/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateRoomTypeSchema)) dto: UpdateRoomTypeInput,
    @Access() access: AccessContext,
  ) {
    return this.roomTypes.update(id, dto, access);
  }

  @RequirePermission('room_type.manage')
  @HttpCode(200)
  @Delete('room-types/:id')
  async archive(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext) {
    await this.roomTypes.archive(id, access);
    return null;
  }
}
