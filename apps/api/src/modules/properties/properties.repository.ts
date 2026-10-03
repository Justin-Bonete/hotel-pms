import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { PropertyScope } from '../../common/access/access-context';
import type { Tx } from '../../database/prisma/prisma.service';

export const propertyInclude = {
  group: { select: { name: true } },
  _count: { select: { rooms: { where: { deletedAt: null } } } },
} satisfies Prisma.PropertyInclude;

export type PropertyRow = Prisma.PropertyGetPayload<{ include: typeof propertyInclude }>;

@Injectable()
export class PropertiesRepository {
  async list(tx: Tx, args: { skip: number; take: number; scope: PropertyScope }) {
    const where: Prisma.PropertyWhereInput = {
      deletedAt: null,
      ...(args.scope.all ? {} : { id: { in: [...args.scope.ids] } }),
    };
    const [rows, total] = await Promise.all([
      tx.property.findMany({ where, orderBy: { name: 'asc' }, skip: args.skip, take: args.take, include: propertyInclude }),
      tx.property.count({ where }),
    ]);
    return { rows, total };
  }

  findById(tx: Tx, id: string) {
    return tx.property.findFirst({ where: { id, deletedAt: null }, include: propertyInclude });
  }

  /** Includes archived rows: the unique constraint on (organization, slug) covers them too. */
  slugExists(tx: Tx, slug: string) {
    return tx.property.count({ where: { slug } }).then((n) => n > 0);
  }

  groupExists(tx: Tx, id: string) {
    return tx.propertyGroup.count({ where: { id, deletedAt: null } }).then((n) => n > 0);
  }

  create(tx: Tx, data: Prisma.PropertyUncheckedCreateInput) {
    return tx.property.create({ data, include: propertyInclude });
  }

  update(tx: Tx, id: string, data: Prisma.PropertyUncheckedUpdateInput) {
    return tx.property.update({ where: { id }, data, include: propertyInclude });
  }

  countActiveRooms(tx: Tx, propertyId: string) {
    return tx.room.count({ where: { propertyId, deletedAt: null } });
  }
}
