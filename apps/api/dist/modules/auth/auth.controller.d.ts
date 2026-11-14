import type { ForgotPasswordInput, LoginInput, RegisterInput, ResetPasswordInput, VerifyEmailInput } from '@pms/validation';
import type { Request, Response } from 'express';
import type { Env } from '../../config/env';
import { AuthService } from './auth.service';
import { AuthContext } from './decorators/current-user.decorator';
export declare class AuthController {
    private readonly auth;
    private readonly env;
    constructor(auth: AuthService, env: Env);
    register(dto: RegisterInput, res: Response): Promise<{
        accessToken: string;
        expiresIn: number;
        user: import("./auth.service").PublicUser;
    }>;
    login(dto: LoginInput, res: Response): Promise<{
        accessToken: string;
        expiresIn: number;
        user: import("./auth.service").PublicUser;
    }>;
    refresh(req: Request, res: Response): Promise<{
        accessToken: string;
        expiresIn: number;
        user: import("./auth.service").PublicUser;
    }>;
    logout(req: Request, res: Response): Promise<null>;
    me(auth: AuthContext): Promise<{
        roles: {
            key: string;
            name: string;
            scopeType: import("@prisma/client").$Enums.ScopeType;
            scopeId: string;
        }[];
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        emailVerified: boolean;
        organization: {
            id: string;
            name: string;
            slug: string;
        };
    }>;
    sessions(auth: AuthContext): Promise<{
        id: string;
        device: string | null;
        ip: string | null;
        signedInAt: Date;
        lastActiveAt: Date;
        current: boolean;
    }[]>;
    revokeSession(auth: AuthContext, id: string): Promise<null>;
    verifyEmail(dto: VerifyEmailInput): Promise<{
        message: string;
    }>;
    resendVerification(auth: AuthContext): Promise<{
        message: string;
    }>;
    forgotPassword(dto: ForgotPasswordInput): Promise<{
        message: string;
    }>;
    resetPassword(dto: ResetPasswordInput): Promise<{
        message: string;
    }>;
    private respondWithSession;
    private clearRefreshCookie;
    private readRefreshCookie;
    /** Cookie-authenticated endpoints must come from our own web app (CSRF defense in depth beside SameSite). */
    private assertAllowedOrigin;
}
