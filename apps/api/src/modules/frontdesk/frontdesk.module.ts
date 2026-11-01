import { Module } from '@nestjs/common';
import { FrontDeskController } from './frontdesk.controller';
import { FrontDeskService } from './frontdesk.service';

@Module({ controllers: [FrontDeskController], providers: [FrontDeskService] })
export class FrontDeskModule {}
