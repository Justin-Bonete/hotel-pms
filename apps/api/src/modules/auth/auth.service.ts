import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { AuthTokenType, OrganizationStatus, ScopeType, UserStatus } from '@prisma/client';
import type { ForgotPasswordInput, LoginInput, RegisterInput, ResetPasswordInput, VerifyEmailInput } from '@pms/validation';
import { randomBytes, randomUUID } from 'node:crypto';
import { RequestContextStore } from '../../common/context/request-context';
import { AppException } from '../../common/http/app-exception';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';
import { PrismaService, Tx } from '../../database/prisma/prisma.service';
import { RedisService } from '../../database/redis/redis.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { AuthRepository } from './auth.repository';
import { describeDevice } from './device';
import { revokedFamilyKey } from './guards/jwt-auth.guard';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
/** A just-rotated refresh token may be replayed briefly (two tabs refreshing at once) without alarm. */
const REUSE_GRACE_MS = 10_000;
const VERIFY_TTL_HOURS = 24;
const RESET_TTL_HOURS = 1;

export interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
  organization: { id: string; name: string; slug: string };
}

export interface AuthResult {
  accessToken: string;
  expiresIn: number;
  user: PublicUser;
  refreshToken: string;
  refreshExpiresAt: Date;
}

type UserWithOrg = NonNullable<Awaited<ReturnType<AuthRepository['findUserById']>>>;

const invalidCredentials = () =>
  new AppException('INVALID_CREDENTIALS', 'The email or password is incorrect.', HttpStatus.UNAUTHORIZED);
const invalidRefresh = () =>
  new AppException('SESSION_INVALID', 'Your session has expired. Please sign in again.', HttpStatus.UNAUTHORIZED);
const accountDisabled = () =>
  new AppException('ACCOUNT_DISABLED', 'This account is disabled. Contact your administrator.', HttpStatus.FORBIDDEN);
const badToken = () =>
  new AppException('TOKEN_INVALID', 'This link is invalid or has expired. Please request a new one.', HttpStatus.BAD_REQUEST);

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return base || 'organization';
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: AuthRepository,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly redis: RedisService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // ================================================================ register
  async register(dto: RegisterInput): Promise<AuthResult> {
    const passwordHash = await this.passwords.hash(dto.password); // slow: keep outside the transaction

    const created = await this.prisma.withoutTenant('auth.register', async (tx) => {
      const ownerRole = await this.repo.findSystemRole(tx, 'OWNER');
      if (!ownerRole) {
        throw new AppException(
          'SETUP_INCOMPLETE',
          'System roles are missing. Run "pnpm db:seed" and try again.',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      if (await this.repo.findUserByEmail(tx, dto.email)) {
        throw new AppException('EMAIL_TAKEN', 'An account with this email already exists.', HttpStatus.CONFLICT);
      }

      const org = await this.repo.createOrganization(tx, {
        name: dto.organizationName,
        slug: await this.uniqueSlug(tx, dto.organizationName),
      });
      const user = await this.repo.createUser(tx, {
        organizationId: org.id,
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
      });
      await this.repo.assignRole(tx, {
        organizationId: org.id,
        userId: user.id,
        roleId: ownerRole.id,
        scopeType: ScopeType.ORGANIZATION,
        scopeId: org.id,
      });

      const verifyToken = await this.issueOneTimeToken(tx, org.id, user.id, AuthTokenType.EMAIL_VERIFICATION, VERIFY_TTL_HOURS);
      const session = await this.startSession(tx, user);
      await this.audit.record(tx, {
        organizationId: org.id,
        actorId: user.id,
        action: 'organization.registered',
        entity: 'organization',
        entityId: org.id,
        after: { name: org.name, slug: org.slug },
      });
      return { user, verifyToken, session };
    });

    await this.sendVerificationEmail(created.user.email, created.verifyToken);
    return this.buildResult(created.user, created.session);
  }

  // ================================================================ login
  async login(dto: LoginInput): Promise<AuthResult> {
    // Failures are RETURNED (not thrown) inside the transaction so the lockout counter still commits.
    const outcome = await this.prisma.withoutTenant('auth.login', async (tx) => {
      const user = await this.repo.findUserByEmail(tx, dto.email);
      const now = new Date();

      if (!user) {
        await this.passwords.spendVerifyTime(dto.password);
        return { kind: 'invalid' } as const;
      }

      if (user.lockedUntil && user.lockedUntil > now) {
        return { kind: 'locked', minutes: Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 60_000) } as const;
      }

      if (!(await this.passwords.verify(user.passwordHash, dto.password))) {
        const failed = user.failedLoginCount + 1;
        const lock = failed >= MAX_FAILED_LOGINS ? new Date(now.getTime() + LOCK_MINUTES * 60_000) : null;
        await this.repo.recordLoginFailure(tx, user.id, lock ? 0 : failed, lock);
        await this.audit.record(tx, {
          organizationId: user.organizationId,
          actorId: user.id,
          action: lock ? 'auth.account_locked' : 'auth.login_failed',
          entity: 'user',
          entityId: user.id,
        });
        return { kind: 'invalid' } as const;
      }

      if (user.status === UserStatus.DISABLED || user.organization.status !== OrganizationStatus.ACTIVE) {
        return { kind: 'disabled' } as const;
      }

      await this.repo.recordLoginSuccess(tx, user.id, now);
      const session = await this.startSession(tx, user);
      await this.audit.record(tx, {
        organizationId: user.organizationId,
        actorId: user.id,
        action: 'auth.login',
        entity: 'user',
        entityId: user.id,
      });
      return { kind: 'ok', user, session } as const;
    });

    switch (outcome.kind) {
      case 'ok':
        return this.buildResult(outcome.user, outcome.session);
      case 'locked':
        throw new AppException(
          'ACCOUNT_LOCKED',
          `Too many failed attempts. Try again in ${outcome.minutes} minute(s), or reset your password.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      case 'disabled':
        throw accountDisabled();
      default:
        throw invalidCredentials();
    }
  }

  // ================================================================ refresh (rotating, reuse-detecting)
  async refresh(refreshToken: string | undefined): Promise<AuthResult> {
    if (!refreshToken) throw invalidRefresh();
    const hash = this.tokens.hash(refreshToken);

    const outcome = await this.prisma.withoutTenant('auth.refresh', async (tx) => {
      const old = await this.repo.findSessionByHash(tx, hash);
      if (!old) return { kind: 'invalid' } as const;

      const now = new Date();
      if (old.revokedAt) {
        if (now.getTime() - old.revokedAt.getTime() <= REUSE_GRACE_MS) return { kind: 'invalid' } as const;
        // A retired token came back: assume theft and end the whole sign-in family.
        await this.repo.revokeFamily(tx, old.familyId, now);
        await this.audit.record(tx, {
          organizationId: old.organizationId,
          actorId: old.userId,
          action: 'auth.refresh_reuse_detected',
          entity: 'user_session',
          entityId: old.familyId,
        });
        return { kind: 'reuse', familyId: old.familyId } as const;
      }
      if (old.expiresAt <= now) return { kind: 'invalid' } as const;

      const user = await this.repo.findUserById(tx, old.userId);
      if (!user || user.status === UserStatus.DISABLED || user.organization.status !== OrganizationStatus.ACTIVE) {
        await this.repo.revokeFamily(tx, old.familyId, now);
        return { kind: 'invalid' } as const;
      }

      await this.repo.revokeSession(tx, old.id, now);
      const session = await this.startSession(tx, user, old.familyId);
      return { kind: 'ok', user, session } as const;
    });

    if (outcome.kind === 'ok') return this.buildResult(outcome.user, outcome.session);
    if (outcome.kind === 'reuse') await this.denylistFamily(outcome.familyId);
    throw invalidRefresh();
  }

  // ================================================================ logout
  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    const hash = this.tokens.hash(refreshToken);
    const familyId = await this.prisma.withoutTenant('auth.logout', async (tx) => {
      const session = await this.repo.findSessionByHash(tx, hash);
      if (!session) return null;
      await this.repo.revokeFamily(tx, session.familyId, new Date());
      await this.audit.record(tx, {
        organizationId: session.organizationId,
        actorId: session.userId,
        action: 'auth.logout',
        entity: 'user_session',
        entityId: session.familyId,
      });
      return session.familyId;
    });
    if (familyId) await this.denylistFamily(familyId);
  }

  // ================================================================ me + devices
  async me(userId: string) {
    const user = await this.prisma.forTenant((tx) => this.repo.getUserWithRoles(tx, userId));
    if (!user) throw new AppException('UNAUTHENTICATED', 'Please sign in to continue.', HttpStatus.UNAUTHORIZED);
    return {
      ...this.toPublicUser(user),
      roles: user.roleAssignments.map((a) => ({
        key: a.role.key,
        name: a.role.name,
        scopeType: a.scopeType,
        scopeId: a.scopeId,
      })),
    };
  }

  async listSessions(userId: string, currentFamilyId: string) {
    const sessions = await this.prisma.forTenant((tx) => this.repo.listActiveSessions(tx, userId, new Date()));
    return sessions.map((s) => ({
      id: s.familyId,
      device: s.deviceLabel,
      ip: s.ip,
      signedInAt: s.createdAt,
      lastActiveAt: s.lastUsedAt,
      current: s.familyId === currentFamilyId,
    }));
  }

  async revokeSession(userId: string, organizationId: string, familyId: string): Promise<void> {
    await this.prisma.forTenant(async (tx) => {
      const active = await this.repo.findActiveFamilyForUser(tx, userId, familyId);
      if (!active) throw new AppException('NOT_FOUND', 'That device session was not found.', HttpStatus.NOT_FOUND);
      await this.repo.revokeFamily(tx, familyId, new Date());
      await this.audit.record(tx, {
        organizationId,
        actorId: userId,
        action: 'auth.session_revoked',
        entity: 'user_session',
        entityId: familyId,
      });
    });
    await this.denylistFamily(familyId);
  }

  // ================================================================ email verification
  async verifyEmail(dto: VerifyEmailInput): Promise<void> {
    const hash = this.tokens.hash(dto.token);
    await this.prisma.withoutTenant('auth.verify-email', async (tx) => {
      const now = new Date();
      const token = await this.repo.findUsableToken(tx, hash, AuthTokenType.EMAIL_VERIFICATION, now);
      if (!token) throw badToken();
      await this.repo.markTokenUsed(tx, token.id, now);
      await this.repo.setEmailVerified(tx, token.userId, now);
      await this.audit.record(tx, {
        organizationId: token.organizationId,
        actorId: token.userId,
        action: 'auth.email_verified',
        entity: 'user',
        entityId: token.userId,
      });
    });
  }

  async resendVerification(userId: string): Promise<void> {
    const issued = await this.prisma.forTenant(async (tx) => {
      const user = await this.repo.findUserById(tx, userId);
      if (!user || user.emailVerifiedAt) return null;
      const now = new Date();
      await this.repo.invalidateTokens(tx, user.id, AuthTokenType.EMAIL_VERIFICATION, now);
      const token = await this.issueOneTimeToken(tx, user.organizationId, user.id, AuthTokenType.EMAIL_VERIFICATION, VERIFY_TTL_HOURS);
      return { email: user.email, token };
    });
    if (issued) await this.sendVerificationEmail(issued.email, issued.token);
  }

  // ================================================================ password reset
  /** Always succeeds from the caller's point of view, so it can't be used to discover accounts. */
  async forgotPassword(dto: ForgotPasswordInput): Promise<void> {
    const issued = await this.prisma.withoutTenant('auth.forgot-password', async (tx) => {
      const user = await this.repo.findUserByEmail(tx, dto.email);
      if (!user || user.status === UserStatus.DISABLED) return null;
      await this.repo.invalidateTokens(tx, user.id, AuthTokenType.PASSWORD_RESET, new Date());
      const token = await this.issueOneTimeToken(tx, user.organizationId, user.id, AuthTokenType.PASSWORD_RESET, RESET_TTL_HOURS);
      await this.audit.record(tx, {
        organizationId: user.organizationId,
        actorId: user.id,
        action: 'auth.password_reset_requested',
        entity: 'user',
        entityId: user.id,
      });
      return { email: user.email, token };
    });
    if (!issued) return;
    await this.mail.send({
      to: issued.email,
      subject: 'Reset your password',
      text: `Use this link to choose a new password (valid for ${RESET_TTL_HOURS} hour):\n\n${this.env.WEB_ORIGIN}/reset-password?token=${issued.token}\n\nIf you didn't ask for this, you can ignore this email.`,
    });
  }

  async resetPassword(dto: ResetPasswordInput): Promise<void> {
    const hash = this.tokens.hash(dto.token);
    const passwordHash = await this.passwords.hash(dto.password);

    const families = await this.prisma.withoutTenant('auth.reset-password', async (tx) => {
      const now = new Date();
      const token = await this.repo.findUsableToken(tx, hash, AuthTokenType.PASSWORD_RESET, now);
      if (!token) throw badToken();
      await this.repo.markTokenUsed(tx, token.id, now);
      await this.repo.setPassword(tx, token.userId, passwordHash);
      const revoked = await this.repo.revokeAllForUser(tx, token.userId, now); // sign out everywhere
      await this.audit.record(tx, {
        organizationId: token.organizationId,
        actorId: token.userId,
        action: 'auth.password_reset',
        entity: 'user',
        entityId: token.userId,
      });
      return revoked;
    });
    await Promise.all(families.map((f) => this.denylistFamily(f)));
  }

  // ================================================================ internals
  private async startSession(tx: Tx, user: UserWithOrg, familyId: string = randomUUID()) {
    const ctx = RequestContextStore.get();
    const refresh = this.tokens.generateOpaqueToken();
    const expiresAt = this.tokens.refreshExpiry();
    await this.repo.createSession(tx, {
      organizationId: user.organizationId,
      userId: user.id,
      familyId,
      refreshTokenHash: refresh.hash,
      deviceLabel: describeDevice(ctx?.userAgent),
      ip: ctx?.ip,
      userAgent: ctx?.userAgent,
      expiresAt,
    });
    return { familyId, refreshToken: refresh.token, expiresAt };
  }

  private buildResult(user: UserWithOrg, session: { familyId: string; refreshToken: string; expiresAt: Date }): AuthResult {
    return {
      accessToken: this.tokens.signAccessToken({
        userId: user.id,
        organizationId: user.organizationId,
        familyId: session.familyId,
      }),
      expiresIn: this.tokens.accessTtlSeconds,
      user: this.toPublicUser(user),
      refreshToken: session.refreshToken,
      refreshExpiresAt: session.expiresAt,
    };
  }

  private toPublicUser(user: UserWithOrg): PublicUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      emailVerified: user.emailVerifiedAt !== null,
      organization: { id: user.organization.id, name: user.organization.name, slug: user.organization.slug },
    };
  }

  private async issueOneTimeToken(tx: Tx, organizationId: string, userId: string, type: AuthTokenType, ttlHours: number): Promise<string> {
    const { token, hash } = this.tokens.generateOpaqueToken();
    await this.repo.createAuthToken(tx, {
      organizationId,
      userId,
      type,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + ttlHours * 3_600_000),
    });
    return token;
  }

  private sendVerificationEmail(to: string, token: string): Promise<void> {
    return this.mail.send({
      to,
      subject: 'Verify your email address',
      text: `Confirm your email to finish setting up your account:\n\n${this.env.WEB_ORIGIN}/verify-email?token=${token}\n\nThis link is valid for ${VERIFY_TTL_HOURS} hours.`,
    });
  }

  private async uniqueSlug(tx: Tx, name: string): Promise<string> {
    const base = slugify(name);
    if (!(await this.repo.slugExists(tx, base))) return base;
    for (let i = 0; i < 5; i++) {
      const candidate = `${base}-${randomBytes(2).toString('hex')}`;
      if (!(await this.repo.slugExists(tx, candidate))) return candidate;
    }
    throw new AppException('SLUG_UNAVAILABLE', 'Could not create a unique organization address. Try a different name.', HttpStatus.CONFLICT);
  }

  /** Block the family's access tokens until the longest-lived one would have expired anyway. */
  private denylistFamily(familyId: string): Promise<unknown> {
    return this.redis.client.set(revokedFamilyKey(familyId), '1', 'EX', this.tokens.accessTtlSeconds + 30);
  }
}
