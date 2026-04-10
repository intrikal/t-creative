"use client";

/**
 * PaymentsSection.tsx -- Saved payment methods tab for the client settings page.
 *
 * Displays Square card-on-file data fetched server-side and passed via props.
 * Card deletion calls a server action. The "Add payment method" button opens
 * a dialog that loads the Square Web Payments SDK to tokenize a new card,
 * then vaults it via the saveCardToken server action.
 */

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { CreditCard, Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { PaymentMethod } from "../client-types";
import { deleteCard, saveCardToken } from "../payment-actions";

/* ------------------------------------------------------------------ */
/*  Square Web Payments SDK types + loader                             */
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

const SANDBOX_URL = "https://sandbox.web.squarecdn.com/v1/square.js";
const PRODUCTION_URL = "https://web.squarecdn.com/v1/square.js";

let loadPromise: Promise<void> | null = null;

function loadSquareSdk(): Promise<void> {
  if (typeof window !== "undefined" && window.Square) return Promise.resolve();
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
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatExpiry(month: number, year: number): string {
  const mm = String(month).padStart(2, "0");
  const yy = String(year).slice(-2);
  return `${mm}/${yy}`;
}

/* ------------------------------------------------------------------ */
/*  AddCardDialog                                                      */
/* ------------------------------------------------------------------ */

function AddCardDialog({
  open,
  onClose,
  onCardSaved,
}: {
  open: boolean;
  onClose: () => void;
  onCardSaved: (card: PaymentMethod) => void;
}) {
  const cardRef = useRef<SquareCardInstance | null>(null);
  const [ready, setReady] = useState(false);
  const [sdkError, setSdkError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;

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

        await card.attach("#add-card-container");
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
  }, [open]);

  const handleSubmit = useCallback(async () => {
    if (!cardRef.current || saving) return;

    setError("");
    setSaving(true);

    try {
      const result = await cardRef.current.tokenize();

      if (result.status !== "OK" || !result.token) {
        const msg = result.errors?.[0]?.message ?? "Card verification failed. Please try again.";
        setError(msg);
        setSaving(false);
        return;
      }

      const saveResult = await saveCardToken(result.token);

      if (!saveResult.success) {
        setError(saveResult.error);
        setSaving(false);
        return;
      }

      onCardSaved(saveResult.card);
      onClose();
    } catch {
      setError("Something went wrong. Please try again.");
      setSaving(false);
    }
  }, [saving, onCardSaved, onClose]);

  return (
    <Dialog open={open} onClose={onClose} title="Add payment method" size="sm">
      <div className="space-y-4">
        {sdkError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {sdkError}
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted">
                <CreditCard className="h-3.5 w-3.5" />
                Card details
              </label>
              <div
                id="add-card-container"
                className={cn(
                  "min-h-[44px] rounded-xl border border-border bg-surface px-1 py-1 transition-colors",
                  !ready && "flex items-center justify-center",
                )}
              >
                {!ready && (
                  <div className="flex items-center gap-2 py-2 text-xs text-muted">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading payment form...
                  </div>
                )}
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex items-start gap-2 rounded-lg bg-foreground/5 px-3 py-2">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
              <p className="text-[11px] leading-relaxed text-muted">
                Your card is securely processed by Square. Card details never touch our servers.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-muted hover:text-foreground transition-colors rounded-lg hover:bg-foreground/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!ready || saving}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2",
                  !ready || saving
                    ? "bg-foreground/10 text-muted cursor-not-allowed"
                    : "bg-accent text-white hover:bg-accent/90",
                )}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save card"
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  PaymentsSection                                                    */
/* ------------------------------------------------------------------ */

export function PaymentsSection({ initial }: { initial: PaymentMethod[] }) {
  const [cards, setCards] = useState<PaymentMethod[]>(initial);
  const [pending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);

  function handleDelete(id: string) {
    setDeletingId(id);
    startTransition(async () => {
      const result = await deleteCard(id);
      if (result.success) {
        setCards((prev) => prev.filter((c) => c.id !== id));
      }
      setDeletingId(null);
    });
  }

  function handleCardSaved(card: PaymentMethod) {
    setCards((prev) => [...prev, card]);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">Payment Methods</h2>
        <p className="text-xs text-muted mt-0.5">Manage your saved cards</p>
      </div>

      <Card className="gap-0">
        <CardContent className="px-5 pb-5 pt-5 space-y-4">
          {cards.length === 0 ? (
            <div className="py-8 text-center border border-dashed border-border rounded-xl">
              <CreditCard className="w-6 h-6 text-muted/40 mx-auto mb-2" />
              <p className="text-sm text-muted">No payment methods saved</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cards.map((card) => (
                <div
                  key={card.id}
                  className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-surface"
                >
                  <div className="w-9 h-6 rounded bg-foreground/8 flex items-center justify-center shrink-0">
                    <CreditCard className="w-4 h-4 text-muted" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {card.brand} •••• {card.last4}
                    </p>
                    <p className="text-xs text-muted mt-0.5">
                      Expires {formatExpiry(card.expMonth, card.expYear)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {card.isDefault && (
                      <span className="text-[10px] font-medium text-[#4e6b51] bg-[#4e6b51]/10 border border-[#4e6b51]/20 px-1.5 py-0.5 rounded-full">
                        Default
                      </span>
                    )}
                    <button
                      onClick={() => handleDelete(card.id)}
                      disabled={pending && deletingId === card.id}
                      aria-label="Remove card"
                      className="p-1 rounded-md text-muted hover:text-destructive hover:bg-destructive/8 transition-colors disabled:opacity-50"
                    >
                      {pending && deletingId === card.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => {
              setDialogKey((k) => k + 1);
              setDialogOpen(true);
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-border text-sm font-medium text-muted hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add payment method
          </button>

          <div className="border-t border-border/50 pt-4">
            <p className="text-xs text-muted leading-relaxed">
              Payment methods are used for shop orders, training deposits, and service add-ons. Card
              data is encrypted and stored securely by Square.
            </p>
          </div>
        </CardContent>
      </Card>

      <AddCardDialog
        key={dialogKey}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCardSaved={handleCardSaved}
      />
    </div>
  );
}
