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
exports.StaffService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const node_crypto_1 = require("node:crypto");
const grant_1 = require("../../common/access/grant");
const app_exception_1 = require("../../common/http/app-exception");
const errors_1 = require("../../common/http/errors");
const response_interceptor_1 = require("../../common/http/response.interceptor");
const config_module_1 = require("../../config/config.module");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const redis_service_1 = require("../../database/redis/redis.service");
const audit_service_1 = require("../audit/audit.service");
const auth_repository_1 = require("../auth/auth.repository");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const password_service_1 = require("../auth/password.service");
const token_service_1 = require("../auth/token.service");
const mail_service_1 = require("../mail/mail.service");
const INVITE_TTL_HOURS = 72;
const userInclude = {
    roleAssignments: { include: { role: { select: { key: true, name: true, permissions: { select: { permission: { select: { key: true } } } } } } } },
};
const forbidden = (message) => new app_exception_1.AppException('CANNOT_GRANT', message, common_1.HttpStatus.FORBIDDEN);
let StaffService = class StaffService {
    prisma;
    audit;
    authRepo;
    passwords;
    tokens;
    mail;
    redis;
    env;
    constructor(prisma, audit, authRepo, passwords, tokens, mail, redis, env) {
        this.prisma = prisma;
        this.audit = audit;
        this.authRepo = authRepo;
        this.passwords = passwords;
        this.tokens = tokens;
        this.mail = mail;
        this.redis = redis;
        this.env = env;
    }
    // ================================================================ list
    async list(query, access) {
        const scope = access.scopeOf('staff.read');
        const empty = new response_interceptor_1.Paginated([], { page: query.page, pageSize: query.pageSize, total: 0 });
        if (!scope.all && scope.ids.size === 0)
            return empty;
        const tokens = (query.search ?? '').split(/\s+/).filter(Boolean).slice(0, 4);
        return this.prisma.forTenant(async (tx) => {
            const { properties, groups } = await this.catalog(tx);
            const visibleGroupIds = scope.all ? [] : [...new Set(properties.filter((p) => scope.ids.has(p.id) && p.groupId).map((p) => p.groupId))];
            const where = {
                deletedAt: null,
                ...(scope.all ? {} : { roleAssignments: { some: { OR: [{ scopeType: client_1.ScopeType.PROPERTY, scopeId: { in: [...scope.ids] } }, { scopeType: client_1.ScopeType.GROUP, scopeId: { in: visibleGroupIds } }] } } }),
                AND: tokens.map((t) => ({ OR: [{ firstName: { contains: t, mode: 'insensitive' } }, { lastName: { contains: t, mode: 'insensitive' } }, { email: { contains: t, mode: 'insensitive' } }] })),
            };
            const [rows, total] = await Promise.all([
                tx.user.findMany({ where, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize, include: userInclude }),
                tx.user.count({ where }),
            ]);
            const names = this.labels(properties, groups);
            const items = rows.map((u) => this.toView(u, access, properties, names, scope.all ? null : { propertyIds: scope.ids, groupIds: new Set(visibleGroupIds) }));
            return new response_interceptor_1.Paginated(items, { page: query.page, pageSize: query.pageSize, total });
        });
    }
    // ================================================================ invite
    async invite(dto, access) {
        const placeholder = await this.passwords.hash((0, node_crypto_1.randomBytes)(32).toString('hex')); // nobody knows it; the invite link sets the real one
        const created = await this.prisma.forTenant(async (tx) => {
            const { properties, groups } = await this.catalog(tx);
            const role = await this.requireGrantable(tx, access, dto.assignment, properties, groups);
            if (await tx.user.findFirst({ where: { email: dto.email }, select: { id: true } })) {
                throw (0, errors_1.conflict)('EMAIL_TAKEN', 'Someone already has an account with this email address.');
            }
            const user = await tx.user.create({
                data: { organizationId: access.organizationId, email: dto.email, passwordHash: placeholder, firstName: dto.firstName, lastName: dto.lastName, status: client_1.UserStatus.INVITED },
            });
            await tx.userRoleAssignment.create({
                data: { organizationId: access.organizationId, userId: user.id, roleId: role.id, scopeType: dto.assignment.scopeType, scopeId: dto.assignment.scopeId },
            });
            const token = await this.issueInvite(tx, access.organizationId, user.id);
            await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, action: 'staff.invited', entity: 'user', entityId: user.id, after: { email: dto.email, role: role.name, scope: dto.assignment.scopeType } });
            const full = await tx.user.findFirstOrThrow({ where: { id: user.id }, include: userInclude });
            return { view: this.toView(full, access, properties, this.labels(properties, groups), null), token, email: dto.email };
        });
        await this.sendInvite(created.email, dto.firstName, created.token);
        return created.view;
    }
    async resendInvite(userId, access) {
        const sent = await this.prisma.forTenant(async (tx) => {
            const { properties } = await this.catalog(tx);
            const user = await this.requireManageable(tx, userId, access, properties);
            if (user.status !== client_1.UserStatus.INVITED)
                throw (0, errors_1.conflict)('NOT_INVITED', 'This person has already accepted their invitation.');
            await this.authRepo.invalidateTokens(tx, userId, client_1.AuthTokenType.PASSWORD_RESET, new Date());
            const token = await this.issueInvite(tx, access.organizationId, userId);
            await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, action: 'staff.invite_resent', entity: 'user', entityId: userId });
            return { email: user.email, firstName: user.firstName, token };
        });
        await this.sendInvite(sent.email, sent.firstName, sent.token);
    }
    // ================================================================ role assignments
    async addAssignment(userId, dto, access) {
        return this.prisma.forTenant(async (tx) => {
            if (userId === access.userId)
                throw forbidden("You can't change your own access. Ask another administrator.");
            const { properties, groups } = await this.catalog(tx);
            const user = await this.requireManageable(tx, userId, access, properties);
            const role = await this.requireGrantable(tx, access, dto, properties, groups);
            if (await tx.userRoleAssignment.findFirst({ where: { userId, roleId: role.id, scopeType: dto.scopeType, scopeId: dto.scopeId }, select: { id: true } })) {
                throw (0, errors_1.conflict)('ASSIGNMENT_EXISTS', 'This person already has that role there.');
            }
            await tx.userRoleAssignment.create({ data: { organizationId: access.organizationId, userId, roleId: role.id, scopeType: dto.scopeType, scopeId: dto.scopeId } });
            await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, action: 'staff.role_assigned', entity: 'user', entityId: userId, after: { user: user.email, role: role.name, scope: dto.scopeType, scopeId: dto.scopeId } });
            const full = await tx.user.findFirstOrThrow({ where: { id: userId }, include: userInclude });
            return this.toView(full, access, properties, this.labels(properties, groups), null);
        });
    }
    async removeAssignment(userId, assignmentId, access) {
        return this.prisma.forTenant(async (tx) => {
            if (userId === access.userId)
                throw forbidden("You can't change your own access. Ask another administrator.");
            const { properties, groups } = await this.catalog(tx);
            const user = await this.requireManageable(tx, userId, access, properties);
            const assignment = user.roleAssignments.find((a) => a.id === assignmentId);
            if (!assignment)
                throw (0, errors_1.notFound)('Role assignment');
            if (assignment.role.key === 'OWNER' && assignment.scopeType === client_1.ScopeType.ORGANIZATION)
                await this.requireAnotherOwner(tx, userId);
            await tx.userRoleAssignment.delete({ where: { id: assignmentId } });
            await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, action: 'staff.role_removed', entity: 'user', entityId: userId, before: { user: user.email, role: assignment.role.name, scope: assignment.scopeType, scopeId: assignment.scopeId } });
            const full = await tx.user.findFirstOrThrow({ where: { id: userId }, include: userInclude });
            return this.toView(full, access, properties, this.labels(properties, groups), null);
        });
    }
    // ================================================================ disable / enable
    async setActive(userId, active, access) {
        const result = await this.prisma.forTenant(async (tx) => {
            if (userId === access.userId)
                throw forbidden("You can't disable your own account.");
            const { properties, groups } = await this.catalog(tx);
            const user = await this.requireManageable(tx, userId, access, properties);
            let families = [];
            if (active) {
                await tx.user.update({ where: { id: userId }, data: { status: user.emailVerifiedAt || user.lastLoginAt ? client_1.UserStatus.ACTIVE : client_1.UserStatus.INVITED } });
            }
            else {
                if (user.roleAssignments.some((a) => a.role.key === 'OWNER' && a.scopeType === client_1.ScopeType.ORGANIZATION))
                    await this.requireAnotherOwner(tx, userId);
                await tx.user.update({ where: { id: userId }, data: { status: client_1.UserStatus.DISABLED } });
                families = await this.authRepo.revokeAllForUser(tx, userId, new Date()); // sign them out everywhere
            }
            await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, action: active ? 'staff.enabled' : 'staff.disabled', entity: 'user', entityId: userId, after: { user: user.email } });
            const full = await tx.user.findFirstOrThrow({ where: { id: userId }, include: userInclude });
            return { view: this.toView(full, access, properties, this.labels(properties, groups), null), families };
        });
        await Promise.all(result.families.map((f) => this.redis.client.set((0, jwt_auth_guard_1.revokedFamilyKey)(f), '1', 'EX', this.tokens.accessTtlSeconds + 30)));
        return result.view;
    }
    // ================================================================ internals
    async catalog(tx) {
        const [properties, groups] = await Promise.all([
            tx.property.findMany({ where: { deletedAt: null }, select: { id: true, name: true, groupId: true } }),
            tx.propertyGroup.findMany({ where: { deletedAt: null }, select: { id: true, name: true } }),
        ]);
        return { properties, groups };
    }
    labels(properties, groups) {
        return new Map([...properties.map((p) => [p.id, p.name]), ...groups.map((g) => [g.id, `${g.name} (group)`])]);
    }
    /** The role must exist, the scope must be real and visible, and the caller must hold everything the role grants. */
    async requireGrantable(tx, access, dto, properties, groups) {
        const role = await tx.role.findFirst({ where: { id: dto.roleId }, include: { permissions: { select: { permission: { select: { key: true } } } } } });
        if (!role)
            throw (0, errors_1.badRequest)('INVALID_ROLE', 'That role does not exist.');
        if (dto.scopeType === client_1.ScopeType.ORGANIZATION && dto.scopeId !== access.organizationId)
            throw (0, errors_1.badRequest)('INVALID_SCOPE', 'Invalid organization scope.');
        if (dto.scopeType === client_1.ScopeType.GROUP && !groups.some((g) => g.id === dto.scopeId))
            throw (0, errors_1.badRequest)('INVALID_SCOPE', 'That property group does not exist.');
        if (dto.scopeType === client_1.ScopeType.PROPERTY && !properties.some((p) => p.id === dto.scopeId))
            throw (0, errors_1.badRequest)('INVALID_SCOPE', 'That property does not exist.');
        const permissions = role.permissions.map((rp) => rp.permission.key);
        if (!(0, grant_1.canGrant)(access, permissions, dto.scopeType, dto.scopeId, properties)) {
            throw forbidden("You can't give someone more access than you have. Choose a role (or a smaller scope) within your own access.");
        }
        return role;
    }
    /** The person's whole current access must be within the caller's own, so a manager can't touch an owner. */
    async requireManageable(tx, userId, access, properties) {
        const user = await tx.user.findFirst({ where: { id: userId, deletedAt: null }, include: userInclude });
        if (!user)
            throw (0, errors_1.notFound)('Staff member');
        if (!this.isManageable(user, access, properties))
            throw forbidden("This person has more access than you, so you can't change their account.");
        return user;
    }
    isManageable(user, access, properties) {
        return user.id !== access.userId && user.roleAssignments.every((a) => (0, grant_1.canGrant)(access, a.role.permissions.map((rp) => rp.permission.key), a.scopeType, a.scopeId, properties));
    }
    /** Never leave the organization without an active owner. */
    async requireAnotherOwner(tx, exceptUserId) {
        const others = await tx.userRoleAssignment.count({
            where: { userId: { not: exceptUserId }, scopeType: client_1.ScopeType.ORGANIZATION, role: { key: 'OWNER' }, user: { status: { in: [client_1.UserStatus.ACTIVE, client_1.UserStatus.INVITED] }, deletedAt: null } },
        });
        if (others === 0)
            throw (0, errors_1.conflict)('LAST_OWNER', 'This is the last owner. Make someone else an owner first.');
    }
    async issueInvite(tx, organizationId, userId) {
        const { token, hash } = this.tokens.generateOpaqueToken();
        await this.authRepo.createAuthToken(tx, { organizationId, userId, type: client_1.AuthTokenType.PASSWORD_RESET, tokenHash: hash, expiresAt: new Date(Date.now() + INVITE_TTL_HOURS * 3_600_000) });
        return token;
    }
    sendInvite(email, firstName, token) {
        return this.mail.send({
            to: email,
            subject: "You've been invited",
            text: `Hi ${firstName},\n\nYou have been invited to join the team. Choose your password here:\n\n${this.env.WEB_ORIGIN}/reset-password?token=${token}\n\nThis link is valid for ${INVITE_TTL_HOURS} hours.`,
        });
    }
    toView(u, access, properties, names, visibleOnly) {
        const visible = (a) => visibleOnly === null || a.scopeType === client_1.ScopeType.ORGANIZATION || (a.scopeType === client_1.ScopeType.PROPERTY && visibleOnly.propertyIds.has(a.scopeId)) || (a.scopeType === client_1.ScopeType.GROUP && visibleOnly.groupIds.has(a.scopeId));
        const assignments = u.roleAssignments.filter(visible).map((a) => ({
            id: a.id,
            roleKey: a.role.key,
            roleName: a.role.name,
            scopeType: a.scopeType,
            scopeId: a.scopeId,
            scopeLabel: a.scopeType === client_1.ScopeType.ORGANIZATION ? 'Whole organization' : (names.get(a.scopeId) ?? 'Unknown'),
        }));
        return {
            id: u.id,
            firstName: u.firstName,
            lastName: u.lastName,
            fullName: `${u.firstName} ${u.lastName}`,
            email: u.email,
            status: u.status,
            emailVerified: u.emailVerifiedAt !== null,
            lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
            assignments,
            manageable: this.isManageable(u, access, properties),
        };
    }
};
exports.StaffService = StaffService;
exports.StaffService = StaffService = __decorate([
    (0, common_1.Injectable)(),
    __param(7, (0, common_1.Inject)(config_module_1.ENV)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        auth_repository_1.AuthRepository,
        password_service_1.PasswordService,
        token_service_1.TokenService,
        mail_service_1.MailService,
        redis_service_1.RedisService, Object])
], StaffService);
//# sourceMappingURL=staff.service.js.map