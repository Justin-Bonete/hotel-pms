import { Module } from '@nestjs/common';
import { FoliosModule } from '../folios/folios.module';
import { HousekeepingModule } from '../housekeeping/housekeeping.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';

@Module({
  imports: [FoliosModule, HousekeepingModule, WebhooksModule],
  controllers: [ReservationsController],
  providers: [ReservationsService],
  exports: [ReservationsService],
})
export class ReservationsModule {}
