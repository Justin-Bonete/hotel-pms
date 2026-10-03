import { HttpStatus, Injectable } from '@nestjs/common';
import { OrganizationStatus, UserStatus } from '@prisma/client';
import { AccessContext, RoleGrant } from '../../common/access/access-context';
import { AppException } from '../../common/http/app-exception';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RbacRepository } from './rbac.repository';

@Injectable()
export class RbacService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: RbacRepository,
  ) {}

  /**
   * Builds the caller's AccessContext from the database on every protected request, so a role change
   * or a disabled account takes effect immediately. (Optimization for later: cache in Redis for ~60s and
   * clear it when roles change.)
   */
  async loadAccess(userId: string, organizationId: string): Promise<AccessContext> {
    const data = await this.prisma.forOrganization(organizationId, (tx) => this.repo.loadAccessData(tx, userId));

    if (!data.user || data.user.status === UserStatus.DISABLED || data.user.organization.status !== OrganizationStatus.ACTIVE) {
      throw new AppException('ACCOUNT_DISABLED', 'This account is disabled. Contact your administrator.', HttpStatus.FORBIDDEN);
    }

    const grants: RoleGrant[] = data.assignments.map((a) => ({
      roleKey: a.role.key,
      scopeType: a.scopeType,
      scopeId: a.scopeId,
      permissions: a.role.permissions.map((rp) => rp.permission.key),
    }));
    return new AccessContext(userId, organizationId, grants, data.properties);
  }

  async listRoles() {
    const roles = await this.prisma.forTenant((tx) => this.repo.listRoles(tx));
    return roles.map((r) => ({
      id: r.id,
      key: r.key,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      permissions: r.permissions.map((rp) => rp.permission.key).sort(),
    }));
  }
}
