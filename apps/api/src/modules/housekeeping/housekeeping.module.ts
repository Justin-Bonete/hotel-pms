import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { HousekeepingAutomation } from './housekeeping-automation.service';
import { HousekeepingController } from './housekeeping.controller';
import { HousekeepingService } from './housekeeping.service';

@Module({
  imports: [RbacModule],
  controllers: [HousekeepingController],
  providers: [HousekeepingService, HousekeepingAutomation],
  exports: [HousekeepingAutomation],
})
export class HousekeepingModule {}
