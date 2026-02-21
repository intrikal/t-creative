/**
 * proxy — Next.js middleware entry point (replaces the default middleware.ts).
 *
 * ## What is middleware?
 * Next.js runs this function on the server before EVERY page or API request.
 * Think of it as a security guard at the door — it can inspect, redirect, or
 * modify requests before they reach any page component.
 *
 * ## Why does this file exist?
 * Supabase stores login sessions in browser cookies. On every request, those
 * cookies may need to be refreshed (e.g., when a short-lived access token
 * expires and needs to be swapped for a new one). Without this refresh step,
 * users would get unexpectedly logged out mid-session.
 *
 * ## Responsibilities (in order):
 * 1. **Session refresh** — tells Supabase to check and renew the auth cookie
 *    so the user stays logged in across page navigations.
 * 2. **Ban check** — if an authenticated user's profile has `is_active = false`,
 *    they are immediately signed out and sent to /suspended.
 *
 * ## What this does NOT do:
 * - It does not block unauthenticated users from any route (no route guards yet).
 * - It does not redirect to /login for protected pages (handled per-page instead).
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
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
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
   * database driver is not available inside Next.js middleware, which runs in
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
      .select("is_active")
      .eq("id", user.id)
      .single();

    if (profile && !profile.is_active) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/suspended";
      url.search = ""; // strip any query params so error details aren't leaked
      return NextResponse.redirect(url);
    }
  }

  // All checks passed — return the (possibly cookie-updated) response
  return supabaseResponse;
}

export const config = {
  /**
   * `matcher` tells Next.js which URL paths this middleware should run on.
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
