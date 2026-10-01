import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
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
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((value: unknown) =>
        value instanceof Paginated ? { data: value.items, meta: value.meta } : { data: value ?? null },
      ),
    );
  }
}
