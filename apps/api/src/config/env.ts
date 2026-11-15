import { z } from 'zod';

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().positive().default(4000),
    WEB_ORIGIN: z.string().url(),
    // Runtime connection: the RLS-restricted pms_app role (never the owner).
    APP_DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1),
    JWT_ACCESS_SECRET: z.string().min(16),
    ACCESS_TOKEN_TTL: z
      .string()
      .regex(/^\d+[smhd]$/, 'use a number plus s, m, h or d (e.g. 15m)')
      .default('15m'),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
    // Email: 'console' prints emails in the API console (development). 'resend' sends them through resend.com.
    MAIL_PROVIDER: z.enum(['console', 'resend']).default('console'),
    RESEND_API_KEY: z.string().min(1).optional(),
    MAIL_FROM: z.string().min(3).optional(),
    // 64 hex characters (32 bytes). Encrypts secrets stored in the database (webhook signing secrets).
    DATA_ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/, 'must be 64 hex characters (generate with: openssl rand -hex 32)').optional(),
    // How often the webhook worker looks for deliveries to send. 0 turns the worker off (tests, or a dedicated worker process).
    WEBHOOK_DISPATCH_INTERVAL_MS: z.coerce.number().int().min(0).default(5000),
    // Set true only when running behind a reverse proxy, so rate limits see the real client IP.
    TRUST_PROXY: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
  })
  .superRefine((env, ctx) => {
    if (env.MAIL_PROVIDER === 'resend') {
      if (!env.RESEND_API_KEY) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['RESEND_API_KEY'], message: 'required when MAIL_PROVIDER=resend' });
      if (!env.MAIL_FROM) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['MAIL_FROM'], message: 'required when MAIL_PROVIDER=resend (e.g. "Hotel PMS <noreply@yourdomain.com>")' });
    }
    if (env.NODE_ENV === 'production' && !env.DATA_ENCRYPTION_KEY) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['DATA_ENCRYPTION_KEY'], message: 'required in production (generate with: openssl rand -hex 32)' });
    }
    if (
      env.NODE_ENV === 'production' &&
      (env.JWT_ACCESS_SECRET.length < 32 || env.JWT_ACCESS_SECRET.startsWith('change-me'))
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_ACCESS_SECRET'],
        message: 'must be a random secret of at least 32 characters in production',
      });
    }
  });

export type Env = z.infer<typeof schema>;

/** Fails fast at boot with a readable list of what is wrong. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  return result.data;
}

const UNIT_SECONDS = { s: 1, m: 60, h: 3600, d: 86400 } as const;

export function parseDurationSeconds(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) throw new Error(`Invalid duration: ${value}`);
  return Number(match[1]) * UNIT_SECONDS[match[2] as keyof typeof UNIT_SECONDS];
}
