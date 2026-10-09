import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { guestSchema, guestsQuerySchema, updateGuestSchema } from '@pms/validation';
import type { GuestInput, GuestsQuery, UpdateGuestInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Access, RequirePermission } from '../rbac/decorators/access.decorators';
import { GuestsService } from './guests.service';

// Guests belong to the organization, not one property, so these routes only require that the caller
// HOLDS the permission somewhere. A guest's stays are filtered to properties the caller can see.
@Controller('guests')
export class GuestsController {
  constructor(private readonly guests: GuestsService) {}

  @RequirePermission('guest.read')
  @Get()
  list(@Query(new ZodValidationPipe(guestsQuerySchema)) query: GuestsQuery) {
    return this.guests.list(query);
  }

  @RequirePermission('guest.read')
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext) {
    return this.guests.get(id, access);
  }

  @RequirePermission('guest.manage')
  @Post()
  create(@Body(new ZodValidationPipe(guestSchema)) dto: GuestInput, @Access() access: AccessContext) {
    return this.guests.create(dto, access);
  }

  @RequirePermission('guest.manage')
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(updateGuestSchema)) dto: UpdateGuestInput, @Access() access: AccessContext) {
    return this.guests.update(id, dto, access);
  }
}
