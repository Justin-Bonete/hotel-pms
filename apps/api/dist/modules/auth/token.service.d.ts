import { JwtService } from '@nestjs/jwt';
import { Env } from '../../config/env';
export interface AccessPayload {
    /** user id */
    sub: string;
    /** organization id */
    org: string;
    /** login family id (one per device sign-in) */
    fid: string;
}
export declare class TokenService {
    private readonly jwt;
    private readonly env;
    readonly accessTtlSeconds: number;
    constructor(jwt: JwtService, env: Env);
    signAccessToken(input: {
        userId: string;
        organizationId: string;
        familyId: string;
    }): string;
    verifyAccessToken(token: string): AccessPayload;
    /** Opaque random secret for cookies and email links. Only its hash is stored. */
    generateOpaqueToken(): {
        token: string;
        hash: string;
    };
    hash(token: string): string;
    refreshExpiry(): Date;
}
export declare const JWT_ISSUER = "hotel-pms";
