import type { ApiErrorBody, ApiMeta, AuthPayload } from '@pms/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly requestId?: string,
  ) {
    super(message);
  }
}

export interface Envelope<T> {
  data: T;
  meta?: ApiMeta;
}

/** The access token lives in memory only (never localStorage). The refresh cookie is httpOnly. */
let accessToken: string | null = null;
export const tokenStore = {
  get: (): string | null => accessToken,
  set: (token: string | null): void => {
    accessToken = token;
  },
};

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** false = do not attach the access token and do not try to refresh on 401. */
  auth?: boolean;
}

async function send<T>(path: string, opts: RequestOptions, isRetry = false): Promise<Envelope<T>> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const token = tokenStore.get();
  if (opts.auth !== false && token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: opts.method ?? 'GET',
      headers,
      credentials: 'include',
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError('NETWORK_ERROR', 'We could not reach the server. Check that the API is running and try again.', 0);
  }

  const json = (await res.json().catch(() => null)) as (Envelope<T> & Partial<ApiErrorBody>) | null;
  if (res.ok) return json as Envelope<T>;

  const err = json?.error;
  if (res.status === 401 && opts.auth !== false && !isRetry && err?.code === 'UNAUTHENTICATED') {
    if (await refreshSession()) return send<T>(path, opts, true);
  }
  throw new ApiError(err?.code ?? 'UNKNOWN', err?.message ?? 'Something went wrong. Please try again.', res.status, (err as { requestId?: string } | undefined)?.requestId);
}

// ---- refresh, single-flight: refresh tokens rotate, so concurrent callers must share ONE request.
let inflight: Promise<AuthPayload | null> | null = null;

export function refreshSession(): Promise<AuthPayload | null> {
  if (!inflight) {
    inflight = send<AuthPayload>('/auth/refresh', { method: 'POST', auth: false })
      .then((env) => {
        tokenStore.set(env.data.accessToken);
        return env.data;
      })
      .catch(() => {
        tokenStore.set(null);
        return null;
      })
      .finally(() => {
        // Keep the result briefly so React StrictMode's double effect reuses it.
        setTimeout(() => {
          inflight = null;
        }, 2000);
      });
  }
  return inflight;
}

export function resetRefresh(): void {
  inflight = null;
}

export const api = {
  get: async <T>(path: string): Promise<T> => (await send<T>(path)).data,
  post: async <T>(path: string, body?: unknown, auth = true): Promise<T> =>
    (await send<T>(path, { method: 'POST', body: body ?? undefined, auth })).data,
  delete: async <T>(path: string): Promise<T> => (await send<T>(path, { method: 'DELETE' })).data,
  page: <T>(path: string): Promise<Envelope<T[]>> => send<T[]>(path),
};
