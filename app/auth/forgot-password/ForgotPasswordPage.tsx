"use client";

/**
 * ForgotPasswordPage — sends a password reset email via Supabase Auth.
 *
 * Always shows a success state after submission regardless of whether an
 * account exists, preventing email enumeration attacks.
 */
import { useState } from "react";
import { Suspense } from "react";
import Link from "next/link";
import { AuthBrandingPanel } from "@/components/auth/AuthBrandingPanel";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { createClient } from "@/utils/supabase/client";

function ForgotPasswordContent() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/reset-password`;

    // Fire and forget — we always show success to prevent email enumeration.
    await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });

    setLoading(false);
    setSubmitted(true);
  };

  return (
    <AuthLayout panel={<AuthBrandingPanel />}>
      <div className="w-full max-w-sm flex flex-col items-center gap-6">
        {/* Heading */}
        <div className="text-center">
          <h1 className="text-2xl font-medium tracking-tight text-foreground">Reset password</h1>
          <p className="mt-2 text-sm text-muted">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>

        {submitted ? (
          <div className="w-full px-5 py-4 rounded-md bg-accent/5 border border-accent/15 text-center space-y-1">
            <p className="text-sm font-medium text-foreground">Check your email</p>
            <p className="text-xs text-muted">
              If an account exists for <strong className="text-foreground">{email}</strong>,
              you&apos;ll receive a password reset link shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="w-full space-y-3">
            <input
              type="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 text-sm rounded-md border border-foreground/15 bg-background text-foreground placeholder:text-muted/40 focus:outline-none focus:border-accent transition-colors duration-200"
            />
            <button
              type="submit"
              disabled={!email.trim() || loading}
              className="w-full px-5 py-3 text-sm font-medium rounded-md bg-foreground text-background hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        <p className="text-sm text-muted">
          Remember your password?{" "}
          <Link href="/login" className="text-foreground underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}

export function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordContent />
    </Suspense>
  );
}
