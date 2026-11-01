import { Module } from '@nestjs/common';
import { HousekeepingModule } from '../housekeeping/housekeeping.module';
import { RbacModule } from '../rbac/rbac.module';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';

@Module({ imports: [RbacModule, HousekeepingModule], controllers: [MaintenanceController], providers: [MaintenanceService] })
export class MaintenanceModule {}
