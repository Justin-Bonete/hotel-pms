import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { ENV } from '../../config/config.module';
import { Env, parseDurationSeconds } from '../../config/env';

export interface AccessPayload {
  /** user id */
  sub: string;
  /** organization id */
  org: string;
  /** login family id (one per device sign-in) */
  fid: string;
}

const ISSUER = 'hotel-pms';

@Injectable()
export class TokenService {
  readonly accessTtlSeconds: number;

  constructor(
    private readonly jwt: JwtService,
    @Inject(ENV) private readonly env: Env,
  ) {
    this.accessTtlSeconds = parseDurationSeconds(env.ACCESS_TOKEN_TTL);
  }

  signAccessToken(input: { userId: string; organizationId: string; familyId: string }): string {
    const payload: AccessPayload = { sub: input.userId, org: input.organizationId, fid: input.familyId };
    return this.jwt.sign(payload);
  }

  verifyAccessToken(token: string): AccessPayload {
    return this.jwt.verify<AccessPayload>(token, { algorithms: ['HS256'], issuer: ISSUER });
  }

  /** Opaque random secret for cookies and email links. Only its hash is stored. */
  generateOpaqueToken(): { token: string; hash: string } {
    const token = randomBytes(32).toString('base64url');
    return { token, hash: this.hash(token) };
  }

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  refreshExpiry(): Date {
    return new Date(Date.now() + this.env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
  }
}

export const JWT_ISSUER = ISSUER;
