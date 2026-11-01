import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AuthTokenType, ScopeType, UserStatus } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import type { StaffAssignmentView, StaffView } from '@pms/types';
import type { InviteStaffInput, ScopeInput, StaffQuery } from '@pms/validation';
import { AccessContext, type PropertyRef } from '../../common/access/access-context';
import { canGrant } from '../../common/access/grant';
import { AppException } from '../../common/http/app-exception';
import { badRequest, conflict, notFound } from '../../common/http/errors';
import { Paginated } from '../../common/http/response.interceptor';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';
import { PrismaService, Tx } from '../../database/prisma/prisma.service';
import { RedisService } from '../../database/redis/redis.service';
import { AuditService } from '../audit/audit.service';
import { AuthRepository } from '../auth/auth.repository';
import { revokedFamilyKey } from '../auth/guards/jwt-auth.guard';
import { PasswordService } from '../auth/password.service';
import { TokenService } from '../auth/token.service';
import { MailService } from '../mail/mail.service';

const INVITE_TTL_HOURS = 72;

const userInclude = {
  roleAssignments: { include: { role: { select: { key: true, name: true, permissions: { select: { permission: { select: { key: true } } } } } } } },
} satisfies Prisma.UserInclude;
type UserRow = Prisma.UserGetPayload<{ include: typeof userInclude }>;

const forbidden = (message: string) => new AppException('CANNOT_GRANT', message, HttpStatus.FORBIDDEN);

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly authRepo: AuthRepository,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly mail: MailService,
    private readonly redis: RedisService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // ================================================================ list
  async list(query: StaffQuery, access: AccessContext): Promise<Paginated<StaffView>> {
    const scope = access.scopeOf('staff.read');
    const empty = new Paginated<StaffView>([], { page: query.page, pageSize: query.pageSize, total: 0 });
    if (!scope.all && scope.ids.size === 0) return empty;

    const tokens = (query.search ?? '').split(/\s+/).filter(Boolean).slice(0, 4);
    return this.prisma.forTenant(async (tx) => {
      const { properties, groups } = await this.catalog(tx);
      const visibleGroupIds = scope.all ? [] : [...new Set<string>(properties.filter((p) => scope.ids.has(p.id) && p.groupId).map((p) => p.groupId as string))];

      const where: Prisma.UserWhereInput = {
        deletedAt: null,
        ...(scope.all ? {} : { roleAssignments: { some: { OR: [{ scopeType: ScopeType.PROPERTY, scopeId: { in: [...scope.ids] } }, { scopeType: ScopeType.GROUP, scopeId: { in: visibleGroupIds } }] } } }),
        AND: tokens.map((t) => ({ OR: [{ firstName: { contains: t, mode: 'insensitive' as const } }, { lastName: { contains: t, mode: 'insensitive' as const } }, { email: { contains: t, mode: 'insensitive' as const } }] })),
      };
      const [rows, total] = await Promise.all([
        tx.user.findMany({ where, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize, include: userInclude }),
        tx.user.count({ where }),
      ]);
      const names = this.labels(properties, groups);
      const items = rows.map((u) => this.toView(u, access, properties, names, scope.all ? null : { propertyIds: scope.ids, groupIds: new Set<string>(visibleGroupIds) }));
      return new Paginated(items, { page: query.page, pageSize: query.pageSize, total });
    });
  }

  // ================================================================ invite
  async invite(dto: InviteStaffInput, access: AccessContext): Promise<StaffView> {
    const placeholder = await this.passwords.hash(randomBytes(32).toString('hex')); // nobody knows it; the invite link sets the real one
    const created = await this.prisma.forTenant(async (tx) => {
      const { properties, groups } = await this.catalog(tx);
      const role = await this.requireGrantable(tx, access, dto.assignment, properties, groups);

      if (await tx.user.findFirst({ where: { email: dto.email }, select: { id: true } })) {
        throw conflict('EMAIL_TAKEN', 'Someone already has an account with this email address.');
      }
      const user = await tx.user.create({
        data: { organizationId: access.organizationId, email: dto.email, passwordHash: placeholder, firstName: dto.firstName, lastName: dto.lastName, status: UserStatus.INVITED },
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

  async resendInvite(userId: string, access: AccessContext): Promise<void> {
    const sent = await this.prisma.forTenant(async (tx) => {
      const { properties } = await this.catalog(tx);
      const user = await this.requireManageable(tx, userId, access, properties);
      if (user.status !== UserStatus.INVITED) throw conflict('NOT_INVITED', 'This person has already accepted their invitation.');
      await this.authRepo.invalidateTokens(tx, userId, AuthTokenType.PASSWORD_RESET, new Date());
      const token = await this.issueInvite(tx, access.organizationId, userId);
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, action: 'staff.invite_resent', entity: 'user', entityId: userId });
      return { email: user.email, firstName: user.firstName, token };
    });
    await this.sendInvite(sent.email, sent.firstName, sent.token);
  }

  // ================================================================ role assignments
  async addAssignment(userId: string, dto: ScopeInput, access: AccessContext): Promise<StaffView> {
    return this.prisma.forTenant(async (tx) => {
      if (userId === access.userId) throw forbidden("You can't change your own access. Ask another administrator.");
      const { properties, groups } = await this.catalog(tx);
      const user = await this.requireManageable(tx, userId, access, properties);
      const role = await this.requireGrantable(tx, access, dto, properties, groups);
      if (await tx.userRoleAssignment.findFirst({ where: { userId, roleId: role.id, scopeType: dto.scopeType, scopeId: dto.scopeId }, select: { id: true } })) {
        throw conflict('ASSIGNMENT_EXISTS', 'This person already has that role there.');
      }
      await tx.userRoleAssignment.create({ data: { organizationId: access.organizationId, userId, roleId: role.id, scopeType: dto.scopeType, scopeId: dto.scopeId } });
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, action: 'staff.role_assigned', entity: 'user', entityId: userId, after: { user: user.email, role: role.name, scope: dto.scopeType, scopeId: dto.scopeId } });
      const full = await tx.user.findFirstOrThrow({ where: { id: userId }, include: userInclude });
      return this.toView(full, access, properties, this.labels(properties, groups), null);
    });
  }

  async removeAssignment(userId: string, assignmentId: string, access: AccessContext): Promise<StaffView> {
    return this.prisma.forTenant(async (tx) => {
      if (userId === access.userId) throw forbidden("You can't change your own access. Ask another administrator.");
      const { properties, groups } = await this.catalog(tx);
      const user = await this.requireManageable(tx, userId, access, properties);
      const assignment = user.roleAssignments.find((a) => a.id === assignmentId);
      if (!assignment) throw notFound('Role assignment');
      if (assignment.role.key === 'OWNER' && assignment.scopeType === ScopeType.ORGANIZATION) await this.requireAnotherOwner(tx, userId);

      await tx.userRoleAssignment.delete({ where: { id: assignmentId } });
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, action: 'staff.role_removed', entity: 'user', entityId: userId, before: { user: user.email, role: assignment.role.name, scope: assignment.scopeType, scopeId: assignment.scopeId } });
      const full = await tx.user.findFirstOrThrow({ where: { id: userId }, include: userInclude });
      return this.toView(full, access, properties, this.labels(properties, groups), null);
    });
  }

  // ================================================================ disable / enable
  async setActive(userId: string, active: boolean, access: AccessContext): Promise<StaffView> {
    const result = await this.prisma.forTenant(async (tx) => {
      if (userId === access.userId) throw forbidden("You can't disable your own account.");
      const { properties, groups } = await this.catalog(tx);
      const user = await this.requireManageable(tx, userId, access, properties);

      let families: string[] = [];
      if (active) {
        await tx.user.update({ where: { id: userId }, data: { status: user.emailVerifiedAt || user.lastLoginAt ? UserStatus.ACTIVE : UserStatus.INVITED } });
      } else {
        if (user.roleAssignments.some((a) => a.role.key === 'OWNER' && a.scopeType === ScopeType.ORGANIZATION)) await this.requireAnotherOwner(tx, userId);
        await tx.user.update({ where: { id: userId }, data: { status: UserStatus.DISABLED } });
        families = await this.authRepo.revokeAllForUser(tx, userId, new Date()); // sign them out everywhere
      }
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, action: active ? 'staff.enabled' : 'staff.disabled', entity: 'user', entityId: userId, after: { user: user.email } });
      const full = await tx.user.findFirstOrThrow({ where: { id: userId }, include: userInclude });
      return { view: this.toView(full, access, properties, this.labels(properties, groups), null), families };
    });
    await Promise.all(result.families.map((f) => this.redis.client.set(revokedFamilyKey(f), '1', 'EX', this.tokens.accessTtlSeconds + 30)));
    return result.view;
  }

  // ================================================================ internals
  private async catalog(tx: Tx) {
    const [properties, groups] = await Promise.all([
      tx.property.findMany({ where: { deletedAt: null }, select: { id: true, name: true, groupId: true } }),
      tx.propertyGroup.findMany({ where: { deletedAt: null }, select: { id: true, name: true } }),
    ]);
    return { properties, groups };
  }

  private labels(properties: Array<{ id: string; name: string }>, groups: Array<{ id: string; name: string }>): Map<string, string> {
    return new Map([...properties.map((p) => [p.id, p.name] as const), ...groups.map((g) => [g.id, `${g.name} (group)`] as const)]);
  }

  /** The role must exist, the scope must be real and visible, and the caller must hold everything the role grants. */
  private async requireGrantable(tx: Tx, access: AccessContext, dto: ScopeInput, properties: PropertyRef[], groups: Array<{ id: string }>) {
    const role = await tx.role.findFirst({ where: { id: dto.roleId }, include: { permissions: { select: { permission: { select: { key: true } } } } } });
    if (!role) throw badRequest('INVALID_ROLE', 'That role does not exist.');

    if (dto.scopeType === ScopeType.ORGANIZATION && dto.scopeId !== access.organizationId) throw badRequest('INVALID_SCOPE', 'Invalid organization scope.');
    if (dto.scopeType === ScopeType.GROUP && !groups.some((g) => g.id === dto.scopeId)) throw badRequest('INVALID_SCOPE', 'That property group does not exist.');
    if (dto.scopeType === ScopeType.PROPERTY && !properties.some((p) => p.id === dto.scopeId)) throw badRequest('INVALID_SCOPE', 'That property does not exist.');

    const permissions = role.permissions.map((rp) => rp.permission.key);
    if (!canGrant(access, permissions, dto.scopeType, dto.scopeId, properties)) {
      throw forbidden("You can't give someone more access than you have. Choose a role (or a smaller scope) within your own access.");
    }
    return role;
  }

  /** The person's whole current access must be within the caller's own, so a manager can't touch an owner. */
  private async requireManageable(tx: Tx, userId: string, access: AccessContext, properties: PropertyRef[]): Promise<UserRow> {
    const user = await tx.user.findFirst({ where: { id: userId, deletedAt: null }, include: userInclude });
    if (!user) throw notFound('Staff member');
    if (!this.isManageable(user, access, properties)) throw forbidden("This person has more access than you, so you can't change their account.");
    return user;
  }

  private isManageable(user: UserRow, access: AccessContext, properties: PropertyRef[]): boolean {
    return user.id !== access.userId && user.roleAssignments.every((a) => canGrant(access, a.role.permissions.map((rp) => rp.permission.key), a.scopeType, a.scopeId, properties));
  }

  /** Never leave the organization without an active owner. */
  private async requireAnotherOwner(tx: Tx, exceptUserId: string): Promise<void> {
    const others = await tx.userRoleAssignment.count({
      where: { userId: { not: exceptUserId }, scopeType: ScopeType.ORGANIZATION, role: { key: 'OWNER' }, user: { status: { in: [UserStatus.ACTIVE, UserStatus.INVITED] }, deletedAt: null } },
    });
    if (others === 0) throw conflict('LAST_OWNER', 'This is the last owner. Make someone else an owner first.');
  }

  private async issueInvite(tx: Tx, organizationId: string, userId: string): Promise<string> {
    const { token, hash } = this.tokens.generateOpaqueToken();
    await this.authRepo.createAuthToken(tx, { organizationId, userId, type: AuthTokenType.PASSWORD_RESET, tokenHash: hash, expiresAt: new Date(Date.now() + INVITE_TTL_HOURS * 3_600_000) });
    return token;
  }

  private sendInvite(email: string, firstName: string, token: string): Promise<void> {
    return this.mail.send({
      to: email,
      subject: "You've been invited",
      text: `Hi ${firstName},\n\nYou have been invited to join the team. Choose your password here:\n\n${this.env.WEB_ORIGIN}/reset-password?token=${token}\n\nThis link is valid for ${INVITE_TTL_HOURS} hours.`,
    });
  }

  private toView(
    u: UserRow,
    access: AccessContext,
    properties: PropertyRef[],
    names: Map<string, string>,
    visibleOnly: { propertyIds: ReadonlySet<string>; groupIds: ReadonlySet<string> } | null,
  ): StaffView {
    const visible = (a: UserRow['roleAssignments'][number]) =>
      visibleOnly === null || a.scopeType === ScopeType.ORGANIZATION || (a.scopeType === ScopeType.PROPERTY && visibleOnly.propertyIds.has(a.scopeId)) || (a.scopeType === ScopeType.GROUP && visibleOnly.groupIds.has(a.scopeId));
    const assignments: StaffAssignmentView[] = u.roleAssignments.filter(visible).map((a) => ({
      id: a.id,
      roleKey: a.role.key,
      roleName: a.role.name,
      scopeType: a.scopeType,
      scopeId: a.scopeId,
      scopeLabel: a.scopeType === ScopeType.ORGANIZATION ? 'Whole organization' : (names.get(a.scopeId) ?? 'Unknown'),
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
}
