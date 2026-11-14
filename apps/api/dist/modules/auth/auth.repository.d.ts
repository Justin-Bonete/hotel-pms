import { AuthTokenType, ScopeType } from '@prisma/client';
import type { Tx } from '../../database/prisma/prisma.service';
/** Data access for auth. Every method runs inside a transaction opened by the service. */
export declare class AuthRepository {
    findUserByEmail(tx: Tx, email: string): import("@prisma/client").Prisma.Prisma__UserClient<({
        organization: {
            status: import("@prisma/client").$Enums.OrganizationStatus;
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            slug: string;
        };
    } & {
        organizationId: string;
        status: import("@prisma/client").$Enums.UserStatus;
        id: string;
        createdAt: Date;
        email: string;
        passwordHash: string;
        firstName: string;
        lastName: string;
        phone: string | null;
        emailVerifiedAt: Date | null;
        mfaSecret: string | null;
        mfaEnabled: boolean;
        failedLoginCount: number;
        lockedUntil: Date | null;
        lastLoginAt: Date | null;
        updatedAt: Date;
        deletedAt: Date | null;
    }) | null, null, import("@prisma/client/runtime/library").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    findUserById(tx: Tx, id: string): import("@prisma/client").Prisma.Prisma__UserClient<({
        organization: {
            status: import("@prisma/client").$Enums.OrganizationStatus;
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            slug: string;
        };
    } & {
        organizationId: string;
        status: import("@prisma/client").$Enums.UserStatus;
        id: string;
        createdAt: Date;
        email: string;
        passwordHash: string;
        firstName: string;
        lastName: string;
        phone: string | null;
        emailVerifiedAt: Date | null;
        mfaSecret: string | null;
        mfaEnabled: boolean;
        failedLoginCount: number;
        lockedUntil: Date | null;
        lastLoginAt: Date | null;
        updatedAt: Date;
        deletedAt: Date | null;
    }) | null, null, import("@prisma/client/runtime/library").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    getUserWithRoles(tx: Tx, id: string): import("@prisma/client").Prisma.Prisma__UserClient<({
        organization: {
            status: import("@prisma/client").$Enums.OrganizationStatus;
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            slug: string;
        };
        roleAssignments: ({
            role: {
                key: string;
                name: string;
            };
        } & {
            userId: string;
            organizationId: string;
            id: string;
            createdAt: Date;
            roleId: string;
            scopeType: import("@prisma/client").$Enums.ScopeType;
            scopeId: string;
        })[];
    } & {
        organizationId: string;
        status: import("@prisma/client").$Enums.UserStatus;
        id: string;
        createdAt: Date;
        email: string;
        passwordHash: string;
        firstName: string;
        lastName: string;
        phone: string | null;
        emailVerifiedAt: Date | null;
        mfaSecret: string | null;
        mfaEnabled: boolean;
        failedLoginCount: number;
        lockedUntil: Date | null;
        lastLoginAt: Date | null;
        updatedAt: Date;
        deletedAt: Date | null;
    }) | null, null, import("@prisma/client/runtime/library").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    slugExists(tx: Tx, slug: string): Promise<boolean>;
    createOrganization(tx: Tx, data: {
        name: string;
        slug: string;
    }): import("@prisma/client").Prisma.Prisma__OrganizationClient<{
        status: import("@prisma/client").$Enums.OrganizationStatus;
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        slug: string;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    createUser(tx: Tx, data: {
        organizationId: string;
        email: string;
        passwordHash: string;
        firstName: string;
        lastName: string;
    }): import("@prisma/client").Prisma.Prisma__UserClient<{
        organization: {
            status: import("@prisma/client").$Enums.OrganizationStatus;
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            slug: string;
        };
    } & {
        organizationId: string;
        status: import("@prisma/client").$Enums.UserStatus;
        id: string;
        createdAt: Date;
        email: string;
        passwordHash: string;
        firstName: string;
        lastName: string;
        phone: string | null;
        emailVerifiedAt: Date | null;
        mfaSecret: string | null;
        mfaEnabled: boolean;
        failedLoginCount: number;
        lockedUntil: Date | null;
        lastLoginAt: Date | null;
        updatedAt: Date;
        deletedAt: Date | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    findSystemRole(tx: Tx, key: string): import("@prisma/client").Prisma.Prisma__RoleClient<{
        key: string;
        organizationId: string | null;
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        isSystem: boolean;
    } | null, null, import("@prisma/client/runtime/library").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    assignRole(tx: Tx, data: {
        organizationId: string;
        userId: string;
        roleId: string;
        scopeType: ScopeType;
        scopeId: string;
    }): import("@prisma/client").Prisma.Prisma__UserRoleAssignmentClient<{
        userId: string;
        organizationId: string;
        id: string;
        createdAt: Date;
        roleId: string;
        scopeType: import("@prisma/client").$Enums.ScopeType;
        scopeId: string;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    recordLoginFailure(tx: Tx, userId: string, failedLoginCount: number, lockedUntil: Date | null): import("@prisma/client").Prisma.Prisma__UserClient<{
        id: string;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    recordLoginSuccess(tx: Tx, userId: string, at: Date): import("@prisma/client").Prisma.Prisma__UserClient<{
        id: string;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    setPassword(tx: Tx, userId: string, passwordHash: string): import("@prisma/client").Prisma.Prisma__UserClient<{
        id: string;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    /** Choosing a password through an emailed link proves the person controls the address, and finishes an invitation. */
    activateAfterPasswordSet(tx: Tx, userId: string, at: Date): Promise<void>;
    setEmailVerified(tx: Tx, userId: string, at: Date): import("@prisma/client").Prisma.Prisma__UserClient<{
        id: string;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    createSession(tx: Tx, data: {
        organizationId: string;
        userId: string;
        familyId: string;
        refreshTokenHash: string;
        deviceLabel: string;
        ip?: string;
        userAgent?: string;
        expiresAt: Date;
    }): import("@prisma/client").Prisma.Prisma__UserSessionClient<{
        userId: string;
        organizationId: string;
        id: string;
        ip: string | null;
        userAgent: string | null;
        createdAt: Date;
        familyId: string;
        refreshTokenHash: string;
        deviceLabel: string | null;
        lastUsedAt: Date;
        expiresAt: Date;
        revokedAt: Date | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    findSessionByHash(tx: Tx, refreshTokenHash: string): import("@prisma/client").Prisma.Prisma__UserSessionClient<{
        userId: string;
        organizationId: string;
        id: string;
        ip: string | null;
        userAgent: string | null;
        createdAt: Date;
        familyId: string;
        refreshTokenHash: string;
        deviceLabel: string | null;
        lastUsedAt: Date;
        expiresAt: Date;
        revokedAt: Date | null;
    } | null, null, import("@prisma/client/runtime/library").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    revokeSession(tx: Tx, id: string, at: Date): import("@prisma/client").Prisma.Prisma__UserSessionClient<{
        id: string;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    revokeFamily(tx: Tx, familyId: string, at: Date): Promise<void>;
    /** Revokes every active sign-in of a user and returns the affected family ids. */
    revokeAllForUser(tx: Tx, userId: string, at: Date): Promise<string[]>;
    listActiveSessions(tx: Tx, userId: string, now: Date): import("@prisma/client").Prisma.PrismaPromise<{
        userId: string;
        organizationId: string;
        id: string;
        ip: string | null;
        userAgent: string | null;
        createdAt: Date;
        familyId: string;
        refreshTokenHash: string;
        deviceLabel: string | null;
        lastUsedAt: Date;
        expiresAt: Date;
        revokedAt: Date | null;
    }[]>;
    findActiveFamilyForUser(tx: Tx, userId: string, familyId: string): import("@prisma/client").Prisma.Prisma__UserSessionClient<{
        userId: string;
        organizationId: string;
        id: string;
        ip: string | null;
        userAgent: string | null;
        createdAt: Date;
        familyId: string;
        refreshTokenHash: string;
        deviceLabel: string | null;
        lastUsedAt: Date;
        expiresAt: Date;
        revokedAt: Date | null;
    } | null, null, import("@prisma/client/runtime/library").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    invalidateTokens(tx: Tx, userId: string, type: AuthTokenType, at: Date): import("@prisma/client").Prisma.PrismaPromise<import("@prisma/client").Prisma.BatchPayload>;
    createAuthToken(tx: Tx, data: {
        organizationId: string;
        userId: string;
        type: AuthTokenType;
        tokenHash: string;
        expiresAt: Date;
    }): import("@prisma/client").Prisma.Prisma__AuthTokenClient<{
        id: string;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    findUsableToken(tx: Tx, tokenHash: string, type: AuthTokenType, now: Date): import("@prisma/client").Prisma.Prisma__AuthTokenClient<{
        userId: string;
        organizationId: string;
        type: import("@prisma/client").$Enums.AuthTokenType;
        id: string;
        createdAt: Date;
        expiresAt: Date;
        usedAt: Date | null;
        tokenHash: string;
    } | null, null, import("@prisma/client/runtime/library").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    markTokenUsed(tx: Tx, id: string, at: Date): import("@prisma/client").Prisma.Prisma__AuthTokenClient<{
        id: string;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
}
