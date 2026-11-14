import type { Tx } from '../../database/prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
/** Creates tasks as a side effect of other workflows (check-out, repairs finishing). Runs inside the caller's transaction. */
export declare class HousekeepingAutomation {
    private readonly realtime;
    constructor(realtime: RealtimeService);
    /**
     * A room needs turnover cleaning. Safe to call twice: a partial unique index allows only one open
     * task per room and kind, and skipDuplicates makes the second call a no-op instead of an error.
     * Rooms with a guest arriving today get HIGH priority.
     */
    createCheckoutTask(tx: Tx, input: {
        organizationId: string;
        propertyId: string;
        roomId: string;
        today: string;
        createdById: string | null;
        notes: string;
    }): Promise<void>;
}
