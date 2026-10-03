import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Req, Res } from '@nestjs/common';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '@pms/validation';
import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  VerifyEmailInput,
} from '@pms/validation';
import type { Request, Response } from 'express';
import { AppException } from '../../common/http/app-exception';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';
import { AuthService, AuthResult } from './auth.service';
import { AuthContext, CurrentUser } from './decorators/current-user.decorator';
import { Authenticated } from '../rbac/decorators/access.decorators';
import { Public } from './decorators/public.decorator';
import { RateLimit } from './decorators/rate-limit.decorator';

const REFRESH_COOKIE = 'pms_rt';
const COOKIE_PATH = '/api/v1/auth';

@Authenticated() // @Public() routes below override this
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Public()
  @RateLimit({ name: 'register', limit: 5, windowSeconds: 3600 })
  @Post('register')
  async register(@Body(new ZodValidationPipe(registerSchema)) dto: RegisterInput, @Res({ passthrough: true }) res: Response) {
    return this.respondWithSession(res, await this.auth.register(dto));
  }

  @Public()
  @RateLimit({ name: 'login', limit: 10, windowSeconds: 900 })
  @HttpCode(200)
  @Post('login')
  async login(@Body(new ZodValidationPipe(loginSchema)) dto: LoginInput, @Res({ passthrough: true }) res: Response) {
    return this.respondWithSession(res, await this.auth.login(dto));
  }

  @Public()
  @RateLimit({ name: 'refresh', limit: 60, windowSeconds: 900 })
  @HttpCode(200)
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.assertAllowedOrigin(req);
    try {
      return this.respondWithSession(res, await this.auth.refresh(this.readRefreshCookie(req)));
    } catch (err) {
      this.clearRefreshCookie(res);
      throw err;
    }
  }

  @Public()
  @HttpCode(200)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.assertAllowedOrigin(req);
    await this.auth.logout(this.readRefreshCookie(req));
    this.clearRefreshCookie(res);
    return null;
  }

  @Get('me')
  me(@CurrentUser() auth: AuthContext) {
    return this.auth.me(auth.userId);
  }

  @Get('sessions')
  sessions(@CurrentUser() auth: AuthContext) {
    return this.auth.listSessions(auth.userId, auth.familyId);
  }

  @HttpCode(200)
  @Delete('sessions/:id')
  async revokeSession(@CurrentUser() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    await this.auth.revokeSession(auth.userId, auth.organizationId, id);
    return null;
  }

  @Public()
  @RateLimit({ name: 'verify-email', limit: 20, windowSeconds: 3600 })
  @HttpCode(200)
  @Post('verify-email')
  async verifyEmail(@Body(new ZodValidationPipe(verifyEmailSchema)) dto: VerifyEmailInput) {
    await this.auth.verifyEmail(dto);
    return { message: 'Your email is verified.' };
  }

  @RateLimit({ name: 'resend-verification', limit: 3, windowSeconds: 3600 })
  @HttpCode(200)
  @Post('resend-verification')
  async resendVerification(@CurrentUser() auth: AuthContext) {
    await this.auth.resendVerification(auth.userId);
    return { message: 'If your email still needs verifying, we sent a new link.' };
  }

  @Public()
  @RateLimit({ name: 'forgot-password', limit: 5, windowSeconds: 3600 })
  @HttpCode(200)
  @Post('forgot-password')
  async forgotPassword(@Body(new ZodValidationPipe(forgotPasswordSchema)) dto: ForgotPasswordInput) {
    await this.auth.forgotPassword(dto);
    return { message: 'If an account exists for that email, a reset link is on its way.' };
  }

  @Public()
  @RateLimit({ name: 'reset-password', limit: 10, windowSeconds: 3600 })
  @HttpCode(200)
  @Post('reset-password')
  async resetPassword(@Body(new ZodValidationPipe(resetPasswordSchema)) dto: ResetPasswordInput) {
    await this.auth.resetPassword(dto);
    return { message: 'Your password was changed. Please sign in again.' };
  }

  // ------------------------------------------------ cookie helpers
  private respondWithSession(res: Response, result: AuthResult) {
    res.cookie(REFRESH_COOKIE, result.refreshToken, {
      httpOnly: true,
      secure: this.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: COOKIE_PATH,
      expires: result.refreshExpiresAt,
    });
    return { accessToken: result.accessToken, expiresIn: result.expiresIn, user: result.user };
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
  }

  private readRefreshCookie(req: Request): string | undefined {
    const value: unknown = req.cookies?.[REFRESH_COOKIE];
    return typeof value === 'string' ? value : undefined;
  }

  /** Cookie-authenticated endpoints must come from our own web app (CSRF defense in depth beside SameSite). */
  private assertAllowedOrigin(req: Request): void {
    const origin = req.get('origin');
    if (origin && origin !== this.env.WEB_ORIGIN) {
      throw new AppException('FORBIDDEN_ORIGIN', 'This request came from an origin that is not allowed.', 403);
    }
  }
}
