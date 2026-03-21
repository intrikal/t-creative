/**
 * Next.js error boundary for /dashboard/bookings.
 * Reports the error to Sentry on mount, then shows a retry button
 * and a link back to the dashboard overview.
 *
 * The useEffect fires once per error instance (keyed by [error]) to
 * avoid duplicate Sentry reports on re-renders.
 */
"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center flex-1 p-8 text-center">
      <p className="text-sm font-medium text-foreground mb-1">Something went wrong loading this page</p>
      <p className="text-xs text-muted mb-6">An unexpected error occurred. You can try again or go back to the overview.</p>
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="px-4 py-2 text-xs font-medium rounded-lg bg-foreground text-background hover:opacity-90 transition-opacity"
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="px-4 py-2 text-xs font-medium rounded-lg border border-border text-muted hover:text-foreground transition-colors"
        >
          Back to overview
        </Link>
      </div>
    </div>
  );
}
