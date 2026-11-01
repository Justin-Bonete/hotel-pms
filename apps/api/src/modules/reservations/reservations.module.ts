import { Module } from '@nestjs/common';
import { FoliosModule } from '../folios/folios.module';
import { HousekeepingModule } from '../housekeeping/housekeeping.module';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';

@Module({ imports: [FoliosModule, HousekeepingModule], controllers: [ReservationsController], providers: [ReservationsService] })
export class ReservationsModule {}
