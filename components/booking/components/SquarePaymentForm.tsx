"use client";

/**
 * SquarePaymentForm — Embedded card form using the Square Web Payments SDK.
 *
 * Loads the SDK script on mount, initialises a Card payment method,
 * attaches it to the container ref, and tokenises the card when the
 * user submits. Returns the resulting payment token (`nonce`) to the
 * parent via `onTokenise`.
 *
 * Requires two public env vars:
 *   NEXT_PUBLIC_SQUARE_APP_ID      — Square application ID
 *   NEXT_PUBLIC_SQUARE_LOCATION_ID — Square location ID
 *
 * @see https://developer.squareup.com/docs/web-payments/take-card-payment
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice } from "../helpers";

/* ------------------------------------------------------------------ */
/*  SDK type stubs (Web Payments SDK is loaded via <script>)           */
/* ------------------------------------------------------------------ */

interface SquareCardInstance {
  attach: (selector: string) => Promise<void>;
  tokenize: () => Promise<{ status: string; token?: string; errors?: Array<{ message: string }> }>;
  destroy: () => void;
}

interface SquarePaymentsInstance {
  card: () => Promise<SquareCardInstance>;
}

declare global {
  interface Window {
    Square?: {
      payments: (appId: string, locationId: string) => Promise<SquarePaymentsInstance>;
    };
  }
}

/* ------------------------------------------------------------------ */
/*  SDK script loader (idempotent)                                     */
/* ------------------------------------------------------------------ */

const SANDBOX_URL = "https://sandbox.web.squarecdn.com/v1/square.js";
const PRODUCTION_URL = "https://web.squarecdn.com/v1/square.js";

let loadPromise: Promise<void> | null = null;

function loadSquareSdk(): Promise<void> {
  if (window.Square) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    const env = process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT;
    script.src = env === "production" ? PRODUCTION_URL : SANDBOX_URL;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Square SDK"));
    document.head.appendChild(script);
  });

  return loadPromise;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function SquarePaymentForm({
  amountInCents,
  onTokenise,
  submitting,
}: {
  /** Deposit amount shown in the pay button label. */
  amountInCents: number;
  /** Called with the payment token (nonce) after successful card tokenisation. */
  onTokenise: (token: string) => void;
  /** When true, disables the submit button (parent is processing the payment). */
  submitting: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<SquareCardInstance | null>(null);
  const [ready, setReady] = useState(false);
  const [sdkError, setSdkError] = useState("");
  const [tokenError, setTokenError] = useState("");

  /* Initialise SDK + Card on mount */
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        await loadSquareSdk();
        if (cancelled) return;

        const appId = process.env.NEXT_PUBLIC_SQUARE_APP_ID;
        const locationId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID;
        if (!appId || !locationId) {
          setSdkError("Payment configuration missing. Please try again later.");
          return;
        }

        const payments = await window.Square!.payments(appId, locationId);
        const card = await payments.card();
        if (cancelled) return;

        await card.attach("#square-card-container");
        cardRef.current = card;
        setReady(true);
      } catch (err) {
        if (!cancelled) {
          setSdkError(err instanceof Error ? err.message : "Failed to load payment form");
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      cardRef.current?.destroy();
      cardRef.current = null;
    };
  }, []);

  /* Tokenise card on submit */
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!cardRef.current || submitting) return;

      setTokenError("");

      try {
        const result = await cardRef.current.tokenize();

        if (result.status === "OK" && result.token) {
          onTokenise(result.token);
        } else {
          const msg = result.errors?.[0]?.message ?? "Card verification failed. Please try again.";
          setTokenError(msg);
        }
      } catch {
        setTokenError("Something went wrong. Please try again.");
      }
    },
    [onTokenise, submitting],
  );

  if (sdkError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {sdkError}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Card container — Square SDK injects the iframe here */}
      <div className="space-y-2">
        <label className="flex items-center gap-1.5 text-xs font-medium text-stone-600">
          <CreditCard className="h-3.5 w-3.5" />
          Card details
        </label>
        <div
          id="square-card-container"
          ref={containerRef}
          className={cn(
            "min-h-[44px] rounded-xl border border-stone-200 bg-white px-1 py-1 transition-colors",
            !ready && "flex items-center justify-center",
          )}
        >
          {!ready && (
            <div className="flex items-center gap-2 py-2 text-xs text-stone-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading payment form...
            </div>
          )}
        </div>
      </div>

      {tokenError && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{tokenError}</p>
      )}

      {/* Security note */}
      <div className="flex items-start gap-2 rounded-lg bg-stone-50 px-3 py-2">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-400" />
        <p className="text-[11px] leading-relaxed text-stone-400">
          Your payment is securely processed by Square. Card details never touch our servers.
        </p>
      </div>

      <button
        type="submit"
        disabled={!ready || submitting}
        className={cn(
          "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-colors",
          !ready || submitting
            ? "bg-stone-300 text-stone-500 cursor-wait"
            : "bg-[#96604a] text-white hover:bg-[#7a4e3a] active:scale-[0.98]",
        )}
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <CreditCard className="h-4 w-4" />
            Pay {formatPrice(amountInCents)} deposit
          </>
        )}
      </button>
    </form>
  );
}
