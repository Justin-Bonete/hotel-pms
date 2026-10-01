import { Injectable } from '@nestjs/common';
import { AuthTokenType, ScopeType, UserStatus } from '@prisma/client';
import type { Tx } from '../../database/prisma/prisma.service';

/** Data access for auth. Every method runs inside a transaction opened by the service. */
@Injectable()
export class AuthRepository {
  findUserByEmail(tx: Tx, email: string) {
    return tx.user.findFirst({ where: { email, deletedAt: null }, include: { organization: true } });
  }

  findUserById(tx: Tx, id: string) {
    return tx.user.findFirst({ where: { id, deletedAt: null }, include: { organization: true } });
  }

  getUserWithRoles(tx: Tx, id: string) {
    return tx.user.findFirst({
      where: { id, deletedAt: null },
      include: {
        organization: true,
        roleAssignments: { include: { role: { select: { key: true, name: true } } } },
      },
    });
  }

  slugExists(tx: Tx, slug: string) {
    return tx.organization.count({ where: { slug } }).then((n) => n > 0);
  }

  createOrganization(tx: Tx, data: { name: string; slug: string }) {
    return tx.organization.create({ data });
  }

  createUser(
    tx: Tx,
    data: { organizationId: string; email: string; passwordHash: string; firstName: string; lastName: string },
  ) {
    return tx.user.create({ data: { ...data, status: UserStatus.ACTIVE }, include: { organization: true } });
  }

  findSystemRole(tx: Tx, key: string) {
    return tx.role.findFirst({ where: { organizationId: null, key } });
  }

  assignRole(tx: Tx, data: { organizationId: string; userId: string; roleId: string; scopeType: ScopeType; scopeId: string }) {
    return tx.userRoleAssignment.create({ data });
  }

  // ------------------------------------------------ login state
  recordLoginFailure(tx: Tx, userId: string, failedLoginCount: number, lockedUntil: Date | null) {
    return tx.user.update({ where: { id: userId }, data: { failedLoginCount, lockedUntil }, select: { id: true } });
  }

  recordLoginSuccess(tx: Tx, userId: string, at: Date) {
    return tx.user.update({
      where: { id: userId },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: at },
      select: { id: true },
    });
  }

  setPassword(tx: Tx, userId: string, passwordHash: string) {
    return tx.user.update({
      where: { id: userId },
      data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
      select: { id: true },
    });
  }

  setEmailVerified(tx: Tx, userId: string, at: Date) {
    return tx.user.update({ where: { id: userId }, data: { emailVerifiedAt: at }, select: { id: true } });
  }

  // ------------------------------------------------ sessions
  createSession(
    tx: Tx,
    data: {
      organizationId: string;
      userId: string;
      familyId: string;
      refreshTokenHash: string;
      deviceLabel: string;
      ip?: string;
      userAgent?: string;
      expiresAt: Date;
    },
  ) {
    return tx.userSession.create({ data });
  }

  findSessionByHash(tx: Tx, refreshTokenHash: string) {
    return tx.userSession.findUnique({ where: { refreshTokenHash } });
  }

  revokeSession(tx: Tx, id: string, at: Date) {
    return tx.userSession.update({ where: { id }, data: { revokedAt: at }, select: { id: true } });
  }

  async revokeFamily(tx: Tx, familyId: string, at: Date): Promise<void> {
    await tx.userSession.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: at } });
  }

  /** Revokes every active sign-in of a user and returns the affected family ids. */
  async revokeAllForUser(tx: Tx, userId: string, at: Date): Promise<string[]> {
    const active = await tx.userSession.findMany({
      where: { userId, revokedAt: null },
      select: { familyId: true },
      distinct: ['familyId'],
    });
    await tx.userSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: at } });
    return active.map((s) => s.familyId);
  }

  listActiveSessions(tx: Tx, userId: string, now: Date) {
    return tx.userSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: now } },
      orderBy: { lastUsedAt: 'desc' },
    });
  }

  findActiveFamilyForUser(tx: Tx, userId: string, familyId: string) {
    return tx.userSession.findFirst({ where: { userId, familyId, revokedAt: null } });
  }

  // ------------------------------------------------ one-time tokens
  invalidateTokens(tx: Tx, userId: string, type: AuthTokenType, at: Date) {
    return tx.authToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: at } });
  }

  createAuthToken(tx: Tx, data: { organizationId: string; userId: string; type: AuthTokenType; tokenHash: string; expiresAt: Date }) {
    return tx.authToken.create({ data, select: { id: true } });
  }

  findUsableToken(tx: Tx, tokenHash: string, type: AuthTokenType, now: Date) {
    return tx.authToken.findFirst({
      where: { tokenHash, type, usedAt: null, expiresAt: { gt: now } },
    });
  }

  markTokenUsed(tx: Tx, id: string, at: Date) {
    return tx.authToken.update({ where: { id }, data: { usedAt: at }, select: { id: true } });
  }
}
