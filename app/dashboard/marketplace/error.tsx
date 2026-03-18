"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function MarketplaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
    console.error("[marketplace error]", error);
  }, [error]);

  return (
    <div className="p-8 text-center space-y-4">
      <p className="text-muted-foreground">Failed to load marketplace</p>
      <p className="font-mono text-sm text-destructive">{error.message}</p>
      <button onClick={reset} className="text-sm underline">
        Try again
      </button>
    </div>
  );
}
