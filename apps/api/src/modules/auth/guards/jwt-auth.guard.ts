import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppException } from '../../../common/http/app-exception';
import { RedisService } from '../../../database/redis/redis.service';
import { AuthenticatedRequest } from '../decorators/current-user.decorator';
import { IS_PUBLIC } from '../decorators/public.decorator';
import { AccessPayload, TokenService } from '../token.service';

export const revokedFamilyKey = (familyId: string): string => `auth:revoked:${familyId}`;

const unauthenticated = (message = 'Please sign in to continue.') =>
  new AppException('UNAUTHENTICATED', message, HttpStatus.UNAUTHORIZED);

/** Global guard: every route requires a valid access token unless marked @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = req.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) throw unauthenticated();

    let payload: AccessPayload;
    try {
      payload = this.tokens.verifyAccessToken(token);
    } catch {
      throw unauthenticated('Your session has expired. Please sign in again.');
    }

    // Signed-out / revoked devices are denylisted until their access token would have expired anyway.
    let revoked: number;
    try {
      revoked = await this.redis.client.exists(revokedFamilyKey(payload.fid));
    } catch {
      throw new AppException(
        'AUTH_UNAVAILABLE',
        'We could not verify your session right now. Please try again in a moment.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    if (revoked) throw unauthenticated('This device was signed out. Please sign in again.');

    req.auth = { userId: payload.sub, organizationId: payload.org, familyId: payload.fid };
    return true;
  }
}
