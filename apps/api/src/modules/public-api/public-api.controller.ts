import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { publicAvailabilityQuerySchema, publicBookingSchema, publicLookupQuerySchema } from '@pms/validation';
import type { PublicAvailabilityQuery, PublicBookingInput, PublicLookupQuery } from '@pms/validation';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { ApiKeyAuth } from '../api-keys/api-keys.service';
import { Public } from '../auth/decorators/public.decorator';
import { ApiKey, ApiKeyGuard } from './api-key.guard';
import { PublicApiService } from './public-api.service';

/**
 * The booking API for a hotel's own website or app. Authenticated by an API key (not a staff login), so it is marked
 * @Public() to step around the staff guards and guarded by ApiKeyGuard instead. Use it from a SERVER: never put a key in
 * web page JavaScript, where anyone could copy it.
 */
@Public()
@UseGuards(ApiKeyGuard)
@Controller('public')
export class PublicApiController {
  constructor(private readonly api: PublicApiService) {}

  @Get('properties')
  properties(@ApiKey() key: ApiKeyAuth) {
    return this.api.properties(key);
  }

  @Get('properties/:propertyId/availability')
  availability(@ApiKey() key: ApiKeyAuth, @Param('propertyId', ParseUUIDPipe) propertyId: string, @Query(new ZodValidationPipe(publicAvailabilityQuerySchema)) q: PublicAvailabilityQuery) {
    return this.api.availability(key, propertyId, q);
  }

  @Post('properties/:propertyId/bookings')
  book(
    @ApiKey() key: ApiKeyAuth,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body(new ZodValidationPipe(publicBookingSchema)) dto: PublicBookingInput,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.api.book(key, propertyId, dto, idempotencyKey);
  }

  @Get('properties/:propertyId/bookings/:code')
  lookup(@ApiKey() key: ApiKeyAuth, @Param('propertyId', ParseUUIDPipe) propertyId: string, @Param('code') code: string, @Query(new ZodValidationPipe(publicLookupQuerySchema)) q: PublicLookupQuery) {
    return this.api.lookup(key, propertyId, code.slice(0, 40), q);
  }
}
