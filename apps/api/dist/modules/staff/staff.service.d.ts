import type { StaffView } from '@pms/types';
import type { InviteStaffInput, ScopeInput, StaffQuery } from '@pms/validation';
import { AccessContext } from '../../common/access/access-context';
import { Paginated } from '../../common/http/response.interceptor';
import type { Env } from '../../config/env';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RedisService } from '../../database/redis/redis.service';
import { AuditService } from '../audit/audit.service';
import { AuthRepository } from '../auth/auth.repository';
import { PasswordService } from '../auth/password.service';
import { TokenService } from '../auth/token.service';
import { MailService } from '../mail/mail.service';
export declare class StaffService {
    private readonly prisma;
    private readonly audit;
    private readonly authRepo;
    private readonly passwords;
    private readonly tokens;
    private readonly mail;
    private readonly redis;
    private readonly env;
    constructor(prisma: PrismaService, audit: AuditService, authRepo: AuthRepository, passwords: PasswordService, tokens: TokenService, mail: MailService, redis: RedisService, env: Env);
    list(query: StaffQuery, access: AccessContext): Promise<Paginated<StaffView>>;
    invite(dto: InviteStaffInput, access: AccessContext): Promise<StaffView>;
    resendInvite(userId: string, access: AccessContext): Promise<void>;
    addAssignment(userId: string, dto: ScopeInput, access: AccessContext): Promise<StaffView>;
    removeAssignment(userId: string, assignmentId: string, access: AccessContext): Promise<StaffView>;
    setActive(userId: string, active: boolean, access: AccessContext): Promise<StaffView>;
    private catalog;
    private labels;
    /** The role must exist, the scope must be real and visible, and the caller must hold everything the role grants. */
    private requireGrantable;
    /** The person's whole current access must be within the caller's own, so a manager can't touch an owner. */
    private requireManageable;
    private isManageable;
    /** Never leave the organization without an active owner. */
    private requireAnotherOwner;
    private issueInvite;
    private sendInvite;
    private toView;
}
