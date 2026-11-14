import type { GuestDetail, GuestView } from '@pms/types';
import type { GuestInput, GuestsQuery, UpdateGuestInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { Paginated } from '../../common/http/response.interceptor';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
export declare class GuestsService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AuditService);
    list(query: GuestsQuery): Promise<Paginated<GuestView>>;
    /** Opening a profile is itself audited (privacy). Stays are limited to properties the caller may see. */
    get(id: string, access: AccessContext): Promise<GuestDetail>;
    create(dto: GuestInput, access: AccessContext): Promise<GuestView>;
    update(id: string, dto: UpdateGuestInput, access: AccessContext): Promise<GuestView>;
    private ensureEmailFree;
}
