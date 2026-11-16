"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadEnv = loadEnv;
exports.parseDurationSeconds = parseDurationSeconds;
const zod_1 = require("zod");
const schema = zod_1.z
    .object({
    NODE_ENV: zod_1.z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: zod_1.z.coerce.number().int().positive().default(4000),
    WEB_ORIGIN: zod_1.z.string().url(),
    // Runtime connection: the RLS-restricted pms_app role (never the owner).
    APP_DATABASE_URL: zod_1.z.string().min(1),
    REDIS_URL: zod_1.z.string().min(1),
    JWT_ACCESS_SECRET: zod_1.z.string().min(16),
    ACCESS_TOKEN_TTL: zod_1.z
        .string()
        .regex(/^\d+[smhd]$/, 'use a number plus s, m, h or d (e.g. 15m)')
        .default('15m'),
    REFRESH_TOKEN_TTL_DAYS: zod_1.z.coerce.number().int().positive().default(30),
    // Email: 'console' prints emails in the API console (development). 'resend' sends them through resend.com.
    MAIL_PROVIDER: zod_1.z.enum(['console', 'resend']).default('console'),
    RESEND_API_KEY: zod_1.z.string().min(1).optional(),
    MAIL_FROM: zod_1.z.string().min(3).optional(),
    // 64 hex characters (32 bytes). Encrypts secrets stored in the database (webhook signing secrets).
    DATA_ENCRYPTION_KEY: zod_1.z.string().regex(/^[0-9a-fA-F]{64}$/, 'must be 64 hex characters (generate with: openssl rand -hex 32)').optional(),
    // How often the webhook worker looks for deliveries to send. 0 turns the worker off (tests, or a dedicated worker process).
    WEBHOOK_DISPATCH_INTERVAL_MS: zod_1.z.coerce.number().int().min(0).default(5000),
    // Set true only when running behind a reverse proxy, so rate limits see the real client IP.
    TRUST_PROXY: zod_1.z
        .enum(['true', 'false'])
        .default('false')
        .transform((v) => v === 'true'),
})
    .superRefine((env, ctx) => {
    if (env.MAIL_PROVIDER === 'resend') {
        if (!env.RESEND_API_KEY)
            ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ['RESEND_API_KEY'], message: 'required when MAIL_PROVIDER=resend' });
        if (!env.MAIL_FROM)
            ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ['MAIL_FROM'], message: 'required when MAIL_PROVIDER=resend (e.g. "Hotel PMS <noreply@yourdomain.com>")' });
    }
    if (env.NODE_ENV === 'production' && !env.DATA_ENCRYPTION_KEY) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ['DATA_ENCRYPTION_KEY'], message: 'required in production (generate with: openssl rand -hex 32)' });
    }
    if (env.NODE_ENV === 'production' &&
        (env.JWT_ACCESS_SECRET.length < 32 || env.JWT_ACCESS_SECRET.startsWith('change-me'))) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ['JWT_ACCESS_SECRET'],
            message: 'must be a random secret of at least 32 characters in production',
        });
    }
});
/** Fails fast at boot with a readable list of what is wrong. */
function loadEnv(source = process.env) {
    const result = schema.safeParse(source);
    if (!result.success) {
        const lines = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
        throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
    }
    return result.data;
}
const UNIT_SECONDS = { s: 1, m: 60, h: 3600, d: 86400 };
function parseDurationSeconds(value) {
    const match = /^(\d+)([smhd])$/.exec(value);
    if (!match)
        throw new Error(`Invalid duration: ${value}`);
    return Number(match[1]) * UNIT_SECONDS[match[2]];
}
//# sourceMappingURL=env.js.map