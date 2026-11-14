import { type FrontDeskView } from '@pms/types';
import type { AccessContext } from '../../common/access/access-context';
import { PrismaService } from '../../database/prisma/prisma.service';
/** "Who is arriving, departing and staying?" in one request, for the property's own "today". */
export declare class FrontDeskService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    get(propertyId: string, access: AccessContext): Promise<FrontDeskView>;
    /** Balance per reservation (charges - payments + refunds), computed with three grouped queries, not one per guest. */
    private balances;
}
