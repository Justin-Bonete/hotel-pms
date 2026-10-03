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
}
