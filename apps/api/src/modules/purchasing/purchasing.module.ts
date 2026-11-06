import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { PurchasingController } from './purchasing.controller';
import { PurchasingService } from './purchasing.service';

@Module({ imports: [RbacModule], controllers: [PurchasingController], providers: [PurchasingService] })
export class PurchasingModule {}
