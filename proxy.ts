/**
 * proxy.ts — Next.js Proxy entry point (Next.js 16+).
 *
 * Starting with Next.js 16, Middleware is called Proxy to better reflect its
 * purpose. This file must be named `proxy.ts` at the project root and export
 * a named `proxy` function (or a default export). The `config.matcher` below
 * controls which paths it runs on.
 *
 * Proxy runs before a request is completed and can rewrite, redirect, modify
 * headers, or respond directly. It is NOT intended for slow data fetching or
 * full session management — use it for fast, optimistic checks only.
 *
 * ## Responsibilities (in order of execution):
 * 1. **Rate limiting** — rejects abusive bursts on public POST endpoints before
 *    any Supabase work is done. Uses an in-memory sliding-window Map keyed by
 *    IP + path. Persists across warm invocations on the same instance; resets
 *    on cold starts. Not perfect, but stops the most common abuse patterns
 *    (bots hammering the contact/booking form, scripted waitlist signups).
 *
 * 2. **Session refresh** — tells Supabase to check and renew the auth cookie so
 *    the user stays logged in across page navigations.
 *
 * 3. **Ban check** — if an authenticated user's profile has `is_active = false`,
 *    sign them out and redirect to /suspended.
 *
 * 4. **Route guards** — /admin requires role "admin"; /dashboard requires admin,
 *    assistant, or client. Unauthenticated users hitting either are sent home.
 *
 * ## What this does NOT do:
 * - It does not redirect unauthenticated users to /login for arbitrary pages.
 * - fetch() calls with cache/revalidate/tags options have no effect here.
 *
 * @see https://nextjs.org/docs/app/getting-started/proxy
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

/**
 * Per-route limiters for public, unauthenticated POST endpoints.
 *
 * Each entry creates a dedicated Upstash Ratelimit instance with a sliding
 * window algorithm. State is stored in Upstash Redis and shared across all
 * serverless function instances — unlike the previous in-memory Map, this
 * correctly enforces limits even when requests hit different cold-started
 * instances.
 *
 * windowMs values are converted to seconds because Upstash Ratelimit uses
 * seconds as its time unit.
 */
const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

const RATE_LIMITS: Record<string, Ratelimit> = {
  "/api/chat/fallback": new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "60 s"),
    prefix: "rl:chat-fallback",
  }),
  "/api/book/guest-request": new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "60 s"),
    prefix: "rl:book-guest-request",
  }),
  "/api/book/waitlist": new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "60 s"),
    prefix: "rl:book-waitlist",
  }),
  "/api/book/upload-reference": new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "60 s"),
    prefix: "rl:book-upload-reference",
  }),
};

function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

// ---------------------------------------------------------------------------
// Proxy
// ---------------------------------------------------------------------------

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rate-limit public POST endpoints before touching Supabase.
  // Upstash Redis stores the sliding-window state so the limit is shared
  // across all serverless instances — no per-instance in-memory store needed.
  if (request.method === "POST") {
    const limiter = RATE_LIMITS[pathname];
    if (limiter) {
      const { success } = await limiter.limit(clientIp(request));
      if (!success) {
        return new NextResponse(
          JSON.stringify({ error: "Too many requests. Please try again later." }),
          {
            status: 429,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    }
  }

  /**
   * Start with a "pass-through" response — let the request continue normally.
   * We hold a mutable reference so the cookie-sync logic below can replace it
   * if Supabase needs to write new session cookies.
   */
  let supabaseResponse = NextResponse.next({ request });

  /**
   * Create a Supabase client scoped to this single request.
   *
   * The cookie adapter here does two things:
   * - `getAll` — reads existing auth cookies from the incoming request.
   * - `setAll` — writes refreshed auth cookies to BOTH the request object
   *   (so downstream server code sees them) and the outgoing response
   *   (so the browser receives updated cookies).
   *
   * This two-way sync is required by Supabase SSR. If you skip it,
   * the session refresh won't persist to the browser.
   */
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write to the request so server components in this request cycle see them
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          // Rebuild the response so we can attach updated cookies to it
          supabaseResponse = NextResponse.next({ request });
          // Write to the response so the browser stores the refreshed session
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  /**
   * IMPORTANT: Do NOT add any code between createServerClient() and getUser().
   *
   * getUser() is what actually triggers the cookie refresh. Supabase's SSR
   * package needs these two calls to be adjacent so it can correctly intercept
   * and rewrite the session tokens in the cookie adapter above.
   */
  const {
    data: { user },
  } = await supabase.auth.getUser();

  /**
   * Ban check — if the user is logged in, verify their account is still active.
   *
   * We query Supabase directly here (not Drizzle) because Drizzle's Node.js
   * database driver is not available in Next.js Proxy, which runs in
   * the Edge Runtime (a lightweight V8 environment without Node.js APIs).
   * Supabase's fetch-based client works fine in both environments.
   *
   * If `is_active` is false, the user has been suspended:
   * - Sign them out to clear the session cookie
   * - Redirect to /suspended with all query parameters stripped
   */
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_active, role")
      .eq("id", user.id)
      .single();

    if (profile && !profile.is_active) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/suspended";
      url.search = ""; // strip any query params so error details aren't leaked
      return NextResponse.redirect(url);
    }

    // Protect /admin routes — only admins may access them.
    //
    // Note: we only redirect when we can CONFIRM the role is not "admin"
    // (i.e. when profile is non-null and role is wrong). If profile is null —
    // which can happen when RLS blocks the Supabase REST read, e.g. right after
    // the onboarding upsert before the session's auth context refreshes — we
    // pass the request through and let AdminLayout's Drizzle-based check (which
    // bypasses RLS entirely) do the final guard. This prevents a race where
    // a freshly-saved admin profile can't be read via REST yet.
    if (pathname.startsWith("/admin") && profile && profile.role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      return NextResponse.redirect(url);
    }

    // Protect /dashboard routes — admins, assistants, and clients may access them.
    // Each role sees different content via role-based rendering in the layout.
    // Same null-profile rationale as the /admin guard above.
    if (
      pathname.startsWith("/dashboard") &&
      profile &&
      profile.role !== "admin" &&
      profile.role !== "assistant" &&
      profile.role !== "client"
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      return NextResponse.redirect(url);
    }

    // Allow authenticated users to browse the marketing landing page.
    // The Navbar shows their avatar + a "Dashboard" link instead of "Sign In".
  } else if (pathname.startsWith("/admin") || pathname.startsWith("/dashboard")) {
    // Unauthenticated users hitting protected routes go to the home page
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // All checks passed — return the (possibly cookie-updated) response
  return supabaseResponse;
}

export const config = {
  /**
   * `matcher` filters which URL paths Proxy runs on.
   *
   * The regex below matches EVERY path EXCEPT:
   * - `_next/static`  — pre-built JavaScript/CSS bundles (no auth needed)
   * - `_next/image`   — Next.js image optimization endpoint
   * - `favicon.ico`, `sitemap.xml`, `robots.txt` — standard browser/SEO files
   * - Any file with an image extension (.svg, .png, .jpg, etc.) — static assets
   *
   * Skipping these paths prevents unnecessary Supabase calls on every
   * static asset request, keeping the app fast.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
