import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ApiMeta } from '@pms/types';
import { Observable, map } from 'rxjs';

/** Return this from list endpoints so the envelope carries pagination meta. */
export class Paginated<T> {
  constructor(
    public readonly items: T[],
    public readonly meta: ApiMeta,
  ) {}
}

/** Every successful response becomes { data } or { data, meta }. */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Server-Sent Events stream raw messages, not { data } envelopes (Nest marks @Sse handlers with '__sse__').
    if (this.reflector.get<boolean | undefined>('__sse__', context.getHandler())) return next.handle();
    return next.handle().pipe(
      map((value: unknown) =>
        value instanceof Paginated ? { data: value.items, meta: value.meta } : { data: value ?? null },
      ),
    );
  }
}
