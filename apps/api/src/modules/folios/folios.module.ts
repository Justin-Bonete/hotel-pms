import { Module } from '@nestjs/common';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { FolioLedger } from './folio-ledger.service';
import { FoliosController } from './folios.controller';
import { FoliosService } from './folios.service';

@Module({
  imports: [WebhooksModule],
  controllers: [FoliosController],
  providers: [FoliosService, FolioLedger],
  exports: [FolioLedger],
})
export class FoliosModule {}
