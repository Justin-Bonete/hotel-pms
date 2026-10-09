import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  createReservationSchema,
  rangeQuerySchema,
  reservationsQuerySchema,
  transitionSchema,
  updateReservationSchema,
} from '@pms/validation';
import type { CreateReservationInput, RangeQuery, ReservationsQuery, TransitionInput, UpdateReservationInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Access, RequirePermission } from '../rbac/decorators/access.decorators';
import { ReservationsService } from './reservations.service';

@Controller()
export class ReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  @RequirePermission('reservation.read')
  @Get('reservations')
  list(@Query(new ZodValidationPipe(reservationsQuerySchema)) query: ReservationsQuery, @Access() access: AccessContext) {
    return this.reservations.list(query, access);
  }

  @RequirePermission('reservation.read')
  @Get('reservations/:id')
  get(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext) {
    return this.reservations.get(id, access);
  }

  @RequirePermission('reservation.manage')
  @Post('properties/:propertyId/reservations')
  create(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body(new ZodValidationPipe(createReservationSchema)) dto: CreateReservationInput,
    @Access() access: AccessContext,
  ) {
    return this.reservations.create(propertyId, dto, access);
  }

  @RequirePermission('reservation.manage')
  @Patch('reservations/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(updateReservationSchema)) dto: UpdateReservationInput, @Access() access: AccessContext) {
    return this.reservations.update(id, dto, access);
  }

  /** Needs reservation.manage OR reservation.check_in depending on the action; the service checks the exact one. */
  @RequirePermission('reservation.read')
  @HttpCode(200)
  @Post('reservations/:id/transition')
  transition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(transitionSchema)) dto: TransitionInput,
    @Access() access: AccessContext,
  ) {
    return this.reservations.transition(id, dto, access);
  }

  @RequirePermission('reservation.read')
  @Get('properties/:propertyId/calendar')
  calendar(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Query(new ZodValidationPipe(rangeQuerySchema)) query: RangeQuery, @Access() access: AccessContext) {
    return this.reservations.calendar(propertyId, query, access);
  }

  @RequirePermission('reservation.read')
  @Get('properties/:propertyId/availability')
  availability(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Query(new ZodValidationPipe(rangeQuerySchema)) query: RangeQuery, @Access() access: AccessContext) {
    return this.reservations.availability(propertyId, query, access);
  }
}
