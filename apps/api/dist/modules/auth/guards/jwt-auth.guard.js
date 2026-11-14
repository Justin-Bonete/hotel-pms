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
Object.defineProperty(exports, "__esModule", { value: true });
exports.JwtAuthGuard = exports.revokedFamilyKey = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const app_exception_1 = require("../../../common/http/app-exception");
const redis_service_1 = require("../../../database/redis/redis.service");
const public_decorator_1 = require("../decorators/public.decorator");
const token_service_1 = require("../token.service");
const revokedFamilyKey = (familyId) => `auth:revoked:${familyId}`;
exports.revokedFamilyKey = revokedFamilyKey;
const unauthenticated = (message = 'Please sign in to continue.') => new app_exception_1.AppException('UNAUTHENTICATED', message, common_1.HttpStatus.UNAUTHORIZED);
/** Global guard: every route requires a valid access token unless marked @Public(). */
let JwtAuthGuard = class JwtAuthGuard {
    reflector;
    tokens;
    redis;
    constructor(reflector, tokens, redis) {
        this.reflector = reflector;
        this.tokens = tokens;
        this.redis = redis;
    }
    async canActivate(context) {
        const isPublic = this.reflector.getAllAndOverride(public_decorator_1.IS_PUBLIC, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic)
            return true;
        const req = context.switchToHttp().getRequest();
        const [scheme, token] = req.headers.authorization?.split(' ') ?? [];
        if (scheme !== 'Bearer' || !token)
            throw unauthenticated();
        let payload;
        try {
            payload = this.tokens.verifyAccessToken(token);
        }
        catch {
            throw unauthenticated('Your session has expired. Please sign in again.');
        }
        // Signed-out / revoked devices are denylisted until their access token would have expired anyway.
        let revoked;
        try {
            revoked = await this.redis.client.exists((0, exports.revokedFamilyKey)(payload.fid));
        }
        catch {
            throw new app_exception_1.AppException('AUTH_UNAVAILABLE', 'We could not verify your session right now. Please try again in a moment.', common_1.HttpStatus.SERVICE_UNAVAILABLE);
        }
        if (revoked)
            throw unauthenticated('This device was signed out. Please sign in again.');
        req.auth = { userId: payload.sub, organizationId: payload.org, familyId: payload.fid };
        return true;
    }
};
exports.JwtAuthGuard = JwtAuthGuard;
exports.JwtAuthGuard = JwtAuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        token_service_1.TokenService,
        redis_service_1.RedisService])
], JwtAuthGuard);
//# sourceMappingURL=jwt-auth.guard.js.map