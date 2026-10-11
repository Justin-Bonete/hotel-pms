import { Module } from '@nestjs/common';
import { FolioLedger } from './folio-ledger.service';
import { FoliosController } from './folios.controller';
import { FoliosService } from './folios.service';

@Module({
  controllers: [FoliosController],
  providers: [FoliosService, FolioLedger],
  exports: [FolioLedger],
})
export class FoliosModule {}
