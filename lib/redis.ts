/**
 * lib/redis.ts — Shared Upstash Redis client.
 *
 * Single instance reused across server actions, API routes, and proxy.ts.
 * Import this instead of constructing `new Redis(...)` in each module.
 *
 * The client is instantiated lazily on first use so the app starts cleanly
 * when UPSTASH_REDIS_REST_URL / TOKEN are not yet configured. All operations
 * on an unconfigured client resolve to null/0/false — callers treat a cache
 * miss as a cache miss and fall through to the database.
 */
import { Redis } from "@upstash/redis";

let _client: Redis | null = null;

function getClient(): Redis | null {
  if (_client) return _client;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  _client = new Redis({ url, token });
  return _client;
}

// Typed no-op stubs that match the subset of Redis methods used in this codebase.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyArgs = any[];

function noop<T>(fallback: T) {
  return (..._args: AnyArgs): Promise<T> => Promise.resolve(fallback);
}

const stub = {
  get: noop(null),
  set: noop("OK" as const),
  del: noop(0),
  mget: (..._args: AnyArgs) => Promise.resolve(_args.map(() => null)),
};

/**
 * Proxy that forwards calls to the real Redis client when configured,
 * or to no-op stubs that return safe defaults when it is not.
 */
export const redis: Redis = new Proxy({} as Redis, {
  get(_target, prop: string) {
    const client = getClient();
    if (client) return (client as unknown as Record<string, unknown>)[prop];
    return (stub as unknown as Record<string, unknown>)[prop] ?? noop(null);
  },
});
