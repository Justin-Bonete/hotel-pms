import { HttpStatus, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { API_KEY_SCOPES, type ApiKeyCreated, type ApiKeyScope, type ApiKeyView } from '@pms/types';
import type { CreateApiKeyInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { assertCan } from '../../common/access/assert-access';
import { generateApiKey, hashApiKey, looksLikeApiKey } from '../../common/crypto/tokens';
import { AppException } from '../../common/http/app-exception';
import { badRequest, conflict, notFound } from '../../common/http/errors';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

/** What a verified key may do. Built from the stored row; the key itself is never kept. */
export interface ApiKeyAuth {
  id: string;
  organizationId: string;
  name: string;
  propertyIds: string[];
  scopes: ApiKeyScope[];
  autoConfirm: boolean;
}

type Row = Prisma.ApiKeyGetPayload<object>;
const TOUCH_EVERY_MS = 5 * 60_000;

const toView = (k: Row): ApiKeyView => ({
  id: k.id, name: k.name, prefix: k.prefix, propertyIds: k.propertyIds, scopes: k.scopes.filter((s): s is ApiKeyScope => (API_KEY_SCOPES as readonly string[]).includes(s)),
  autoConfirm: k.autoConfirm, expiresAt: k.expiresAt?.toISOString() ?? null, revokedAt: k.revokedAt?.toISOString() ?? null, lastUsedAt: k.lastUsedAt?.toISOString() ?? null, createdAt: k.createdAt.toISOString(),
});

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Keys the person can see: only those whose every property is one they can see. */
  async list(access: AccessContext): Promise<ApiKeyView[]> {
    const scope = access.scopeOf('integration.read');
    if (!scope.all && scope.ids.size === 0) return [];
    const rows = await this.prisma.forTenant((tx) => tx.apiKey.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }));
    return rows.filter((k) => scope.all || k.propertyIds.every((p: string) => scope.ids.has(p))).map(toView);
  }

  /** The key can only ever reach properties the creator can manage themselves, so a key never widens anyone's access. */
  async create(dto: CreateApiKeyInput, access: AccessContext): Promise<ApiKeyCreated> {
    const propertyIds: string[] = [...new Set<string>(dto.propertyIds)];
    for (const id of propertyIds) assertCan(access, 'integration.manage', id);
    const { key, prefix, hash } = generateApiKey();
    return this.prisma.forTenant(async (tx) => {
      const found = await tx.property.count({ where: { id: { in: propertyIds }, deletedAt: null } });
      if (found !== propertyIds.length) throw badRequest('INVALID_PROPERTY', 'One of the properties does not exist.');
      const row = await tx.apiKey.create({
        data: {
          organizationId: access.organizationId, name: dto.name, prefix, keyHash: hash, propertyIds, scopes: dto.scopes, autoConfirm: dto.autoConfirm,
          expiresAt: dto.expiresInDays ? new Date(Date.now() + dto.expiresInDays * 86_400_000) : null, createdById: access.userId,
        },
      });
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, action: 'api_key.created', entity: 'api_key', entityId: row.id, after: { name: row.name, prefix: row.prefix, scopes: row.scopes, properties: propertyIds.length, autoConfirm: row.autoConfirm } });
      return { ...toView(row), key };
    });
  }

  async revoke(id: string, access: AccessContext): Promise<ApiKeyView> {
    return this.prisma.forTenant(async (tx) => {
      const row = await tx.apiKey.findFirst({ where: { id } });
      if (!row) throw notFound('API key');
      for (const p of row.propertyIds) assertCan(access, 'integration.manage', p);
      const changed = await tx.apiKey.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } });
      if (changed.count === 0) throw conflict('ALREADY_REVOKED', 'This key was already revoked.');
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, action: 'api_key.revoked', entity: 'api_key', entityId: id, before: { name: row.name, prefix: row.prefix } });
      return toView(await tx.apiKey.findFirstOrThrow({ where: { id } }));
    });
  }

  /**
   * Checks a key someone sent us. Returns null for anything wrong (unknown, revoked, expired) so the caller gives one
   * identical answer and an attacker learns nothing. The lookup crosses tenants on purpose: the key IS the tenant.
   */
  async authenticate(raw: string): Promise<ApiKeyAuth | null> {
    if (!looksLikeApiKey(raw)) return null;
    const hash = hashApiKey(raw);
    return this.prisma.withoutTenant('api key lookup: the key identifies the organization', async (tx) => {
      const k = await tx.apiKey.findFirst({ where: { keyHash: hash } });
      if (!k || k.revokedAt || (k.expiresAt && k.expiresAt.getTime() <= Date.now())) return null;
      if (!k.lastUsedAt || Date.now() - k.lastUsedAt.getTime() > TOUCH_EVERY_MS) {
        await tx.apiKey.updateMany({ where: { id: k.id }, data: { lastUsedAt: new Date() } }); // not on every request: that would be a write per call
      }
      return { id: k.id, organizationId: k.organizationId, name: k.name, propertyIds: k.propertyIds, scopes: toView(k).scopes, autoConfirm: k.autoConfirm };
    });
  }
}

export const forbiddenScope = (scope: ApiKeyScope) => new AppException('KEY_SCOPE', `This API key is not allowed to do that (it needs "${scope}").`, HttpStatus.FORBIDDEN);
