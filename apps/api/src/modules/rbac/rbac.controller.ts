import { Controller, Get } from '@nestjs/common';
import { PERMISSION_CATALOG } from '@pms/types';
import { CurrentUser, type AuthContext } from '../auth/decorators/current-user.decorator';
import { Authenticated, RequirePermission } from './decorators/access.decorators';
import { RbacService } from './rbac.service';

@Controller('rbac')
export class RbacController {
  constructor(private readonly rbac: RbacService) {}

  /** What the signed-in user can do and where. The web app uses this to show or hide actions. */
  @Authenticated()
  @Get('me')
  async me(@CurrentUser() auth: AuthContext) {
    const access = await this.rbac.loadAccess(auth.userId, auth.organizationId);
    return access.toSummary();
  }

  @RequirePermission('role.read')
  @Get('permissions')
  permissions() {
    return PERMISSION_CATALOG;
  }

  @RequirePermission('role.read')
  @Get('roles')
  roles() {
    return this.rbac.listRoles();
  }
}
