"use client";

/**
 * Dashboard error boundary — catches runtime errors within /dashboard segments
 * so a single section failure doesn't crash the entire dashboard shell.
 */

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { AlertTriangle } from "lucide-react";

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
      <AlertTriangle className="h-8 w-8 text-muted mb-4" />
      <p className="text-sm font-medium text-foreground mb-1">Something went wrong</p>
      <p className="text-xs text-muted mb-6">{error.message}</p>
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
          Go to dashboard home
        </Link>
      </div>
    </div>
  );
}
