import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT = 'rateLimit';

export interface RateLimitOptions {
  /** Bucket name; limits are counted per name + client IP. */
  name: string;
  limit: number;
  windowSeconds: number;
}

export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT, options);
