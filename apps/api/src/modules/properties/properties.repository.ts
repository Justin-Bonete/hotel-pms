import { Injectable } from '@nestjs/common';
import type { Tx } from '../../database/prisma/prisma.service';

@Injectable()
export class PropertiesRepository {
  async list(tx: Tx, args: { skip: number; take: number }) {
    const where = { deletedAt: null };
    const [rows, total] = await Promise.all([
      tx.property.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: args.skip,
        take: args.take,
        include: { group: { select: { name: true } } },
      }),
      tx.property.count({ where }),
    ]);
    return { rows, total };
  }
}
