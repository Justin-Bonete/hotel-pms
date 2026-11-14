"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const node_crypto_1 = require("node:crypto");
const request_context_1 = require("../../common/context/request-context");
const app_exception_1 = require("../../common/http/app-exception");
const config_module_1 = require("../../config/config.module");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const redis_service_1 = require("../../database/redis/redis.service");
const audit_service_1 = require("../audit/audit.service");
const mail_service_1 = require("../mail/mail.service");
const auth_repository_1 = require("./auth.repository");
const device_1 = require("./device");
const jwt_auth_guard_1 = require("./guards/jwt-auth.guard");
const password_service_1 = require("./password.service");
const token_service_1 = require("./token.service");
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
/** A just-rotated refresh token may be replayed briefly (two tabs refreshing at once) without alarm. */
const REUSE_GRACE_MS = 10_000;
const VERIFY_TTL_HOURS = 24;
const RESET_TTL_HOURS = 1;
const invalidCredentials = () => new app_exception_1.AppException('INVALID_CREDENTIALS', 'The email or password is incorrect.', common_1.HttpStatus.UNAUTHORIZED);
const invalidRefresh = () => new app_exception_1.AppException('SESSION_INVALID', 'Your session has expired. Please sign in again.', common_1.HttpStatus.UNAUTHORIZED);
const accountDisabled = () => new app_exception_1.AppException('ACCOUNT_DISABLED', 'This account is disabled. Contact your administrator.', common_1.HttpStatus.FORBIDDEN);
const badToken = () => new app_exception_1.AppException('TOKEN_INVALID', 'This link is invalid or has expired. Please request a new one.', common_1.HttpStatus.BAD_REQUEST);
function slugify(name) {
    const base = name
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40);
    return base || 'organization';
}
let AuthService = class AuthService {
    prisma;
    repo;
    passwords;
    tokens;
    audit;
    mail;
    redis;
    env;
    constructor(prisma, repo, passwords, tokens, audit, mail, redis, env) {
        this.prisma = prisma;
        this.repo = repo;
        this.passwords = passwords;
        this.tokens = tokens;
        this.audit = audit;
        this.mail = mail;
        this.redis = redis;
        this.env = env;
    }
    // ================================================================ register
    async register(dto) {
        const passwordHash = await this.passwords.hash(dto.password); // slow: keep outside the transaction
        const created = await this.prisma.withoutTenant('auth.register', async (tx) => {
            const ownerRole = await this.repo.findSystemRole(tx, 'OWNER');
            if (!ownerRole) {
                throw new app_exception_1.AppException('SETUP_INCOMPLETE', 'System roles are missing. Run "pnpm db:seed" and try again.', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
            }
            if (await this.repo.findUserByEmail(tx, dto.email)) {
                throw new app_exception_1.AppException('EMAIL_TAKEN', 'An account with this email already exists.', common_1.HttpStatus.CONFLICT);
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
                scopeType: client_1.ScopeType.ORGANIZATION,
                scopeId: org.id,
            });
            const verifyToken = await this.issueOneTimeToken(tx, org.id, user.id, client_1.AuthTokenType.EMAIL_VERIFICATION, VERIFY_TTL_HOURS);
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
    async login(dto) {
        // Failures are RETURNED (not thrown) inside the transaction so the lockout counter still commits.
        const outcome = await this.prisma.withoutTenant('auth.login', async (tx) => {
            const user = await this.repo.findUserByEmail(tx, dto.email);
            const now = new Date();
            if (!user) {
                await this.passwords.spendVerifyTime(dto.password);
                return { kind: 'invalid' };
            }
            if (user.lockedUntil && user.lockedUntil > now) {
                return { kind: 'locked', minutes: Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 60_000) };
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
                return { kind: 'invalid' };
            }
            if (user.status === client_1.UserStatus.DISABLED || user.organization.status !== client_1.OrganizationStatus.ACTIVE) {
                return { kind: 'disabled' };
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
            return { kind: 'ok', user, session };
        });
        switch (outcome.kind) {
            case 'ok':
                return this.buildResult(outcome.user, outcome.session);
            case 'locked':
                throw new app_exception_1.AppException('ACCOUNT_LOCKED', `Too many failed attempts. Try again in ${outcome.minutes} minute(s), or reset your password.`, common_1.HttpStatus.TOO_MANY_REQUESTS);
            case 'disabled':
                throw accountDisabled();
            default:
                throw invalidCredentials();
        }
    }
    // ================================================================ refresh (rotating, reuse-detecting)
    async refresh(refreshToken) {
        if (!refreshToken)
            throw invalidRefresh();
        const hash = this.tokens.hash(refreshToken);
        const outcome = await this.prisma.withoutTenant('auth.refresh', async (tx) => {
            const old = await this.repo.findSessionByHash(tx, hash);
            if (!old)
                return { kind: 'invalid' };
            const now = new Date();
            if (old.revokedAt) {
                if (now.getTime() - old.revokedAt.getTime() <= REUSE_GRACE_MS)
                    return { kind: 'invalid' };
                // A retired token came back: assume theft and end the whole sign-in family.
                await this.repo.revokeFamily(tx, old.familyId, now);
                await this.audit.record(tx, {
                    organizationId: old.organizationId,
                    actorId: old.userId,
                    action: 'auth.refresh_reuse_detected',
                    entity: 'user_session',
                    entityId: old.familyId,
                });
                return { kind: 'reuse', familyId: old.familyId };
            }
            if (old.expiresAt <= now)
                return { kind: 'invalid' };
            const user = await this.repo.findUserById(tx, old.userId);
            if (!user || user.status === client_1.UserStatus.DISABLED || user.organization.status !== client_1.OrganizationStatus.ACTIVE) {
                await this.repo.revokeFamily(tx, old.familyId, now);
                return { kind: 'invalid' };
            }
            await this.repo.revokeSession(tx, old.id, now);
            const session = await this.startSession(tx, user, old.familyId);
            return { kind: 'ok', user, session };
        });
        if (outcome.kind === 'ok')
            return this.buildResult(outcome.user, outcome.session);
        if (outcome.kind === 'reuse')
            await this.denylistFamily(outcome.familyId);
        throw invalidRefresh();
    }
    // ================================================================ logout
    async logout(refreshToken) {
        if (!refreshToken)
            return;
        const hash = this.tokens.hash(refreshToken);
        const familyId = await this.prisma.withoutTenant('auth.logout', async (tx) => {
            const session = await this.repo.findSessionByHash(tx, hash);
            if (!session)
                return null;
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
        if (familyId)
            await this.denylistFamily(familyId);
    }
    // ================================================================ me + devices
    async me(userId) {
        const user = await this.prisma.forTenant((tx) => this.repo.getUserWithRoles(tx, userId));
        if (!user)
            throw new app_exception_1.AppException('UNAUTHENTICATED', 'Please sign in to continue.', common_1.HttpStatus.UNAUTHORIZED);
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
    async listSessions(userId, currentFamilyId) {
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
    async revokeSession(userId, organizationId, familyId) {
        await this.prisma.forTenant(async (tx) => {
            const active = await this.repo.findActiveFamilyForUser(tx, userId, familyId);
            if (!active)
                throw new app_exception_1.AppException('NOT_FOUND', 'That device session was not found.', common_1.HttpStatus.NOT_FOUND);
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
    async verifyEmail(dto) {
        const hash = this.tokens.hash(dto.token);
        await this.prisma.withoutTenant('auth.verify-email', async (tx) => {
            const now = new Date();
            const token = await this.repo.findUsableToken(tx, hash, client_1.AuthTokenType.EMAIL_VERIFICATION, now);
            if (!token)
                throw badToken();
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
    async resendVerification(userId) {
        const issued = await this.prisma.forTenant(async (tx) => {
            const user = await this.repo.findUserById(tx, userId);
            if (!user || user.emailVerifiedAt)
                return null;
            const now = new Date();
            await this.repo.invalidateTokens(tx, user.id, client_1.AuthTokenType.EMAIL_VERIFICATION, now);
            const token = await this.issueOneTimeToken(tx, user.organizationId, user.id, client_1.AuthTokenType.EMAIL_VERIFICATION, VERIFY_TTL_HOURS);
            return { email: user.email, token };
        });
        if (issued)
            await this.sendVerificationEmail(issued.email, issued.token);
    }
    // ================================================================ password reset
    /** Always succeeds from the caller's point of view, so it can't be used to discover accounts. */
    async forgotPassword(dto) {
        const issued = await this.prisma.withoutTenant('auth.forgot-password', async (tx) => {
            const user = await this.repo.findUserByEmail(tx, dto.email);
            if (!user || user.status === client_1.UserStatus.DISABLED)
                return null;
            await this.repo.invalidateTokens(tx, user.id, client_1.AuthTokenType.PASSWORD_RESET, new Date());
            const token = await this.issueOneTimeToken(tx, user.organizationId, user.id, client_1.AuthTokenType.PASSWORD_RESET, RESET_TTL_HOURS);
            await this.audit.record(tx, {
                organizationId: user.organizationId,
                actorId: user.id,
                action: 'auth.password_reset_requested',
                entity: 'user',
                entityId: user.id,
            });
            return { email: user.email, token };
        });
        if (!issued)
            return;
        await this.mail.send({
            to: issued.email,
            subject: 'Reset your password',
            text: `Use this link to choose a new password (valid for ${RESET_TTL_HOURS} hour):\n\n${this.env.WEB_ORIGIN}/reset-password?token=${issued.token}\n\nIf you didn't ask for this, you can ignore this email.`,
        });
    }
    async resetPassword(dto) {
        const hash = this.tokens.hash(dto.token);
        const passwordHash = await this.passwords.hash(dto.password);
        const families = await this.prisma.withoutTenant('auth.reset-password', async (tx) => {
            const now = new Date();
            const token = await this.repo.findUsableToken(tx, hash, client_1.AuthTokenType.PASSWORD_RESET, now);
            if (!token)
                throw badToken();
            await this.repo.markTokenUsed(tx, token.id, now);
            await this.repo.setPassword(tx, token.userId, passwordHash);
            await this.repo.activateAfterPasswordSet(tx, token.userId, now);
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
    async startSession(tx, user, familyId = (0, node_crypto_1.randomUUID)()) {
        const ctx = request_context_1.RequestContextStore.get();
        const refresh = this.tokens.generateOpaqueToken();
        const expiresAt = this.tokens.refreshExpiry();
        await this.repo.createSession(tx, {
            organizationId: user.organizationId,
            userId: user.id,
            familyId,
            refreshTokenHash: refresh.hash,
            deviceLabel: (0, device_1.describeDevice)(ctx?.userAgent),
            ip: ctx?.ip,
            userAgent: ctx?.userAgent,
            expiresAt,
        });
        return { familyId, refreshToken: refresh.token, expiresAt };
    }
    buildResult(user, session) {
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
    toPublicUser(user) {
        return {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            emailVerified: user.emailVerifiedAt !== null,
            organization: { id: user.organization.id, name: user.organization.name, slug: user.organization.slug },
        };
    }
    async issueOneTimeToken(tx, organizationId, userId, type, ttlHours) {
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
    sendVerificationEmail(to, token) {
        return this.mail.send({
            to,
            subject: 'Verify your email address',
            text: `Confirm your email to finish setting up your account:\n\n${this.env.WEB_ORIGIN}/verify-email?token=${token}\n\nThis link is valid for ${VERIFY_TTL_HOURS} hours.`,
        });
    }
    async uniqueSlug(tx, name) {
        const base = slugify(name);
        if (!(await this.repo.slugExists(tx, base)))
            return base;
        for (let i = 0; i < 5; i++) {
            const candidate = `${base}-${(0, node_crypto_1.randomBytes)(2).toString('hex')}`;
            if (!(await this.repo.slugExists(tx, candidate)))
                return candidate;
        }
        throw new app_exception_1.AppException('SLUG_UNAVAILABLE', 'Could not create a unique organization address. Try a different name.', common_1.HttpStatus.CONFLICT);
    }
    /** Block the family's access tokens until the longest-lived one would have expired anyway. */
    denylistFamily(familyId) {
        return this.redis.client.set((0, jwt_auth_guard_1.revokedFamilyKey)(familyId), '1', 'EX', this.tokens.accessTtlSeconds + 30);
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(7, (0, common_1.Inject)(config_module_1.ENV)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        auth_repository_1.AuthRepository,
        password_service_1.PasswordService,
        token_service_1.TokenService,
        audit_service_1.AuditService,
        mail_service_1.MailService,
        redis_service_1.RedisService, Object])
], AuthService);
//# sourceMappingURL=auth.service.js.map