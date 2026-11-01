import { Injectable } from '@nestjs/common';
import { parseDate } from '@pms/types';
import type { Tx } from '../../database/prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';

/** Creates tasks as a side effect of other workflows (check-out, repairs finishing). Runs inside the caller's transaction. */
@Injectable()
export class HousekeepingAutomation {
  constructor(private readonly realtime: RealtimeService) {}

  /**
   * A room needs turnover cleaning. Safe to call twice: a partial unique index allows only one open
   * task per room and kind, and skipDuplicates makes the second call a no-op instead of an error.
   * Rooms with a guest arriving today get HIGH priority.
   */
  async createCheckoutTask(
    tx: Tx,
    input: { organizationId: string; propertyId: string; roomId: string; today: string; createdById: string | null; notes: string },
  ): Promise<void> {
    const arrivingToday = await tx.reservation.count({
      where: { roomId: input.roomId, status: { in: ['PENDING', 'CONFIRMED'] }, arrivalDate: parseDate(input.today) },
    });
    const created = await tx.housekeepingTask.createMany({
      data: [
        {
          organizationId: input.organizationId,
          propertyId: input.propertyId,
          roomId: input.roomId,
          type: 'CHECKOUT_CLEAN',
          priority: arrivingToday > 0 ? 'HIGH' : 'NORMAL',
          notes: arrivingToday > 0 ? `${input.notes} A guest arrives today.` : input.notes,
          createdById: input.createdById,
        },
      ],
      skipDuplicates: true,
    });
    if (created.count > 0) this.realtime.emit(input.organizationId, 'housekeeping.changed', input.propertyId, [input.roomId]);
  }
}
