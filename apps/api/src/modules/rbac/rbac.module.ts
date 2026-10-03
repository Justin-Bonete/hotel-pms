import { Module } from '@nestjs/common';
import { PermissionsGuard } from './guards/permissions.guard';
import { RbacController } from './rbac.controller';
import { RbacRepository } from './rbac.repository';
import { RbacService } from './rbac.service';

@Module({
  controllers: [RbacController],
  providers: [RbacService, RbacRepository, PermissionsGuard],
  exports: [RbacService, PermissionsGuard],
})
export class RbacModule {}
