import { Module } from '@nestjs/common';
import { FoliosModule } from '../folios/folios.module';
import { PosController } from './pos.controller';
import { PosService } from './pos.service';

@Module({ imports: [FoliosModule], controllers: [PosController], providers: [PosService] })
export class PosModule {}
