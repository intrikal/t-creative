/**
 * lib/redis.ts — Shared Upstash Redis client.
 *
 * Single instance reused across server actions, API routes, and proxy.ts.
 * Import this instead of constructing `new Redis(...)` in each module.
 */
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

export const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});
