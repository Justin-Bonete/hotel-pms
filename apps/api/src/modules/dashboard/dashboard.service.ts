import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { occupancyPct, parseDate, todayIn, type DashboardPropertyToday, type DashboardToday } from '@pms/types';
import type { AccessContext } from '../../common/access/access-context';
import { assertCan } from '../../common/access/assert-access';
import { PrismaService } from '../../database/prisma/prisma.service';

const UNSELLABLE = ['OUT_OF_ORDER', 'OUT_OF_SERVICE', 'MAINTENANCE'] as const;

/** Live numbers for "today", for the properties the caller may see. Revenue, ADR and RevPAR belong to the analytics phase. */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async today(propertyId: string | undefined, access: AccessContext): Promise<DashboardToday> {
    if (propertyId) assertCan(access, 'reservation.read', propertyId);
    const scope = access.scopeOf('reservation.read');

    return this.prisma.forTenant(async (tx) => {
      const where: Prisma.PropertyWhereInput = {
        deletedAt: null,
        ...(propertyId ? { id: propertyId } : scope.all ? {} : { id: { in: [...scope.ids] } }),
      };
      const properties = await tx.property.findMany({ where, select: { id: true, name: true, timezone: true }, orderBy: { name: 'asc' } });

      const rows: DashboardPropertyToday[] = await Promise.all(
        properties.map(async (p) => {
          const today = todayIn(p.timezone);
          const day = parseDate(today);
          const [arrivals, departures, inHouse, rooms, unsellable, dirtyRooms] = await Promise.all([
            tx.reservation.count({ where: { propertyId: p.id, status: { in: ['PENDING', 'CONFIRMED'] }, arrivalDate: day } }),
            tx.reservation.count({ where: { propertyId: p.id, status: 'CHECKED_IN', departureDate: day } }),
            tx.reservation.count({ where: { propertyId: p.id, status: 'CHECKED_IN' } }),
            tx.room.count({ where: { propertyId: p.id, deletedAt: null } }),
            tx.room.count({ where: { propertyId: p.id, deletedAt: null, status: { in: [...UNSELLABLE] } } }),
            tx.room.count({ where: { propertyId: p.id, deletedAt: null, status: 'DIRTY' } }),
          ]);
          const sellableRooms = Math.max(rooms - unsellable, 0);
          return { propertyId: p.id, propertyName: p.name, today, arrivals, departures, inHouse, rooms, sellableRooms, dirtyRooms, occupancyPct: occupancyPct(inHouse, sellableRooms) };
        }),
      );

      const sum = (pick: (r: DashboardPropertyToday) => number) => rows.reduce((s, r) => s + pick(r), 0);
      const sellable = sum((r) => r.sellableRooms);
      const inHouse = sum((r) => r.inHouse);
      return {
        properties: rows,
        totals: { arrivals: sum((r) => r.arrivals), departures: sum((r) => r.departures), inHouse, rooms: sum((r) => r.rooms), sellableRooms: sellable, dirtyRooms: sum((r) => r.dirtyRooms), occupancyPct: occupancyPct(inHouse, sellable) },
      };
    });
  }
}
