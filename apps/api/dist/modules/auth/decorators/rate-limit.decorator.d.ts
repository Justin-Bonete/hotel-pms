export declare const RATE_LIMIT = "rateLimit";
export interface RateLimitOptions {
    /** Bucket name; limits are counted per name + client IP. */
    name: string;
    limit: number;
    windowSeconds: number;
}
export declare const RateLimit: (options: RateLimitOptions) => import("@nestjs/common").CustomDecorator<string>;
