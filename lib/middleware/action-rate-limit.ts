/**
 * action-rate-limit — Reusable rate limiter for server actions.
 *
 * Uses Upstash Ratelimit (already configured in proxy.ts) to enforce
 * per-user sliding window limits on server actions. Unlike proxy.ts
 * rate limiting (which only covers public API POST routes), this
 * protects authenticated mutations.
 *
 * Usage:
 *   const limiter = createActionLimiter("booking-create", { requests: 10, window: "60 s" });
 *   // Inside a server action:
 *   await limiter(); // throws "Rate limit exceeded" if over budget
 */
import { Ratelimit } from "@upstash/ratelimit";
import { getUser } from "@/lib/auth";
import { redis } from "@/lib/redis";

/**
 * Creates a rate-limiting guard function for a server action.
 *
 * @param prefix - Unique identifier for this limiter (e.g. "booking-create")
 * @param opts.requests - Max requests allowed in the window
 * @param opts.window - Sliding window duration (e.g. "60 s", "10 m")
 * @returns An async function that throws if the caller exceeds the limit
 */
export function createActionLimiter(
  prefix: string,
  opts: { requests: number; window: string },
): () => Promise<void> {
  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      opts.requests,
      opts.window as Parameters<typeof Ratelimit.slidingWindow>[1],
    ),
    prefix: `rl:action:${prefix}`,
  });

  return async () => {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      return;
    }

    const user = await getUser();
    const { success } = await ratelimit.limit(user.id);

    if (!success) {
      throw new Error("Rate limit exceeded. Please try again shortly.");
    }
  };
}
