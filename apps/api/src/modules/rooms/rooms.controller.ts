import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { roomSchema, roomStatusSchema, roomsQuerySchema, updateRoomSchema } from '@pms/validation';
import type { RoomInput, RoomStatusInput, RoomsQuery, UpdateRoomInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Access, RequirePermission } from '../rbac/decorators/access.decorators';
import { RoomsService } from './rooms.service';

@Controller()
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @RequirePermission('room.read')
  @Get('properties/:propertyId/rooms')
  list(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query(new ZodValidationPipe(roomsQuerySchema)) query: RoomsQuery,
    @Access() access: AccessContext,
  ) {
    return this.rooms.list(propertyId, query, access);
  }

  @RequirePermission('room.manage')
  @Post('properties/:propertyId/rooms')
  create(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body(new ZodValidationPipe(roomSchema)) dto: RoomInput,
    @Access() access: AccessContext,
  ) {
    return this.rooms.create(propertyId, dto, access);
  }

  @RequirePermission('room.manage')
  @Patch('rooms/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateRoomSchema)) dto: UpdateRoomInput,
    @Access() access: AccessContext,
  ) {
    return this.rooms.update(id, dto, access);
  }

  @RequirePermission('room.update_status')
  @HttpCode(200)
  @Post('rooms/:id/status')
  changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(roomStatusSchema)) dto: RoomStatusInput,
    @Access() access: AccessContext,
  ) {
    return this.rooms.changeStatus(id, dto, access);
  }

  @RequirePermission('room.manage')
  @HttpCode(200)
  @Delete('rooms/:id')
  async archive(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext) {
    await this.rooms.archive(id, access);
    return null;
  }
}
