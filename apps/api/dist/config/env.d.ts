import { z } from 'zod';
declare const schema: z.ZodEffects<z.ZodObject<{
    NODE_ENV: z.ZodDefault<z.ZodEnum<["development", "test", "production"]>>;
    API_PORT: z.ZodDefault<z.ZodNumber>;
    WEB_ORIGIN: z.ZodString;
    APP_DATABASE_URL: z.ZodString;
    REDIS_URL: z.ZodString;
    JWT_ACCESS_SECRET: z.ZodString;
    ACCESS_TOKEN_TTL: z.ZodDefault<z.ZodString>;
    REFRESH_TOKEN_TTL_DAYS: z.ZodDefault<z.ZodNumber>;
    TRUST_PROXY: z.ZodEffects<z.ZodDefault<z.ZodEnum<["true", "false"]>>, boolean, "true" | "false" | undefined>;
}, "strip", z.ZodTypeAny, {
    NODE_ENV: "development" | "test" | "production";
    API_PORT: number;
    WEB_ORIGIN: string;
    APP_DATABASE_URL: string;
    REDIS_URL: string;
    JWT_ACCESS_SECRET: string;
    ACCESS_TOKEN_TTL: string;
    REFRESH_TOKEN_TTL_DAYS: number;
    TRUST_PROXY: boolean;
}, {
    WEB_ORIGIN: string;
    APP_DATABASE_URL: string;
    REDIS_URL: string;
    JWT_ACCESS_SECRET: string;
    NODE_ENV?: "development" | "test" | "production" | undefined;
    API_PORT?: number | undefined;
    ACCESS_TOKEN_TTL?: string | undefined;
    REFRESH_TOKEN_TTL_DAYS?: number | undefined;
    TRUST_PROXY?: "true" | "false" | undefined;
}>, {
    NODE_ENV: "development" | "test" | "production";
    API_PORT: number;
    WEB_ORIGIN: string;
    APP_DATABASE_URL: string;
    REDIS_URL: string;
    JWT_ACCESS_SECRET: string;
    ACCESS_TOKEN_TTL: string;
    REFRESH_TOKEN_TTL_DAYS: number;
    TRUST_PROXY: boolean;
}, {
    WEB_ORIGIN: string;
    APP_DATABASE_URL: string;
    REDIS_URL: string;
    JWT_ACCESS_SECRET: string;
    NODE_ENV?: "development" | "test" | "production" | undefined;
    API_PORT?: number | undefined;
    ACCESS_TOKEN_TTL?: string | undefined;
    REFRESH_TOKEN_TTL_DAYS?: number | undefined;
    TRUST_PROXY?: "true" | "false" | undefined;
}>;
export type Env = z.infer<typeof schema>;
/** Fails fast at boot with a readable list of what is wrong. */
export declare function loadEnv(source?: NodeJS.ProcessEnv): Env;
export declare function parseDurationSeconds(value: string): number;
export {};
