import { Module } from '@nestjs/common';
import { RoomTypesController } from './room-types.controller';
import { RoomTypesService } from './room-types.service';

@Module({ controllers: [RoomTypesController], providers: [RoomTypesService] })
export class RoomTypesModule {}
