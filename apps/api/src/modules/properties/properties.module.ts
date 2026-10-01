import { Module } from '@nestjs/common';
import { PropertiesController } from './properties.controller';
import { PropertiesRepository } from './properties.repository';
import { PropertiesService } from './properties.service';

@Module({ controllers: [PropertiesController], providers: [PropertiesService, PropertiesRepository] })
export class PropertiesModule {}
