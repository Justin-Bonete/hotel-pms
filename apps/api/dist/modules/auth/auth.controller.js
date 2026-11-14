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
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const validation_1 = require("@pms/validation");
const app_exception_1 = require("../../common/http/app-exception");
const zod_validation_pipe_1 = require("../../common/pipes/zod-validation.pipe");
const config_module_1 = require("../../config/config.module");
const auth_service_1 = require("./auth.service");
const current_user_decorator_1 = require("./decorators/current-user.decorator");
const access_decorators_1 = require("../rbac/decorators/access.decorators");
const public_decorator_1 = require("./decorators/public.decorator");
const rate_limit_decorator_1 = require("./decorators/rate-limit.decorator");
const REFRESH_COOKIE = 'pms_rt';
const COOKIE_PATH = '/api/v1/auth';
let AuthController = class AuthController {
    auth;
    env;
    constructor(auth, env) {
        this.auth = auth;
        this.env = env;
    }
    async register(dto, res) {
        return this.respondWithSession(res, await this.auth.register(dto));
    }
    async login(dto, res) {
        return this.respondWithSession(res, await this.auth.login(dto));
    }
    async refresh(req, res) {
        this.assertAllowedOrigin(req);
        try {
            return this.respondWithSession(res, await this.auth.refresh(this.readRefreshCookie(req)));
        }
        catch (err) {
            this.clearRefreshCookie(res);
            throw err;
        }
    }
    async logout(req, res) {
        this.assertAllowedOrigin(req);
        await this.auth.logout(this.readRefreshCookie(req));
        this.clearRefreshCookie(res);
        return null;
    }
    me(auth) {
        return this.auth.me(auth.userId);
    }
    sessions(auth) {
        return this.auth.listSessions(auth.userId, auth.familyId);
    }
    async revokeSession(auth, id) {
        await this.auth.revokeSession(auth.userId, auth.organizationId, id);
        return null;
    }
    async verifyEmail(dto) {
        await this.auth.verifyEmail(dto);
        return { message: 'Your email is verified.' };
    }
    async resendVerification(auth) {
        await this.auth.resendVerification(auth.userId);
        return { message: 'If your email still needs verifying, we sent a new link.' };
    }
    async forgotPassword(dto) {
        await this.auth.forgotPassword(dto);
        return { message: 'If an account exists for that email, a reset link is on its way.' };
    }
    async resetPassword(dto) {
        await this.auth.resetPassword(dto);
        return { message: 'Your password was changed. Please sign in again.' };
    }
    // ------------------------------------------------ cookie helpers
    respondWithSession(res, result) {
        res.cookie(REFRESH_COOKIE, result.refreshToken, {
            httpOnly: true,
            secure: this.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: COOKIE_PATH,
            expires: result.refreshExpiresAt,
        });
        return { accessToken: result.accessToken, expiresIn: result.expiresIn, user: result.user };
    }
    clearRefreshCookie(res) {
        res.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
    }
    readRefreshCookie(req) {
        const value = req.cookies?.[REFRESH_COOKIE];
        return typeof value === 'string' ? value : undefined;
    }
    /** Cookie-authenticated endpoints must come from our own web app (CSRF defense in depth beside SameSite). */
    assertAllowedOrigin(req) {
        const origin = req.get('origin');
        if (origin && origin !== this.env.WEB_ORIGIN) {
            throw new app_exception_1.AppException('FORBIDDEN_ORIGIN', 'This request came from an origin that is not allowed.', 403);
        }
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, rate_limit_decorator_1.RateLimit)({ name: 'register', limit: 5, windowSeconds: 3600 }),
    (0, common_1.Post)('register'),
    __param(0, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.registerSchema))),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "register", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, rate_limit_decorator_1.RateLimit)({ name: 'login', limit: 10, windowSeconds: 900 }),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('login'),
    __param(0, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.loginSchema))),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, rate_limit_decorator_1.RateLimit)({ name: 'refresh', limit: 60, windowSeconds: 900 }),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('refresh'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "refresh", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('logout'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
__decorate([
    (0, common_1.Get)('me'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "me", null);
__decorate([
    (0, common_1.Get)('sessions'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "sessions", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Delete)('sessions/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "revokeSession", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, rate_limit_decorator_1.RateLimit)({ name: 'verify-email', limit: 20, windowSeconds: 3600 }),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('verify-email'),
    __param(0, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.verifyEmailSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "verifyEmail", null);
__decorate([
    (0, rate_limit_decorator_1.RateLimit)({ name: 'resend-verification', limit: 3, windowSeconds: 3600 }),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('resend-verification'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "resendVerification", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, rate_limit_decorator_1.RateLimit)({ name: 'forgot-password', limit: 5, windowSeconds: 3600 }),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('forgot-password'),
    __param(0, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.forgotPasswordSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "forgotPassword", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, rate_limit_decorator_1.RateLimit)({ name: 'reset-password', limit: 10, windowSeconds: 3600 }),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('reset-password'),
    __param(0, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(validation_1.resetPasswordSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "resetPassword", null);
exports.AuthController = AuthController = __decorate([
    (0, access_decorators_1.Authenticated)() // @Public() routes below override this
    ,
    (0, common_1.Controller)('auth'),
    __param(1, (0, common_1.Inject)(config_module_1.ENV)),
    __metadata("design:paramtypes", [auth_service_1.AuthService, Object])
], AuthController);
//# sourceMappingURL=auth.controller.js.map