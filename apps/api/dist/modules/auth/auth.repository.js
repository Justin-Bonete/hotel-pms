"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthRepository = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
/** Data access for auth. Every method runs inside a transaction opened by the service. */
let AuthRepository = class AuthRepository {
    findUserByEmail(tx, email) {
        return tx.user.findFirst({ where: { email, deletedAt: null }, include: { organization: true } });
    }
    findUserById(tx, id) {
        return tx.user.findFirst({ where: { id, deletedAt: null }, include: { organization: true } });
    }
    getUserWithRoles(tx, id) {
        return tx.user.findFirst({
            where: { id, deletedAt: null },
            include: {
                organization: true,
                roleAssignments: { include: { role: { select: { key: true, name: true } } } },
            },
        });
    }
    slugExists(tx, slug) {
        return tx.organization.count({ where: { slug } }).then((n) => n > 0);
    }
    createOrganization(tx, data) {
        return tx.organization.create({ data });
    }
    createUser(tx, data) {
        return tx.user.create({ data: { ...data, status: client_1.UserStatus.ACTIVE }, include: { organization: true } });
    }
    findSystemRole(tx, key) {
        return tx.role.findFirst({ where: { organizationId: null, key } });
    }
    assignRole(tx, data) {
        return tx.userRoleAssignment.create({ data });
    }
    // ------------------------------------------------ login state
    recordLoginFailure(tx, userId, failedLoginCount, lockedUntil) {
        return tx.user.update({ where: { id: userId }, data: { failedLoginCount, lockedUntil }, select: { id: true } });
    }
    recordLoginSuccess(tx, userId, at) {
        return tx.user.update({
            where: { id: userId },
            data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: at },
            select: { id: true },
        });
    }
    setPassword(tx, userId, passwordHash) {
        return tx.user.update({
            where: { id: userId },
            data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
            select: { id: true },
        });
    }
    /** Choosing a password through an emailed link proves the person controls the address, and finishes an invitation. */
    async activateAfterPasswordSet(tx, userId, at) {
        await tx.user.updateMany({ where: { id: userId, status: client_1.UserStatus.INVITED }, data: { status: client_1.UserStatus.ACTIVE } });
        await tx.user.updateMany({ where: { id: userId, emailVerifiedAt: null }, data: { emailVerifiedAt: at } });
    }
    setEmailVerified(tx, userId, at) {
        return tx.user.update({ where: { id: userId }, data: { emailVerifiedAt: at }, select: { id: true } });
    }
    // ------------------------------------------------ sessions
    createSession(tx, data) {
        return tx.userSession.create({ data });
    }
    findSessionByHash(tx, refreshTokenHash) {
        return tx.userSession.findUnique({ where: { refreshTokenHash } });
    }
    revokeSession(tx, id, at) {
        return tx.userSession.update({ where: { id }, data: { revokedAt: at }, select: { id: true } });
    }
    async revokeFamily(tx, familyId, at) {
        await tx.userSession.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: at } });
    }
    /** Revokes every active sign-in of a user and returns the affected family ids. */
    async revokeAllForUser(tx, userId, at) {
        const active = await tx.userSession.findMany({
            where: { userId, revokedAt: null },
            select: { familyId: true },
            distinct: ['familyId'],
        });
        await tx.userSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: at } });
        return active.map((s) => s.familyId);
    }
    listActiveSessions(tx, userId, now) {
        return tx.userSession.findMany({
            where: { userId, revokedAt: null, expiresAt: { gt: now } },
            orderBy: { lastUsedAt: 'desc' },
        });
    }
    findActiveFamilyForUser(tx, userId, familyId) {
        return tx.userSession.findFirst({ where: { userId, familyId, revokedAt: null } });
    }
    // ------------------------------------------------ one-time tokens
    invalidateTokens(tx, userId, type, at) {
        return tx.authToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: at } });
    }
    createAuthToken(tx, data) {
        return tx.authToken.create({ data, select: { id: true } });
    }
    findUsableToken(tx, tokenHash, type, now) {
        return tx.authToken.findFirst({
            where: { tokenHash, type, usedAt: null, expiresAt: { gt: now } },
        });
    }
    markTokenUsed(tx, id, at) {
        return tx.authToken.update({ where: { id }, data: { usedAt: at }, select: { id: true } });
    }
};
exports.AuthRepository = AuthRepository;
exports.AuthRepository = AuthRepository = __decorate([
    (0, common_1.Injectable)()
], AuthRepository);
//# sourceMappingURL=auth.repository.js.map