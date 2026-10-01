import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { AuthContext, AuthenticatedRequest } from '../../../common/context/request-context';

export type { AuthContext, AuthenticatedRequest };

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthContext | undefined => {
  return ctx.switchToHttp().getRequest<AuthenticatedRequest>().auth;
});
