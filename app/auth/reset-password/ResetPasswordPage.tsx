"use client";

/**
 * ResetPasswordPage — lets users set a new password after clicking a reset link.
 *
 * ## Flow
 * 1. Supabase emails a link to /auth/reset-password?code=<code>
 * 2. On mount, this page exchanges the code for a live session via
 *    exchangeCodeForSession(). This is the PKCE handshake that Supabase
 *    requires before updateUser() will accept a password change.
 * 3. The user enters and confirms a new password (8+ chars).
 * 4. supabase.auth.updateUser({ password }) commits the change.
 *
 * ## Why not /auth/callback?
 * The password reset redirectTo bypasses the normal /auth/callback route so
 * that Supabase doesn't redirect the user to the dashboard after code exchange.
 * The code exchange happens inline on this page instead.
 */
import { useState, useEffect } from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthBrandingPanel } from "@/components/auth/AuthBrandingPanel";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { createClient } from "@/utils/supabase/client";

function ResetPasswordContent() {
  const searchParams = useSearchParams();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Exchange the one-time code for a session so updateUser() is authorized.
  useEffect(() => {
    async function exchangeCode() {
      const code = searchParams.get("code");
      if (!code) {
        setSessionError("Invalid or expired reset link. Please request a new one.");
        return;
      }

      const supabase = createClient();
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        setSessionError(
          "This reset link has expired or already been used. Please request a new one.",
        );
      } else {
        setSessionReady(true);
      }
    }

    exchangeCode();
  }, [searchParams]);

  const validate = (): string | null => {
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (password !== confirm) return "Passwords do not match.";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    setLoading(false);
    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess(true);
    }
  };

  if (sessionError) {
    return (
      <AuthLayout panel={<AuthBrandingPanel />}>
        <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
          <div>
            <h1 className="text-2xl font-medium tracking-tight text-foreground">Link expired</h1>
            <p className="mt-2 text-sm text-muted">{sessionError}</p>
          </div>
          <Link
            href="/auth/forgot-password"
            className="w-full px-5 py-3 text-sm font-medium rounded-md bg-foreground text-background hover:bg-muted text-center block transition-colors duration-200"
          >
            Request new link
          </Link>
        </div>
      </AuthLayout>
    );
  }

  if (success) {
    return (
      <AuthLayout panel={<AuthBrandingPanel />}>
        <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
          <div>
            <h1 className="text-2xl font-medium tracking-tight text-foreground">
              Password updated
            </h1>
            <p className="mt-2 text-sm text-muted">
              Your password has been changed. You can now sign in with your new password.
            </p>
          </div>
          <Link
            href="/login"
            className="w-full px-5 py-3 text-sm font-medium rounded-md bg-foreground text-background hover:bg-muted text-center block transition-colors duration-200"
          >
            Sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout panel={<AuthBrandingPanel />}>
      <div className="w-full max-w-sm flex flex-col items-center gap-6">
        {/* Heading */}
        <div className="text-center">
          <h1 className="text-2xl font-medium tracking-tight text-foreground">Set new password</h1>
          <p className="mt-2 text-sm text-muted">Choose a strong password for your account.</p>
        </div>

        {!sessionReady ? (
          <p className="text-sm text-muted animate-pulse">Verifying link…</p>
        ) : (
          <form onSubmit={handleSubmit} className="w-full space-y-3">
            <input
              type="password"
              placeholder="New password (8+ characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 text-sm rounded-md border border-foreground/15 bg-background text-foreground placeholder:text-muted/40 focus:outline-none focus:border-accent transition-colors duration-200"
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-4 py-3 text-sm rounded-md border border-foreground/15 bg-background text-foreground placeholder:text-muted/40 focus:outline-none focus:border-accent transition-colors duration-200"
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={!password || !confirm || loading}
              className="w-full px-5 py-3 text-sm font-medium rounded-md bg-foreground text-background hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {loading ? "Updating…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </AuthLayout>
  );
}

export function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}
