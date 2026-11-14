"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const jwt_1 = require("@nestjs/jwt");
const config_module_1 = require("../../config/config.module");
const env_1 = require("../../config/env");
const rbac_module_1 = require("../rbac/rbac.module");
const permissions_guard_1 = require("../rbac/guards/permissions.guard");
const auth_controller_1 = require("./auth.controller");
const auth_repository_1 = require("./auth.repository");
const auth_service_1 = require("./auth.service");
const jwt_auth_guard_1 = require("./guards/jwt-auth.guard");
const rate_limit_guard_1 = require("./guards/rate-limit.guard");
const password_service_1 = require("./password.service");
const token_service_1 = require("./token.service");
let AuthModule = class AuthModule {
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Module)({
        imports: [
            rbac_module_1.RbacModule,
            jwt_1.JwtModule.registerAsync({
                inject: [config_module_1.ENV],
                useFactory: (env) => ({
                    secret: env.JWT_ACCESS_SECRET,
                    signOptions: {
                        algorithm: 'HS256',
                        issuer: token_service_1.JWT_ISSUER,
                        expiresIn: (0, env_1.parseDurationSeconds)(env.ACCESS_TOKEN_TTL),
                    },
                }),
            }),
        ],
        controllers: [auth_controller_1.AuthController],
        providers: [
            auth_service_1.AuthService,
            auth_repository_1.AuthRepository,
            password_service_1.PasswordService,
            token_service_1.TokenService,
            // Order matters: rate-limit, then authentication, then permissions. All apply to every route.
            { provide: core_1.APP_GUARD, useClass: rate_limit_guard_1.RateLimitGuard },
            { provide: core_1.APP_GUARD, useClass: jwt_auth_guard_1.JwtAuthGuard },
            { provide: core_1.APP_GUARD, useClass: permissions_guard_1.PermissionsGuard },
        ],
        exports: [token_service_1.TokenService, auth_repository_1.AuthRepository, password_service_1.PasswordService],
    })
], AuthModule);
//# sourceMappingURL=auth.module.js.map