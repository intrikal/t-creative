"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function AnalyticsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
    console.error("[analytics error]", error);
  }, [error]);

  return (
    <div className="p-8 text-center">
      <p className="text-sm font-medium text-foreground mb-1">Failed to load analytics</p>
      <p className="text-xs text-muted mb-4 font-mono">{error.message}</p>
      <button
        onClick={reset}
        className="px-4 py-2 text-xs font-medium rounded-lg bg-foreground text-background hover:opacity-90 transition-opacity"
      >
        Try again
      </button>
    </div>
  );
}
