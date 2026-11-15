import { Module } from '@nestjs/common';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { ReservationsModule } from '../reservations/reservations.module';
import { ApiKeyGuard } from './api-key.guard';
import { PublicApiController } from './public-api.controller';
import { PublicApiService } from './public-api.service';
import { PublicRateLimiter } from './public-rate-limiter';

@Module({ imports: [ApiKeysModule, ReservationsModule], controllers: [PublicApiController], providers: [PublicApiService, PublicRateLimiter, ApiKeyGuard] })
export class PublicApiModule {}
