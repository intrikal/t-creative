"use client";

import { useEffect } from "react";

export default function CheckoutError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main-content" className="pt-16">
      <div className="py-24 md:py-32 px-6 text-center">
        <div className="mx-auto max-w-md">
          <h2 className="text-2xl font-light tracking-tight text-foreground mb-4">
            Something went wrong.
          </h2>
          <p className="text-sm text-muted mb-8">
            We couldn&apos;t load checkout. Please try again.
          </p>
          <button
            onClick={reset}
            className="px-6 py-3 text-xs tracking-wide uppercase bg-foreground text-background hover:bg-muted transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    </main>
  );
}
