"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";

export default function InvoicesError({
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
