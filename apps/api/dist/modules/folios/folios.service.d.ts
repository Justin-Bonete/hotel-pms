import { type FolioView } from '@pms/types';
import type { AdjustmentInput, ChargeInput, PaymentInput, RefundInput, VoidInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { RealtimeService } from '../realtime/realtime.service';
import { FolioLedger } from './folio-ledger.service';
export declare class FoliosService {
    private readonly prisma;
    private readonly ledger;
    private readonly audit;
    private readonly realtime;
    private readonly webhooks;
    constructor(prisma: PrismaService, ledger: FolioLedger, audit: AuditService, realtime: RealtimeService, webhooks: WebhooksService);
    get(reservationId: string, access: AccessContext): Promise<FolioView>;
    addCharge(reservationId: string, dto: ChargeInput, key: string | undefined, access: AccessContext): Promise<FolioView>;
    addAdjustment(reservationId: string, dto: AdjustmentInput, access: AccessContext): Promise<FolioView>;
    voidItem(itemId: string, dto: VoidInput, access: AccessContext): Promise<FolioView>;
    recordPayment(reservationId: string, dto: PaymentInput, key: string | undefined, access: AccessContext): Promise<FolioView>;
    refund(paymentId: string, dto: RefundInput, key: string | undefined, access: AccessContext): Promise<FolioView>;
    private loadReservation;
    private assertOpen;
    /** Same Idempotency-Key twice = the first request already did the work. */
    private alreadyDone;
    private view;
}
