import { Module } from '@nestjs/common';
import { PropertyGroupsController } from './property-groups.controller';
import { PropertyGroupsService } from './property-groups.service';

@Module({ controllers: [PropertyGroupsController], providers: [PropertyGroupsService] })
export class PropertyGroupsModule {}
