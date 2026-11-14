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
var RateLimitGuard_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const app_exception_1 = require("../../../common/http/app-exception");
const redis_service_1 = require("../../../database/redis/redis.service");
const rate_limit_decorator_1 = require("../decorators/rate-limit.decorator");
/** Fixed-window limiter in Redis, per bucket name + client IP. Fails OPEN if Redis is unreachable. */
let RateLimitGuard = RateLimitGuard_1 = class RateLimitGuard {
    reflector;
    redis;
    logger = new common_1.Logger(RateLimitGuard_1.name);
    constructor(reflector, redis) {
        this.reflector = reflector;
        this.redis = redis;
    }
    async canActivate(context) {
        const options = this.reflector.getAllAndOverride(rate_limit_decorator_1.RATE_LIMIT, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (!options)
            return true;
        const http = context.switchToHttp();
        const req = http.getRequest();
        const res = http.getResponse();
        const key = `rl:${options.name}:${req.ip ?? 'unknown'}`;
        let count = 0;
        let ttl = options.windowSeconds;
        try {
            const results = await this.redis.client.multi().incr(key).expire(key, options.windowSeconds, 'NX').ttl(key).exec();
            count = Number(results?.[0]?.[1] ?? 0);
            ttl = Number(results?.[2]?.[1] ?? options.windowSeconds);
        }
        catch (err) {
            this.logger.warn(`Rate limiter unavailable, allowing request: ${err.message}`);
            return true;
        }
        if (count > options.limit) {
            res.setHeader('Retry-After', String(Math.max(ttl, 1)));
            throw new app_exception_1.AppException('RATE_LIMITED', `Too many attempts. Please try again in ${Math.max(Math.ceil(ttl / 60), 1)} minute(s).`, common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
        return true;
    }
};
exports.RateLimitGuard = RateLimitGuard;
exports.RateLimitGuard = RateLimitGuard = RateLimitGuard_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        redis_service_1.RedisService])
], RateLimitGuard);
//# sourceMappingURL=rate-limit.guard.js.map