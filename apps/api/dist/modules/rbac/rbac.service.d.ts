import { AccessContext } from '../../common/access/access-context';
import { PrismaService, Tx } from '../../database/prisma/prisma.service';
import { RbacRepository } from './rbac.repository';
export declare class RbacService {
    private readonly prisma;
    private readonly repo;
    constructor(prisma: PrismaService, repo: RbacRepository);
    /**
     * Builds the caller's AccessContext from the database on every protected request, so a role change
     * or a disabled account takes effect immediately. (Optimization for later: cache in Redis for ~60s and
     * clear it when roles change.)
     */
    loadAccess(userId: string, organizationId: string): Promise<AccessContext>;
    listRoles(): Promise<{
        id: string;
        key: string;
        name: string;
        description: string | null;
        isSystem: boolean;
        permissions: string[];
    }[]>;
    /** Staff who can be given work of a kind at a property (housekeeping.work, maintenance.work...). Runs inside the caller's transaction. */
    assignableStaff(tx: Tx, propertyId: string, permissionKey: string): Promise<Array<{
        id: string;
        name: string;
    }>>;
}
