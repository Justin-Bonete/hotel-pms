import { Injectable } from '@nestjs/common';
import type { Tx } from '../../database/prisma/prisma.service';

@Injectable()
export class RbacRepository {
  async loadAccessData(tx: Tx, userId: string) {
    const [user, assignments, properties] = await Promise.all([
      tx.user.findFirst({
        where: { id: userId, deletedAt: null },
        select: { status: true, organization: { select: { status: true } } },
      }),
      tx.userRoleAssignment.findMany({
        where: { userId },
        include: {
          role: { select: { key: true, permissions: { select: { permission: { select: { key: true } } } } } },
        },
      }),
      tx.property.findMany({ where: { deletedAt: null }, select: { id: true, groupId: true } }),
    ]);
    return { user, assignments, properties };
  }

  listRoles(tx: Tx) {
    return tx.role.findMany({
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      include: { permissions: { select: { permission: { select: { key: true } } } } },
    });
  }

  /**
   * Active users who hold a permission at a property: through an organization-wide role, a role on the
   * property's group, or a role on the property itself.
   */
  async usersWithPermission(tx: Tx, propertyId: string, groupId: string | null, permissionKey: string) {
    const scopes: Array<{ scopeType: 'ORGANIZATION' | 'PROPERTY' | 'GROUP'; scopeId?: string }> = [
      { scopeType: 'ORGANIZATION' },
      { scopeType: 'PROPERTY', scopeId: propertyId },
    ];
    if (groupId) scopes.push({ scopeType: 'GROUP', scopeId: groupId });
    const rows = await tx.userRoleAssignment.findMany({
      where: {
        OR: scopes,
        role: { permissions: { some: { permission: { key: permissionKey } } } },
        user: { status: 'ACTIVE', deletedAt: null },
      },
      select: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
    const unique = new Map(rows.map((r) => [r.user.id, r.user]));
    return [...unique.values()].sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
  }
}
