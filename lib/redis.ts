/**
 * lib/redis.ts — Shared Upstash Redis client.
 *
 * Single instance reused across server actions, API routes, and proxy.ts.
 * Import this instead of constructing `new Redis(...)` in each module.
 */
import { Redis } from "@upstash/redis";

// During `next build` prerendering, env vars may be absent. Create a
// real client when configured, otherwise a no-op proxy that silently
// returns null for all operations — this prevents build crashes from
// Redis calls in layouts/middleware that run during static export.
const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

const noopHandler: ProxyHandler<Redis> = {
  get(_target, prop) {
    if (typeof prop === "string") {
      return (..._args: unknown[]) => Promise.resolve(null);
    }
    return undefined;
  },
};

export const redis: Redis =
  url && token
    ? new Redis({ url, token })
    : (new Proxy({} as Redis, noopHandler) as Redis);
