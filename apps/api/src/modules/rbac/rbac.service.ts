import { HttpStatus, Injectable } from '@nestjs/common';
import { OrganizationStatus, UserStatus } from '@prisma/client';
import { AccessContext, RoleGrant } from '../../common/access/access-context';
import { AppException } from '../../common/http/app-exception';
import { PrismaService, Tx } from '../../database/prisma/prisma.service';
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

  /** Staff who can be given work of a kind at a property (housekeeping.work, maintenance.work...). Runs inside the caller's transaction. */
  async assignableStaff(tx: Tx, propertyId: string, permissionKey: string): Promise<Array<{ id: string; name: string }>> {
    const property = await tx.property.findFirst({ where: { id: propertyId, deletedAt: null }, select: { groupId: true } });
    const users = await this.repo.usersWithPermission(tx, propertyId, property?.groupId ?? null, permissionKey);
    return users.map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}` }));
  }
}
