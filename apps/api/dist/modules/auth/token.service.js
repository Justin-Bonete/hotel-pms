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
exports.JWT_ISSUER = exports.TokenService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const node_crypto_1 = require("node:crypto");
const config_module_1 = require("../../config/config.module");
const env_1 = require("../../config/env");
const ISSUER = 'hotel-pms';
let TokenService = class TokenService {
    jwt;
    env;
    accessTtlSeconds;
    constructor(jwt, env) {
        this.jwt = jwt;
        this.env = env;
        this.accessTtlSeconds = (0, env_1.parseDurationSeconds)(env.ACCESS_TOKEN_TTL);
    }
    signAccessToken(input) {
        const payload = { sub: input.userId, org: input.organizationId, fid: input.familyId };
        return this.jwt.sign(payload);
    }
    verifyAccessToken(token) {
        return this.jwt.verify(token, { algorithms: ['HS256'], issuer: ISSUER });
    }
    /** Opaque random secret for cookies and email links. Only its hash is stored. */
    generateOpaqueToken() {
        const token = (0, node_crypto_1.randomBytes)(32).toString('base64url');
        return { token, hash: this.hash(token) };
    }
    hash(token) {
        return (0, node_crypto_1.createHash)('sha256').update(token).digest('hex');
    }
    refreshExpiry() {
        return new Date(Date.now() + this.env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
    }
};
exports.TokenService = TokenService;
exports.TokenService = TokenService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(config_module_1.ENV)),
    __metadata("design:paramtypes", [jwt_1.JwtService, Object])
], TokenService);
exports.JWT_ISSUER = ISSUER;
//# sourceMappingURL=token.service.js.map