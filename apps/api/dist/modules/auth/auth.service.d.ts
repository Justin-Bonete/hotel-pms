import type { ForgotPasswordInput, LoginInput, RegisterInput, ResetPasswordInput, VerifyEmailInput } from '@pms/validation';
import type { Env } from '../../config/env';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RedisService } from '../../database/redis/redis.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { AuthRepository } from './auth.repository';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
export interface PublicUser {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    emailVerified: boolean;
    organization: {
        id: string;
        name: string;
        slug: string;
    };
}
export interface AuthResult {
    accessToken: string;
    expiresIn: number;
    user: PublicUser;
    refreshToken: string;
    refreshExpiresAt: Date;
}
export declare class AuthService {
    private readonly prisma;
    private readonly repo;
    private readonly passwords;
    private readonly tokens;
    private readonly audit;
    private readonly mail;
    private readonly redis;
    private readonly env;
    constructor(prisma: PrismaService, repo: AuthRepository, passwords: PasswordService, tokens: TokenService, audit: AuditService, mail: MailService, redis: RedisService, env: Env);
    register(dto: RegisterInput): Promise<AuthResult>;
    login(dto: LoginInput): Promise<AuthResult>;
    refresh(refreshToken: string | undefined): Promise<AuthResult>;
    logout(refreshToken: string | undefined): Promise<void>;
    me(userId: string): Promise<{
        roles: {
            key: string;
            name: string;
            scopeType: import("@prisma/client").$Enums.ScopeType;
            scopeId: string;
        }[];
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        emailVerified: boolean;
        organization: {
            id: string;
            name: string;
            slug: string;
        };
    }>;
    listSessions(userId: string, currentFamilyId: string): Promise<{
        id: string;
        device: string | null;
        ip: string | null;
        signedInAt: Date;
        lastActiveAt: Date;
        current: boolean;
    }[]>;
    revokeSession(userId: string, organizationId: string, familyId: string): Promise<void>;
    verifyEmail(dto: VerifyEmailInput): Promise<void>;
    resendVerification(userId: string): Promise<void>;
    /** Always succeeds from the caller's point of view, so it can't be used to discover accounts. */
    forgotPassword(dto: ForgotPasswordInput): Promise<void>;
    resetPassword(dto: ResetPasswordInput): Promise<void>;
    private startSession;
    private buildResult;
    private toPublicUser;
    private issueOneTimeToken;
    private sendVerificationEmail;
    private uniqueSlug;
    /** Block the family's access tokens until the longest-lived one would have expired anyway. */
    private denylistFamily;
}
