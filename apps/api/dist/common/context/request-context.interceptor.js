"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestContextInterceptor = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const rxjs_1 = require("rxjs");
const request_context_1 = require("./request-context");
/**
 * Runs after guards, so the authenticated user is known. Everything downstream (services, repositories,
 * PrismaService.forTenant, audit) reads the tenant from here. Register it FIRST so it wraps the others.
 */
let RequestContextInterceptor = class RequestContextInterceptor {
    intercept(context, next) {
        const http = context.switchToHttp();
        const req = http.getRequest();
        const res = http.getResponse();
        const ctx = {
            requestId: String(res.getHeader('x-request-id') ?? (0, node_crypto_1.randomUUID)()),
            ip: req.ip,
            userAgent: req.get('user-agent')?.slice(0, 255),
            userId: req.auth?.userId,
            organizationId: req.auth?.organizationId,
            familyId: req.auth?.familyId,
            access: req.access,
            propertyId: req.access?.activePropertyId ?? undefined,
        };
        // The handler runs on subscribe, so subscribe INSIDE the context.
        return new rxjs_1.Observable((subscriber) => request_context_1.RequestContextStore.run(ctx, () => next.handle().subscribe(subscriber)));
    }
};
exports.RequestContextInterceptor = RequestContextInterceptor;
exports.RequestContextInterceptor = RequestContextInterceptor = __decorate([
    (0, common_1.Injectable)()
], RequestContextInterceptor);
//# sourceMappingURL=request-context.interceptor.js.map