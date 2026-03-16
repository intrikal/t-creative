"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
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
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "Geist Sans, system-ui, sans-serif",
          backgroundColor: "#faf6f1",
          color: "#2c2420",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 480, padding: "2rem" }}>
          <p
            style={{
              fontSize: "0.75rem",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "#6b5d52",
              marginBottom: "1rem",
            }}
          >
            T Creative Studio
          </p>
          <h1
            style={{
              fontFamily: "Cormorant, Georgia, serif",
              fontSize: "2.5rem",
              fontWeight: 400,
              margin: "0 0 1rem",
              color: "#2c2420",
            }}
          >
            Something went wrong
          </h1>
          <p style={{ color: "#6b5d52", marginBottom: "2rem", lineHeight: 1.6 }}>
            An unexpected error occurred. We&apos;ve been notified and will look into it.
          </p>
          <button
            onClick={reset}
            style={{
              backgroundColor: "#2c2420",
              color: "#faf6f1",
              border: "none",
              padding: "0.75rem 2rem",
              fontSize: "0.875rem",
              letterSpacing: "0.05em",
              cursor: "pointer",
              borderRadius: "2px",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
