import { Module } from '@nestjs/common';
import { FoliosModule } from '../folios/folios.module';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';

@Module({ imports: [FoliosModule], controllers: [ReservationsController], providers: [ReservationsService] })
export class ReservationsModule {}
