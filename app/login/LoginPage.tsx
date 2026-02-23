"use client";

/**
 * LoginPage — Authentication entry point for T Creative Studio.
 *
 * ## How sign-in works
 * Two auth methods are supported, both powered by Supabase Auth:
 *
 * ### 1. OAuth (social login)
 * Clicking a provider button (Google, Apple, GitHub, X) calls
 * `supabase.auth.signInWithOAuth(...)`, which redirects the browser to that
 * provider's login page. After approval the provider returns to /auth/callback
 * with a short-lived authorization code, which the callback route exchanges
 * for a real session and sets the auth cookies.
 *
 * ### 2. Magic link (passwordless email)
 * Submitting an email address calls `supabase.auth.signInWithOtp(...)`. Supabase
 * emails a one-time sign-in link. Clicking it redirects to /auth/callback with
 * a code, same as OAuth. The form transitions to a "Check your email" state so
 * users aren't confused by the blank screen.
 *
 * ## Invite token threading
 * If the page was opened via an admin-generated invite link
 * (e.g. /login?invite=<jwt>), `buildCallbackUrl()` appends the token to the
 * `redirectTo` URL. The callback route (/auth/callback) reads it back after
 * sign-in and promotes the new user to the "assistant" role automatically.
 * This allows the studio to onboard staff without granting them self-serve
 * registration.
 *
 * ## Why `<Suspense>`?
 * `useSearchParams()` reads ?invite= and ?error= from the URL. In Next.js App
 * Router this makes the component dependent on dynamic request data, which
 * requires a Suspense boundary at build time. `LoginContent` (the inner
 * component with the actual form) is wrapped in Suspense by the exported
 * `LoginPage` so callers never need to add their own boundary.
 *
 * ## Error messages
 * Query-string errors (?error=suspended, ?error=auth_failed, etc.) set by
 * /auth/callback are mapped to human-readable strings via `ERROR_MESSAGES`.
 *
 * ## Related files
 * - app/auth/callback/route.ts — exchanges the auth code for a session
 * - app/login/page.tsx         — Next.js page wrapper that renders this
 */
import { useState } from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { Provider } from "@supabase/supabase-js";
import { AuthBrandingPanel } from "@/components/auth/AuthBrandingPanel";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { createClient } from "@/utils/supabase/client";

const ERROR_MESSAGES: Record<string, string> = {
  suspended: "Your account has been suspended. Please contact us for help.",
  auth_failed: "Authentication failed. Please try again.",
  no_code: "Something went wrong during sign-in. Please try again.",
};

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const invite = searchParams.get("invite");

  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const buildCallbackUrl = () => {
    const url = new URL("/auth/callback", window.location.origin);
    if (invite) url.searchParams.set("invite", invite);
    return url.toString();
  };

  const handleOAuthSignIn = async (provider: Provider) => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: buildCallbackUrl(),
        queryParams: provider === "google" ? { prompt: "select_account" } : undefined,
      },
    });
  };

  const handleMagicLink = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim()) return;
    setEmailLoading(true);
    setEmailError(null);

    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: buildCallbackUrl() },
    });

    setEmailLoading(false);
    if (otpError) {
      setEmailError(otpError.message);
    } else {
      setEmailSent(true);
    }
  };

  return (
    <AuthLayout panel={<AuthBrandingPanel />}>
      <div className="w-full max-w-sm flex flex-col items-center gap-6">
        {/* Heading */}
        <div className="text-center">
          <h1 className="text-2xl font-medium tracking-tight text-foreground">Sign in</h1>
          <p className="mt-2 text-sm text-muted">Welcome back to T Creative Studio.</p>
        </div>

        {/* Error banner */}
        {error && ERROR_MESSAGES[error] && (
          <div className="w-full px-4 py-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-800">
            {ERROR_MESSAGES[error]}
          </div>
        )}

        {/* OAuth providers */}
        <div className="w-full flex flex-col gap-3">
          {/* Google */}
          <button
            onClick={() => handleOAuthSignIn("google")}
            className="w-full inline-flex items-center justify-center gap-3 px-5 py-3 text-sm font-medium rounded-md border border-foreground/15 bg-background text-foreground hover:bg-surface transition-colors duration-200"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </button>

          {/* Apple */}
          <button
            onClick={() => handleOAuthSignIn("apple")}
            className="w-full inline-flex items-center justify-center gap-3 px-5 py-3 text-sm font-medium rounded-md border border-foreground/15 bg-background text-foreground hover:bg-surface transition-colors duration-200"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            Continue with Apple
          </button>

          {/* GitHub */}
          <button
            onClick={() => handleOAuthSignIn("github")}
            className="w-full inline-flex items-center justify-center gap-3 px-5 py-3 text-sm font-medium rounded-md border border-foreground/15 bg-background text-foreground hover:bg-surface transition-colors duration-200"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            Continue with GitHub
          </button>

          {/* Twitter / X */}
          <button
            onClick={() => handleOAuthSignIn("twitter")}
            className="w-full inline-flex items-center justify-center gap-3 px-5 py-3 text-sm font-medium rounded-md border border-foreground/15 bg-background text-foreground hover:bg-surface transition-colors duration-200"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Continue with X
          </button>
        </div>

        {/* Divider */}
        <div className="w-full flex items-center gap-3">
          <div className="flex-1 h-px bg-foreground/8" />
          <span className="text-xs text-muted/50">or</span>
          <div className="flex-1 h-px bg-foreground/8" />
        </div>

        {/* Email magic link */}
        {emailSent ? (
          <div className="w-full px-5 py-4 rounded-md bg-accent/5 border border-accent/15 text-center space-y-1">
            <p className="text-sm font-medium text-foreground">Check your email</p>
            <p className="text-xs text-muted">
              We sent a sign-in link to <strong className="text-foreground">{email}</strong>
            </p>
          </div>
        ) : (
          <form onSubmit={handleMagicLink} className="w-full space-y-3">
            <input
              type="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 text-sm rounded-md border border-foreground/15 bg-background text-foreground placeholder:text-muted/40 focus:outline-none focus:border-accent transition-colors duration-200"
            />
            {emailError && <p className="text-xs text-red-600">{emailError}</p>}
            <button
              type="submit"
              disabled={!email.trim() || emailLoading}
              className="w-full px-5 py-3 text-sm font-medium rounded-md bg-foreground text-background hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {emailLoading ? "Sending…" : "Continue with Email"}
            </button>
          </form>
        )}

        {/* Footer */}
        <p className="text-xs text-muted/60 text-center">
          By signing in you agree to our terms and privacy policy.
        </p>
      </div>
    </AuthLayout>
  );
}

export function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
