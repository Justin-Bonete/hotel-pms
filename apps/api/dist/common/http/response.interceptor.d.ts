import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ApiMeta } from '@pms/types';
import { Observable } from 'rxjs';
/** Return this from list endpoints so the envelope carries pagination meta. */
export declare class Paginated<T> {
    readonly items: T[];
    readonly meta: ApiMeta;
    constructor(items: T[], meta: ApiMeta);
}
/** Every successful response becomes { data } or { data, meta }. */
export declare class ResponseInterceptor implements NestInterceptor {
    private readonly reflector;
    constructor(reflector: Reflector);
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown>;
}
