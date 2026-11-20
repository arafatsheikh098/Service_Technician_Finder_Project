import type { User } from './types';

/**
 * Small fetch wrapper.
 * - The access token lives only in memory (never localStorage, so XSS can't read it later).
 * - On a 401 it refreshes once using the httpOnly cookie and retries the request.
 * - Concurrent 401s share one refresh call, because refresh tokens rotate and a
 *   second parallel refresh would look like a replay and end the session.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: { path: string; message: string }[],
  ) {
    super(message);
  }
  fieldErrors(): Record<string, string> {
    return Object.fromEntries((this.details ?? []).map((d) => [d.path, d.message]));
  }
}

let accessToken: string | null = null;
let onSessionChange: (user: User | null) => void = () => {};

export const getAccessToken = () => accessToken;
export function setSession(token: string | null, user: User | null) {
  accessToken = token;
  onSessionChange(user);
}
export function subscribeSession(fn: (user: User | null) => void) {
  onSessionChange = fn;
}

let refreshing: Promise<boolean> | null = null;
export function refreshSession(): Promise<boolean> {
  refreshing ??= fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' })
    .then(async (res) => {
      if (!res.ok) {
        setSession(null, null);
        return false;
      }
      const body = (await res.json()) as { accessToken: string; user: User };
      setSession(body.accessToken, body.user);
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

type Options = Omit<RequestInit, 'body'> & {
  body?: unknown;
  idempotencyKey?: string;
  auth?: boolean;
};

export async function api<T>(path: string, opts: Options = {}, retried = false): Promise<T> {
  const headers = new Headers(opts.headers);
  const isForm = opts.body instanceof FormData;
  if (opts.body !== undefined && !isForm) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  if (opts.idempotencyKey) headers.set('Idempotency-Key', opts.idempotencyKey);

  const res = await fetch(`/api/v1${path}`, {
    ...opts,
    headers,
    credentials: 'include',
    body:
      opts.body === undefined
        ? undefined
        : isForm
          ? (opts.body as FormData)
          : JSON.stringify(opts.body),
  });

  if (res.status === 401 && !retried && !path.startsWith('/auth/')) {
    if (await refreshSession()) return api<T>(path, opts, true);
  }
  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = data?.error;
    throw new ApiError(
      res.status,
      e?.code ?? 'ERROR',
      e?.message ?? `Request failed (${res.status})`,
      e?.details,
    );
  }
  return data as T;
}

export const newIdempotencyKey = () => crypto.randomUUID();
